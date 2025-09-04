const pool = require('./src/db');

async function fixZorpStatusIssues() {
  console.log('🔧 Fixing Common Zorp Status Issues...\n');
  
  try {
    // Step 1: Check current status
    console.log('📋 Step 1: Checking current Zorp status...');
    const [zones] = await pool.query(`
      SELECT 
        z.id,
        z.name,
        z.owner,
        z.current_state,
        z.last_online_at,
        rs.nickname as server_name
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.current_state, z.owner
    `);
    
    if (zones.length === 0) {
      console.log('❌ No active Zorp zones found');
      return;
    }
    
    console.log(`✅ Found ${zones.length} active Zorp zones\n`);
    
    // Step 2: Fix potentially stuck zones
    console.log('📋 Step 2: Fixing potentially stuck zones...\n');
    
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));
    
    let fixedCount = 0;
    
    for (const zone of zones) {
      let needsFix = false;
      let newState = zone.current_state;
      let reason = '';
      
      // Check for green zones that haven't had recent activity
      if (zone.current_state === 'green' && zone.last_online_at) {
        const lastOnline = new Date(zone.last_online_at);
        if (lastOnline < twoHoursAgo) {
          needsFix = true;
          newState = 'red';
          reason = `Green zone with no activity for ${Math.round((now - lastOnline) / (1000 * 60 * 60))} hours`;
        }
      }
      
      // Check for red zones with recent activity
      if (zone.current_state === 'red' && zone.last_online_at) {
        const lastOnline = new Date(zone.last_online_at);
        if (lastOnline > twoHoursAgo) {
          needsFix = true;
          newState = 'green';
          reason = `Red zone with recent activity (${Math.round((now - lastOnline) / (1000 * 60))} min ago)`;
        }
      }
      
      if (needsFix) {
        console.log(`🔧 Fixing zone ${zone.name} (${zone.owner}):`);
        console.log(`   Current: ${zone.current_state} -> New: ${newState}`);
        console.log(`   Reason: ${reason}`);
        
        try {
          await pool.query(
            'UPDATE zorp_zones SET current_state = ? WHERE id = ?',
            [newState, zone.id]
          );
          console.log(`   ✅ Fixed successfully\n`);
          fixedCount++;
        } catch (error) {
          console.log(`   ❌ Failed to fix: ${error.message}\n`);
        }
      }
    }
    
    if (fixedCount === 0) {
      console.log('✅ No zones needed fixing\n');
    } else {
      console.log(`🎉 Fixed ${fixedCount} zones\n`);
    }
    
    // Step 3: Clean up expired zones
    console.log('📋 Step 3: Cleaning up expired zones...');
    const [expiredResult] = await pool.query(`
      DELETE FROM zorp_zones 
      WHERE created_at + INTERVAL expire SECOND <= CURRENT_TIMESTAMP
    `);
    
    if (expiredResult.affectedRows > 0) {
      console.log(`✅ Cleaned up ${expiredResult.affectedRows} expired zones\n`);
    } else {
      console.log('✅ No expired zones to clean up\n');
    }
    
    // Step 4: Reset stuck timers
    console.log('📋 Step 4: Resetting stuck timers...');
    
    // Clear any zones stuck in yellow state for too long
    const [stuckYellowResult] = await pool.query(`
      UPDATE zorp_zones 
      SET current_state = 'red' 
      WHERE current_state = 'yellow' 
      AND last_online_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    
    if (stuckYellowResult.affectedRows > 0) {
      console.log(`✅ Reset ${stuckYellowResult.affectedRows} stuck yellow zones to red\n`);
    } else {
      console.log('✅ No stuck yellow zones found\n');
    }
    
    // Step 5: Verify fixes
    console.log('📋 Step 5: Verifying fixes...');
    const [fixedZones] = await pool.query(`
      SELECT 
        z.name,
        z.owner,
        z.current_state,
        z.last_online_at,
        rs.nickname as server_name
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.current_state, z.owner
    `);
    
    const greenCount = fixedZones.filter(z => z.current_state === 'green').length;
    const yellowCount = fixedZones.filter(z => z.current_state === 'yellow').length;
    const redCount = fixedZones.filter(z => z.current_state === 'red').length;
    
    console.log(`📊 Final Status:`);
    console.log(`   🟢 Green (Online): ${greenCount}`);
    console.log(`   🟡 Yellow (Delay): ${yellowCount}`);
    console.log(`   🔴 Red (Offline): ${redCount}\n`);
    
    // Step 6: Recommendations
    console.log('📋 Step 6: Recommendations to prevent future issues...\n');
    
    console.log('💡 **Prevention Tips:**');
    console.log('   1. Monitor RCON connection stability');
    console.log('   2. Check player name parsing accuracy');
    console.log('   3. Verify team detection is working');
    console.log('   4. Ensure timers are not conflicting');
    console.log('   5. Regular database maintenance');
    
    console.log('\n🔍 **Monitoring Commands:**');
    console.log('   - Check logs: pm2 logs zentro-bot | grep -E "(ZORP|RCON)"');
    console.log('   - Monitor status: node debug_zorp_status_mismatch.js');
    console.log('   - Test RCON: Test status/players commands manually');
    
    console.log('\n🎯 **Next Steps:**');
    console.log('   1. Test the /zorp command to see if status is now correct');
    console.log('   2. Monitor specific zones that were problematic');
    console.log('   3. Check if player online/offline detection is working');
    console.log('   4. Run debug script again if issues persist');
    
  } catch (error) {
    console.error('❌ Error fixing Zorp status issues:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixZorpStatusIssues().then(() => {
  process.exit(0);
});
