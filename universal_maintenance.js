const pool = require('./src/db');

async function universalMaintenance() {
  console.log('🔧 Running Universal Maintenance for ALL servers...\n');
  
  try {
    // 1. Get ALL servers dynamically
    const [allServers] = await pool.query('SELECT id, nickname, ip, port, guild_id FROM rust_servers ORDER BY nickname');
    console.log(`📊 Found ${allServers.length} servers in database:`);
    allServers.forEach((server, index) => {
      console.log(`  ${index + 1}. ${server.nickname} (${server.ip}:${server.port}) - Guild: ${server.guild_id}`);
    });
    
    // 2. Check for ANY invalid ZORP zones across ALL servers
    const [invalidZorps] = await pool.query(`
      SELECT COUNT(*) as count FROM zorp_zones 
      WHERE server_id IS NULL 
      OR color_online NOT REGEXP '^[0-9]+,[0-9]+,[0-9]+$'
      OR color_offline NOT REGEXP '^[0-9]+,[0-9]+,[0-9]+$'
    `);
    
    console.log(`\n🔍 ZORP Issues: ${invalidZorps[0].count} zones with invalid data`);
    
    // 3. Check for invalid ZORP defaults across ALL servers
    const [invalidDefaults] = await pool.query(`
      SELECT rs.nickname, zd.color_online, zd.color_offline
      FROM rust_servers rs
      JOIN zorp_defaults zd ON rs.id = zd.server_id
      WHERE zd.color_online NOT REGEXP '^[0-9]+,[0-9]+,[0-9]+$'
      OR zd.color_offline NOT REGEXP '^[0-9]+,[0-9]+,[0-9]+$'
    `);
    
    if (invalidDefaults.length > 0) {
      console.log(`\n❌ Servers with invalid ZORP color defaults:`);
      invalidDefaults.forEach(server => {
        console.log(`  - ${server.nickname}: ${server.color_online}/${server.color_offline}`);
      });
    } else {
      console.log(`\n✅ All server ZORP defaults have valid colors`);
    }
    
    // 4. Check for servers without ZORP defaults
    const [noDefaults] = await pool.query(`
      SELECT rs.nickname
      FROM rust_servers rs
      LEFT JOIN zorp_defaults zd ON rs.id = zd.server_id
      WHERE zd.server_id IS NULL
    `);
    
    if (noDefaults.length > 0) {
      console.log(`\n⚠️  Servers without ZORP defaults:`);
      noDefaults.forEach(server => {
        console.log(`  - ${server.nickname}`);
      });
    } else {
      console.log(`\n✅ All servers have ZORP defaults configured`);
    }
    
    // 5. Check for orphaned records across ALL tables
    const [orphanedEconomy] = await pool.query(`
      SELECT COUNT(*) as count FROM economy e
      LEFT JOIN players p ON e.player_id = p.id
      WHERE p.id IS NULL
    `);
    
    const [orphanedZones] = await pool.query(`
      SELECT COUNT(*) as count FROM zorp_zones z
      LEFT JOIN rust_servers rs ON z.server_id = rs.id
      WHERE rs.id IS NULL
    `);
    
    console.log(`\n🧹 Orphaned Records:`);
    console.log(`  - Economy records: ${orphanedEconomy[0].count}`);
    console.log(`  - ZORP zones: ${orphanedZones[0].count}`);
    
    // 6. Summary and recommendations
    console.log(`\n📋 Universal Maintenance Summary:`);
    console.log(`  - Total servers: ${allServers.length}`);
    console.log(`  - Invalid ZORP zones: ${invalidZorps[0].count}`);
    console.log(`  - Servers with invalid colors: ${invalidDefaults.length}`);
    console.log(`  - Servers without defaults: ${noDefaults.length}`);
    console.log(`  - Orphaned economy records: ${orphanedEconomy[0].count}`);
    console.log(`  - Orphaned ZORP zones: ${orphanedZones[0].count}`);
    
    if (invalidZorps[0].count > 0 || invalidDefaults.length > 0 || orphanedEconomy[0].count > 0 || orphanedZones[0].count > 0) {
      console.log(`\n🔧 Run 'mysql -u zentro_user -p zentro_bot < universal_zorp_fix.sql' to fix these issues`);
    } else {
      console.log(`\n🎉 All systems are healthy across ALL servers!`);
    }
    
  } catch (error) {
    console.error('❌ Error during universal maintenance:', error);
  } finally {
    await pool.end();
  }
}

universalMaintenance();