const pool = require('./src/db');

async function diagnoseZorpIssues() {
  try {
    console.log('🔍 Diagnosing ZORP system issues...\n');
    
    // Check if zorp_zones table exists
    const [zorpTables] = await pool.query("SHOW TABLES LIKE 'zorp_zones'");
    if (zorpTables.length === 0) {
      console.log('❌ zorp_zones table does not exist!');
      return;
    }
    console.log('✅ zorp_zones table exists');
    
    // Check recent ZORP zones
    const [recentZones] = await pool.query(`
      SELECT z.*, rs.nickname as server_name, g.discord_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      ORDER BY z.created_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 Recent ZORP zones (last hour): ${recentZones.length}`);
    recentZones.forEach((zone, index) => {
      console.log(`  ${index + 1}. ${zone.owner} on ${zone.server_name}`);
      console.log(`     Zone ID: ${zone.zone_id}`);
      console.log(`     Status: ${zone.created_at + zone.expire * 1000 > Date.now() ? 'Active' : 'Expired'}`);
      console.log(`     Created: ${zone.created_at}`);
    });
    
    // Check active ZORP zones
    const [activeZones] = await pool.query(`
      SELECT z.*, rs.nickname as server_name, g.discord_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at + INTERVAL z.expire SECOND > NOW()
      ORDER BY z.created_at DESC
    `);
    
    console.log(`\n🟢 Currently active ZORP zones: ${activeZones.length}`);
    activeZones.forEach((zone, index) => {
      const timeLeft = Math.floor((new Date(zone.created_at).getTime() + zone.expire * 1000 - Date.now()) / 1000);
      console.log(`  ${index + 1}. ${zone.owner} on ${zone.server_name}`);
      console.log(`     Zone ID: ${zone.zone_id}`);
      console.log(`     Time left: ${Math.floor(timeLeft / 3600)}h ${Math.floor((timeLeft % 3600) / 60)}m`);
    });
    
    // Check ZORP defaults for each server
    const [servers] = await pool.query(`
      SELECT rs.nickname, rs.id, g.discord_id,
             zd.size, zd.color_online, zd.color_offline, zd.expire
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      LEFT JOIN zorp_defaults zd ON rs.id = zd.server_id
      ORDER BY rs.nickname
    `);
    
    console.log(`\n⚙️ ZORP settings for servers:`);
    servers.forEach(server => {
      console.log(`  ${server.nickname}:`);
      if (server.size) {
        console.log(`    Size: ${server.size}, Colors: ${server.color_online}/${server.color_offline}, Expire: ${server.expire}s`);
      } else {
        console.log(`    ❌ No ZORP defaults configured`);
      }
    });
    
    console.log('\n💡 If customer can\'t see ZORP zones:');
    console.log('1. Check if they have the TruePVE plugin installed');
    console.log('2. Verify zone creation commands are working in RCON');
    console.log('3. Check if zones are being created at the right coordinates');
    console.log('4. Ensure player has the right permissions to see zones');
    
  } catch (error) {
    console.error('❌ Error diagnosing ZORP issues:', error);
  } finally {
    await pool.end();
  }
}

diagnoseZorpIssues();