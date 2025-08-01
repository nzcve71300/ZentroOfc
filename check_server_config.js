const pool = require('./src/db');

async function checkServerConfig() {
  try {
    console.log('🔍 Checking Server Configuration...');

    // Check all servers
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    console.log(`Found ${servers.length} server(s):`);
    
    servers.forEach((server, index) => {
      console.log(`\n${index + 1}. Server:`);
      console.log(`   ID: ${server.id}`);
      console.log(`   Nickname: ${server.nickname}`);
      console.log(`   IP: ${server.ip}`);
      console.log(`   Port: ${server.port}`);
      console.log(`   Guild ID: ${server.guild_id}`);
    });

    // Check guilds
    const [guilds] = await pool.query('SELECT * FROM guilds');
    console.log(`\n📋 Found ${guilds.length} guild(s):`);
    
    guilds.forEach((guild, index) => {
      console.log(`\n${index + 1}. Guild:`);
      console.log(`   ID: ${guild.id}`);
      console.log(`   Discord ID: ${guild.discord_id}`);
      console.log(`   Name: ${guild.name}`);
    });

    // Check if Rise 3x server exists
    const [riseServer] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ?',
      ['Rise 3x']
    );

    if (riseServer.length > 0) {
      console.log(`\n✅ Rise 3x server found:`);
      console.log(`   ID: ${riseServer[0].id}`);
      console.log(`   IP: ${riseServer[0].ip}`);
      console.log(`   Port: ${riseServer[0].port}`);
      console.log(`   Guild ID: ${riseServer[0].guild_id}`);
    } else {
      console.log(`\n❌ Rise 3x server NOT found!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkServerConfig(); 