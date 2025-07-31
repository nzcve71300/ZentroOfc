const mysql = require('mysql2/promise');
const config = require('./src/config');

async function checkZorpDefaults() {
  console.log('🔍 Checking ZORP defaults in database...');
  
  try {
    // Create connection pool
    const pool = mysql.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      port: config.db.port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('✅ Database connection successful');

    // Check if zorp_defaults table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'zorp_defaults'");
    if (tables.length === 0) {
      console.log('❌ zorp_defaults table does not exist');
      return;
    }

    console.log('✅ zorp_defaults table exists');

    // Get all defaults
    const [defaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log(`📋 Found ${defaults.length} default records:`);
    
    for (const defaultRecord of defaults) {
      console.log(`  - Server ID: ${defaultRecord.server_id}`);
      console.log(`    Size: ${defaultRecord.size}`);
      console.log(`    Color Online: ${defaultRecord.color_online}`);
      console.log(`    Color Offline: ${defaultRecord.color_offline}`);
      console.log(`    Radiation: ${defaultRecord.radiation}`);
      console.log(`    Delay: ${defaultRecord.delay}`);
      console.log(`    Expire: ${defaultRecord.expire}`);
      console.log(`    Min Team: ${defaultRecord.min_team}`);
      console.log(`    Max Team: ${defaultRecord.max_team}`);
      console.log('');
    }

    // Check specific server (Rise 3x)
    const [serverResult] = await pool.query(`
      SELECT rs.id, rs.nickname, g.discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      WHERE g.discord_id = '1391149977434329230' AND rs.nickname = 'Rise 3x'
    `);

    if (serverResult.length > 0) {
      const serverId = serverResult[0].id;
      console.log(`🔍 Checking defaults for server ID: ${serverId} (Rise 3x)`);
      
      const [serverDefaults] = await pool.query(
        'SELECT * FROM zorp_defaults WHERE server_id = ?',
        [serverId]
      );

      if (serverDefaults.length > 0) {
        console.log('✅ Found defaults for Rise 3x:');
        console.log(`  Size: ${serverDefaults[0].size}`);
        console.log(`  Color Online: ${serverDefaults[0].color_online}`);
        console.log(`  Color Offline: ${serverDefaults[0].color_offline}`);
      } else {
        console.log('❌ No defaults found for Rise 3x');
        console.log('💡 You need to use /edit-zorp to set defaults for this server');
      }
    } else {
      console.log('❌ Rise 3x server not found in database');
    }

    await pool.end();
    console.log('✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error checking ZORP defaults:', error);
  }
}

checkZorpDefaults(); 