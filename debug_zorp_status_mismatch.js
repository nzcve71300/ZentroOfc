const pool = require('./src/db');

async function debugZorpStatusMismatch() {
  console.log('🔍 Debugging Zorp Status Mismatch...\n');
  console.log('💡 This will help identify why Zorp shows wrong colors vs actual player status\n');
  
  try {
    // Step 1: Check current Zorp zones and their status
    console.log('📋 Step 1: Checking current Zorp zones status...');
    const [zones] = await pool.query(`
      SELECT 
        z.name,
        z.owner,
        z.current_state,
        z.color_online,
        z.color_offline,
        z.color_yellow,
        z.delay,
        z.expire,
        z.last_online_at,
        z.created_at,
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
    
    console.log(`✅ Found ${zones.length} active Zorp zones:\n`);
    
    // Group zones by status
    const greenZones = zones.filter(z => z.current_state === 'green');
    const yellowZones = zones.filter(z => z.current_state === 'yellow');
    const redZones = zones.filter(z => z.current_state === 'red');
    
    console.log(`🟢 Green (Online): ${greenZones.length} zones`);
    console.log(`🟡 Yellow (Delay): ${yellowZones.length} zones`);
    console.log(`🔴 Red (Offline): ${redZones.length} zones\n`);
    
    // Step 2: Check for potential issues
    console.log('📋 Step 2: Checking for potential issues...\n');
    
    // Check zones that might be stuck in wrong state
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    
    // Check green zones with old last_online_at
    const potentiallyStuckGreen = greenZones.filter(z => {
      if (!z.last_online_at) return false;
      const lastOnline = new Date(z.last_online_at);
      return lastOnline < oneHourAgo;
    });
    
    if (potentiallyStuckGreen.length > 0) {
      console.log('⚠️  Potentially stuck GREEN zones (no recent online activity):');
      potentiallyStuckGreen.forEach(z => {
        const lastOnline = new Date(z.last_online_at);
        const hoursAgo = Math.round((now - lastOnline) / (1000 * 60 * 60));
        console.log(`   ${z.name} (${z.owner}) - Last online: ${hoursAgo} hours ago`);
      });
      console.log('');
    }
    
    // Check red zones with recent last_online_at
    const potentiallyStuckRed = redZones.filter(z => {
      if (!z.last_online_at) return false;
      const lastOnline = new Date(z.last_online_at);
      return lastOnline > oneHourAgo;
    });
    
    if (potentiallyStuckRed.length > 0) {
      console.log('⚠️  Potentially stuck RED zones (recent online activity):');
      potentiallyStuckRed.forEach(z => {
        const lastOnline = new Date(z.last_online_at);
        const hoursAgo = Math.round((now - lastOnline) / (1000 * 60 * 60));
        console.log(`   ${z.name} (${z.owner}) - Last online: ${hoursAgo} hours ago`);
      });
      console.log('');
    }
    
    // Step 3: Check player status tracking
    console.log('📋 Step 3: Checking player status tracking...');
    
    // Check if zorp_player_status table exists and has data
    try {
      const [statusCheck] = await pool.query("SHOW TABLES LIKE 'zorp_player_status'");
      if (statusCheck.length > 0) {
        const [playerStatus] = await pool.query(`
          SELECT 
            ps.player_name,
            ps.is_online,
            ps.last_seen,
            ps.zone_name,
            rs.nickname as server_name
          FROM zorp_player_status ps
          JOIN rust_servers rs ON ps.server_id = rs.id
          ORDER BY ps.last_seen DESC
          LIMIT 10
        `);
        
        if (playerStatus.length > 0) {
          console.log('\n📊 Recent player status tracking:');
          playerStatus.forEach(ps => {
            const lastSeen = new Date(ps.last_seen);
            const timeAgo = Math.round((now - lastSeen) / (1000 * 60));
            const status = ps.is_online ? '🟢 Online' : '🔴 Offline';
            console.log(`   ${ps.player_name} - ${status} (${timeAgo} min ago) - Zone: ${ps.zone_name || 'None'} - Server: ${ps.server_name}`);
          });
        } else {
          console.log('\n📊 No recent player status data found');
        }
      } else {
        console.log('\n📊 zorp_player_status table not found - status tracking may not be working');
      }
    } catch (error) {
      console.log('\n📊 Error checking player status:', error.message);
    }
    
    // Step 4: Check for common issues
    console.log('\n📋 Step 4: Common issues that cause status mismatch...\n');
    
    console.log('🔍 **Possible Causes:**');
    console.log('   1. RCON connection issues - bot can\'t get accurate player list');
    console.log('   2. Player name parsing problems - bot misreads player names');
    console.log('   3. Team detection issues - bot doesn\'t recognize team changes');
    console.log('   4. Timer conflicts - multiple timers running simultaneously');
    console.log('   5. Database state corruption - zone state doesn\'t match reality');
    console.log('   6. RCON command failures - status/players commands not working');
    
    console.log('\n🔍 **Recommended Debugging Steps:**');
    console.log('   1. Check RCON logs: pm2 logs zentro-bot | grep -E "(ZORP|RCON|status)"');
    console.log('   2. Verify RCON connection: Test status/players commands manually');
    console.log('   3. Check player name format: Ensure names are parsed correctly');
    console.log('   4. Monitor zone transitions: Watch for stuck states');
    console.log('   5. Verify team detection: Check if team changes are detected');
    
    // Step 5: Show specific zone details for investigation
    console.log('\n📋 Step 5: Zone details for manual investigation...\n');
    
    zones.forEach((zone, index) => {
      console.log(`${index + 1}. Zone: ${zone.name}`);
      console.log(`   Owner: ${zone.owner}`);
      console.log(`   Current State: ${zone.current_state}`);
      console.log(`   Server: ${zone.server_name}`);
      console.log(`   Last Online: ${zone.last_online_at || 'Never'}`);
      console.log(`   Created: ${zone.created_at}`);
      console.log(`   Delay: ${zone.delay} min, Expire: ${zone.expire} sec`);
      console.log('');
    });
    
    console.log('🎯 **Next Steps:**');
    console.log('   1. Run this script to see current status');
    console.log('   2. Check RCON logs for errors');
    console.log('   3. Test RCON commands manually');
    console.log('   4. Monitor specific zones that seem stuck');
    console.log('   5. Check if player names are being parsed correctly');
    
  } catch (error) {
    console.error('❌ Error debugging Zorp status:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugZorpStatusMismatch().then(() => {
  process.exit(0);
});
