const pool = require('./src/db');

async function updateRconPassword() {
  try {
    console.log('🔧 Updating RCON Password...');

    // Update the RCON password for the server
    const [result] = await pool.query(
      'UPDATE rust_servers SET rcon_password = ? WHERE id = ?',
      ['JPMGiS0u', '1753965211295_c5pfupu9']
    );

    console.log(`Updated ${result.affectedRows} server record(s)`);

    // Verify the fix
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, rcon_password FROM rust_servers WHERE id = ?',
      ['1753965211295_c5pfupu9']
    );

    if (servers.length > 0) {
      const server = servers[0];
      console.log(`\n✅ Server Configuration:`);
      console.log(`   ID: ${server.id}`);
      console.log(`   Nickname: ${server.nickname}`);
      console.log(`   IP: ${server.ip}`);
      console.log(`   Port: ${server.port}`);
      console.log(`   RCON Password: ${server.rcon_password ? '***SET***' : 'NOT SET'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

updateRconPassword(); 