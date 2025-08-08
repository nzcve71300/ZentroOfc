const pool = require('./src/db');

async function troubleshootZorpVisibility() {
  try {
    console.log('🔍 Troubleshooting ZORP visibility issues...\n');
    
    // 1. Check if zones are being created in the game
    console.log('📊 Recent ZORP creation attempts (last 2 hours):');
    const [recentAttempts] = await pool.query(`
      SELECT z.name, z.owner, rs.nickname as server, z.position, z.size, z.color_online,
             TIMESTAMPDIFF(MINUTE, z.created_at, NOW()) as minutes_ago
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
      ORDER BY z.created_at DESC
    `);
    
    recentAttempts.forEach((zone, index) => {
      console.log(`  ${index + 1}. ${zone.owner} on ${zone.server} (${zone.minutes_ago}m ago)`);
      console.log(`     Zone: ${zone.name}`);
      console.log(`     Position: ${zone.position}`);
      console.log(`     Size: ${zone.size}, Color: ${zone.color_online}`);
    });
    
    if (recentAttempts.length === 0) {
      console.log('  ❌ No recent ZORP creation attempts found');
    }
    
    // 2. Check ZORP defaults for the problematic server
    console.log('\n⚙️ ZORP settings for each server:');
    const [settings] = await pool.query(`
      SELECT rs.nickname, rs.ip, rs.port,
             zd.size, zd.color_online, zd.color_offline, zd.radiation, zd.delay
      FROM rust_servers rs
      LEFT JOIN zorp_defaults zd ON rs.id = zd.server_id
      ORDER BY rs.nickname
    `);
    
    settings.forEach(server => {
      console.log(`  ${server.nickname} (${server.ip}:${server.port}):`);
      if (server.size) {
        console.log(`    ✅ Size: ${server.size}, Colors: ${server.color_online}/${server.color_offline}`);
        console.log(`    ✅ Radiation: ${server.radiation}, Delay: ${server.delay}`);
      } else {
        console.log(`    ❌ No ZORP defaults configured!`);
      }
    });
    
    // 3. Check for common ZORP issues
    console.log('\n🔧 Common ZORP visibility issues:');
    
    // Check for zones with invalid positions
    const [invalidPositions] = await pool.query(`
      SELECT COUNT(*) as count FROM zorp_zones 
      WHERE position IS NULL OR position = '' OR position = '[]'
    `);
    
    if (invalidPositions[0].count > 0) {
      console.log(`  ❌ ${invalidPositions[0].count} zones have invalid positions`);
    } else {
      console.log('  ✅ All zones have valid positions');
    }
    
    // Check for zones with invalid colors
    const [invalidColors] = await pool.query(`
      SELECT COUNT(*) as count FROM zorp_zones 
      WHERE color_online NOT REGEXP '^[0-9]+,[0-9]+,[0-9]+$'
      OR color_offline NOT REGEXP '^[0-9]+,[0-9]+,[0-9]+$'
    `);
    
    if (invalidColors[0].count > 0) {
      console.log(`  ❌ ${invalidColors[0].count} zones have invalid color formats`);
    } else {
      console.log('  ✅ All zones have valid color formats');
    }
    
    // 4. Provide troubleshooting steps
    console.log('\n💡 Troubleshooting steps for invisible ZORP zones:');
    console.log('1. Server Requirements:');
    console.log('   - TruePVE plugin must be installed and working');
    console.log('   - CustomZones plugin must be installed');
    console.log('   - RCON must be properly configured');
    
    console.log('\n2. In-Game Checks:');
    console.log('   - Player must be team leader to create zones');
    console.log('   - Use F1 console: zones.list (to see if zones exist)');
    console.log('   - Check if player has permission to see zones');
    
    console.log('\n3. Bot Checks:');
    console.log('   - Verify RCON commands are working');
    console.log('   - Check bot logs during zone creation');
    console.log('   - Ensure zone creation commands succeed');
    
    console.log('\n4. Manual Test:');
    console.log('   - Try manual RCON command: zones.createcustomzone "TEST" (x,y,z) 0 Sphere 50 1 0 0 1 1');
    console.log('   - If manual works but bot doesn\'t, it\'s a bot issue');
    console.log('   - If manual doesn\'t work, it\'s a server plugin issue');
    
  } catch (error) {
    console.error('❌ Error troubleshooting ZORP:', error);
  } finally {
    await pool.end();
  }
}

troubleshootZorpVisibility();