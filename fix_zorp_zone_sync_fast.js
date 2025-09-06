const pool = require('./src/db');

async function fixZorpZoneSyncFast() {
  console.log('🔧 Fast Zorp zone synchronization fix...\n');
  
  try {
    // 1. Quick cleanup - remove zones with "Unknown" owners
    console.log('1. Removing zones with "Unknown" owners...');
    
    const [unknownResult] = await pool.query(
      'DELETE FROM zorp_zones WHERE owner = "Unknown" OR owner IS NULL OR owner = ""'
    );
    
    console.log(`✅ Removed ${unknownResult.affectedRows} zones with unknown owners`);
    
    // 2. Remove expired zones
    console.log('\n2. Removing expired zones...');
    
    const [expiredResult] = await pool.query(
      'DELETE FROM zorp_zones WHERE created_at + INTERVAL expire SECOND < CURRENT_TIMESTAMP'
    );
    
    console.log(`✅ Removed ${expiredResult.affectedRows} expired zones`);
    
    // 3. Reset all zones to green state (assume players are online)
    console.log('\n3. Resetting all active zones to green state...');
    
    const [resetResult] = await pool.query(
      'UPDATE zorp_zones SET current_state = "green" WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP'
    );
    
    console.log(`✅ Reset ${resetResult.affectedRows} zones to green state`);
    
    // 4. Clear all timer references in memory (this will be done when bot restarts)
    console.log('\n4. Timer cleanup will happen on bot restart...');
    
    // 5. Show current zone status
    console.log('\n5. Current zone status:');
    
    const [activeZones] = await pool.query(`
      SELECT z.name, z.owner, z.current_state, z.created_at, z.expire, rs.nickname as server_name
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY rs.nickname, z.created_at DESC
    `);
    
    if (activeZones.length > 0) {
      console.log(`\nActive zones (${activeZones.length} total):`);
      console.log('=' .repeat(80));
      
      let currentServer = '';
      for (const zone of activeZones) {
        if (zone.server_name !== currentServer) {
          currentServer = zone.server_name;
          console.log(`\n📡 ${currentServer}:`);
        }
        
        const createdDate = new Date(zone.created_at);
        const expiresAt = new Date(createdDate.getTime() + (zone.expire * 1000));
        const timeLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 1000 / 60)); // minutes
        
        console.log(`  🏠 ${zone.name} (${zone.owner}) - ${zone.current_state} - ${timeLeft}m left`);
      }
    } else {
      console.log('No active zones found');
    }
    
    console.log('\n✅ Fast Zorp zone synchronization completed!');
    console.log('📝 Summary:');
    console.log('   - Removed zones with unknown owners');
    console.log('   - Removed expired zones');
    console.log('   - Reset all active zones to green state');
    console.log('   - Zones will be properly restored on bot restart');
    console.log('\n🎮 Zorps should now work properly!');
    console.log('💡 Tip: Restart your bot to clear all timer references and restore zones properly.');
    
  } catch (error) {
    console.error('❌ Error in fast zone sync:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixZorpZoneSyncFast();
