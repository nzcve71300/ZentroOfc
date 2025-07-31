const pool = require('./src/db');

async function fixRconPassword() {
  try {
    console.log('🔧 Fixing RCON password...');
    
    const correctPassword = 'JPMGiS0u';
    
    const [updateResult] = await pool.query(
      'UPDATE rust_servers SET password = ? WHERE password = ?',
      [correctPassword, 'PLACEHOLDER_PASSWORD']
    );

    console.log(`✅ Updated ${updateResult.affectedRows} server(s)`);

    // Verify the fix
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    console.log('📋 Updated servers:');
    servers.forEach((server, index) => {
      console.log(`${index + 1}. ID: ${server.id}, Nickname: ${server.nickname}, IP: ${server.ip}, Port: ${server.port}, Password: ${server.password}`);
    });

    console.log('✅ RCON password fixed!');
    console.log('🔄 Restart the bot with: pm2 restart zentro-bot');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing RCON password:', error);
    process.exit(1);
  }
}

fixRconPassword(); 