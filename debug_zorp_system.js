const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugZorpSystem() {
  console.log('🔍 Debugging ZORP System - Online/Offline Detection');
  console.log('==================================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Check ZORP zones and their current status
    console.log('📋 Checking ZORP Zones Status...\n');
    
    const [zones] = await connection.execute(`
      SELECT 
        z.name,
        z.owner,
        z.current_state,
        z.color_online,
        z.color_offline,
        z.delay,
        z.expire,
        z.created_at,
        z.last_online_at,
        rs.nickname as server_name,
        rs.ip,
        rs.port,
        rs.password
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.created_at DESC
      LIMIT 10
    `);

    if (zones.length === 0) {
      console.log('❌ No active ZORP zones found!');
      return;
    }

    console.log(`Found ${zones.length} active ZORP zones:\n`);

    for (const zone of zones) {
      console.log(`🏠 **Zone: ${zone.name}**`);
      console.log(`   Owner: ${zone.owner}`);
      console.log(`   Server: ${zone.server_name}`);
      console.log(`   Current State: ${zone.current_state || 'unknown'}`);
      console.log(`   Online Color: ${zone.color_online || 'default'}`);
      console.log(`   Offline Color: ${zone.color_offline || 'default'}`);
      console.log(`   Delay: ${zone.delay || 0} minutes`);
      console.log(`   Created: ${zone.created_at}`);
      console.log(`   Last Online: ${zone.last_online_at || 'Never'}`);
      console.log(`   Expires: ${zone.expire} seconds from creation`);
      
      // Calculate time remaining
      const created = new Date(zone.created_at);
      const now = new Date();
      const elapsed = Math.floor((now - created) / 1000);
      const remaining = zone.expire - elapsed;
      const remainingHours = Math.floor(remaining / 3600);
      const remainingMinutes = Math.floor((remaining % 3600) / 60);
      
      console.log(`   Time Remaining: ${remainingHours}h ${remainingMinutes}m`);
      console.log(`   Server IP: ${zone.ip}`);
      console.log(`   Server Port: ${zone.port}`);
      console.log('');

      // Check if this zone should be online based on current time
      if (zone.current_state === 'red' || zone.current_state === 'yellow') {
        console.log(`   ⚠️  ZONE IS OFFLINE (${zone.current_state.toUpperCase()})`);
        console.log(`   🔍 This zone should be showing as offline in-game`);
        console.log('');
      } else if (zone.current_state === 'green') {
        console.log(`   ✅ ZONE IS ONLINE (GREEN)`);
        console.log(`   🔍 This zone should be showing as online in-game`);
        console.log('');
      } else {
        console.log(`   ❓ ZONE STATE UNKNOWN: ${zone.current_state}`);
        console.log('');
      }
    }

    // Check for any zones that might be stuck in wrong states
    console.log('🔍 Checking for Potential Issues...\n');
    
    const [stuckZones] = await connection.execute(`
      SELECT 
        z.name,
        z.owner,
        z.current_state,
        z.last_online_at,
        rs.nickname as server_name
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      AND (z.current_state IS NULL OR z.current_state = '')
    `);

    if (stuckZones.length > 0) {
      console.log(`⚠️  Found ${stuckZones.length} zones with NULL/empty state:`);
      stuckZones.forEach(zone => {
        console.log(`   - ${zone.name} (${zone.owner}) on ${zone.server_name} - State: ${zone.current_state || 'NULL'}`);
      });
      console.log('');
    }

    // Check for zones that haven't been updated recently
    const [oldZones] = await connection.execute(`
      SELECT 
        z.name,
        z.owner,
        z.current_state,
        z.last_online_at,
        rs.nickname as server_name
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      AND z.last_online_at IS NOT NULL
      AND z.last_online_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
      AND z.current_state = 'green'
    `);

    if (oldZones.length > 0) {
      console.log(`⚠️  Found ${oldZones.length} zones marked as online but haven't been updated in over 1 hour:`);
      oldZones.forEach(zone => {
        console.log(`   - ${zone.name} (${zone.owner}) on ${zone.server_name} - Last online: ${zone.last_online_at}`);
      });
      console.log('');
    }

    // Summary
    console.log('📊 **ZORP System Summary:**');
    console.log(`   Total Active Zones: ${zones.length}`);
    console.log(`   Online Zones (Green): ${zones.filter(z => z.current_state === 'green').length}`);
    console.log(`   Offline Zones (Red): ${zones.filter(z => z.current_state === 'red').length}`);
    console.log(`   Delay Zones (Yellow): ${zones.filter(z => z.current_state === 'yellow').length}`);
    console.log(`   Unknown State: ${zones.filter(z => !z.current_state || z.current_state === '').length}`);
    console.log(`   Stuck Zones: ${stuckZones.length}`);
    console.log(`   Potentially Stale Zones: ${oldZones.length}`);

    // Recommendations
    console.log('\n💡 **Recommendations:**');
    if (stuckZones.length > 0) {
      console.log('   1. Fix zones with NULL/empty states by updating their current_state');
    }
    if (oldZones.length > 0) {
      console.log('   2. Investigate why zones marked as online haven\'t been updated recently');
    }
    if (zones.filter(z => z.current_state === 'red').length > 0) {
      console.log('   3. Check if offline zones are actually offline or if there\'s a detection bug');
    }
    
    console.log('\n🔧 **Next Steps:**');
    console.log('   1. Check bot logs for ZORP DEBUG messages');
    console.log('   2. Verify RCON commands are working (status, players, users)');
    console.log('   3. Test with a specific zone to see the full flow');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

debugZorpSystem();
