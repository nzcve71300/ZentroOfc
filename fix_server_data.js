const pool = require('./src/db');

async function fixServerData() {
  try {
    console.log('🔧 Fixing server data...');
    
    // First, let's see what servers exist
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    console.log('📋 Current servers in database:');
    servers.forEach((server, index) => {
      console.log(`${index + 1}. ID: ${server.id}, Nickname: ${server.nickname}, IP: ${server.ip}, Port: ${server.port}, Password: ${server.password}`);
    });

    // Update the server with correct data
    const correctServerName = 'Rise 3x';
    const correctIP = '149.102.132.219';
    const correctPort = 30216;
    const correctPassword = 'JPMGiS0u';

    const [updateResult] = await pool.query(
      'UPDATE rust_servers SET nickname = ?, ip = ?, port = ?, password = ? WHERE nickname = ? OR ip = ?',
      [correctServerName, correctIP, correctPort, correctPassword, 'Unknown Server', 'PLACEHOLDER_IP']
    );

    console.log(`✅ Updated ${updateResult.affectedRows} server(s)`);

    // Verify the fix
    const [updatedServers] = await pool.query('SELECT * FROM rust_servers');
    console.log('📋 Updated servers:');
    updatedServers.forEach((server, index) => {
      console.log(`${index + 1}. ID: ${server.id}, Nickname: ${server.nickname}, IP: ${server.ip}, Port: ${server.port}, Password: ${server.password}`);
    });

    console.log('✅ Server data fixed!');
    console.log('🔄 Restart the bot with: pm2 restart zentro-bot');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing server data:', error);
    process.exit(1);
  }
}

fixServerData(); 