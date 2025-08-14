const pool = require('./src/db');

async function debugEventDetection() {
  console.log('🔍 Debugging Event Detection System...\n');

  try {
    // Check if event_configs table exists and has data
    console.log('1. Checking event_configs table...');
    const [configsResult] = await pool.query('SELECT * FROM event_configs LIMIT 10');
    console.log(`Found ${configsResult.length} event configurations:`);
    
    if (configsResult.length > 0) {
      configsResult.forEach((config, index) => {
        console.log(`  ${index + 1}. Server ID: ${config.server_id}, Event: ${config.event_type}, Enabled: ${config.enabled}`);
        console.log(`     Kill Message: ${config.kill_message}`);
        console.log(`     Respawn Message: ${config.respawn_message}`);
      });
    } else {
      console.log('  No event configurations found!');
    }

    // Check servers with event configurations
    console.log('\n2. Checking servers with event configurations...');
    const [serversResult] = await pool.query(`
      SELECT 
        rs.id, rs.nickname, rs.ip, rs.port, 
        g.discord_id as guild_id,
        ec.event_type, ec.enabled
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      LEFT JOIN event_configs ec ON rs.id = ec.server_id 
      WHERE ec.enabled = TRUE
    `);

    console.log(`Found ${serversResult.length} servers with enabled events:`);
    serversResult.forEach((server, index) => {
      console.log(`  ${index + 1}. ${server.nickname} (${server.ip}:${server.port}) - ${server.event_type}`);
    });

    // Check all servers
    console.log('\n3. Checking all servers...');
    const [allServersResult] = await pool.query(`
      SELECT 
        rs.id, rs.nickname, rs.ip, rs.port, 
        g.discord_id as guild_id
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      LIMIT 10
    `);

    console.log(`Found ${allServersResult.length} total servers:`);
    allServersResult.forEach((server, index) => {
      console.log(`  ${index + 1}. ${server.nickname} (${server.ip}:${server.port})`);
    });

    // Check guilds
    console.log('\n4. Checking guilds...');
    const [guildsResult] = await pool.query('SELECT id, discord_id, name FROM guilds LIMIT 5');
    console.log(`Found ${guildsResult.length} guilds:`);
    guildsResult.forEach((guild, index) => {
      console.log(`  ${index + 1}. ${guild.name} (Discord ID: ${guild.discord_id})`);
    });

    console.log('\n✅ Event detection debug completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Make sure you have configured events using /set-events');
    console.log('2. Check that events are enabled (bradscout/heliscout = on)');
    console.log('3. Verify RCON connection is working');
    console.log('4. Check bot logs for [EVENT] messages');

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await pool.end();
  }
}

debugEventDetection();
