const pool = require('./src/db');

async function fixServerConfig() {
  try {
    console.log('🔧 Fixing Server Configuration...');

    // Update the server with correct nickname and IP
    const [result] = await pool.query(
      'UPDATE rust_servers SET nickname = ?, ip = ?, port = ? WHERE id = ?',
      ['Rise 3x', '149.102.132.219', 30216, '1753965211295_c5pfupu9']
    );

    console.log(`Updated ${result.affectedRows} server record(s)`);

    // Verify the fix
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE id = ?',
      ['1753965211295_c5pfupu9']
    );

    if (servers.length > 0) {
      const server = servers[0];
      console.log(`\n✅ Server Configuration Updated:`);
      console.log(`   ID: ${server.id}`);
      console.log(`   Nickname: ${server.nickname}`);
      console.log(`   IP: ${server.ip}`);
      console.log(`   Port: ${server.port}`);
      console.log(`   Guild ID: ${server.guild_id}`);
    }

    // Check guild configuration
    const [guilds] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      ['1391149977434329230']
    );

    if (guilds.length > 0) {
      console.log(`\n📋 Guild Configuration:`);
      console.log(`   ID: ${guilds[0].id}`);
      console.log(`   Discord ID: ${guilds[0].discord_id}`);
      console.log(`   Name: ${guilds[0].name}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixServerConfig(); 