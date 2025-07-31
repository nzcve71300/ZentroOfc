const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRconPassword() {
  console.log('🔧 Check RCON Password');
  console.log('======================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking current RCON password...');
    const [serverResult] = await connection.execute('SELECT * FROM rust_servers WHERE guild_id = 176');
    const server = serverResult[0];
    
    console.log('Current server data:');
    console.log(`- Nickname: ${server.nickname}`);
    console.log(`- IP: ${server.ip}`);
    console.log(`- Port: ${server.port}`);
    console.log(`- Password: ${server.password}`);

    console.log('\n📋 Step 2: Updating RCON password...');
    const correctPassword = 'JPMGiS0u'; // The password you provided
    
    await connection.execute(
      'UPDATE rust_servers SET password = ? WHERE guild_id = ?',
      [correctPassword, 176]
    );
    console.log('✅ RCON password updated to: JPMGiS0u');

    console.log('\n📋 Step 3: Verifying the update...');
    const [updatedServer] = await connection.execute('SELECT * FROM rust_servers WHERE guild_id = 176');
    console.log('Updated server data:');
    console.log(`- Nickname: ${updatedServer[0].nickname}`);
    console.log(`- IP: ${updatedServer[0].ip}`);
    console.log(`- Port: ${updatedServer[0].port}`);
    console.log(`- Password: ${updatedServer[0].password}`);

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ RCON password updated to JPMGiS0u');
    console.log('✅ Server IP: 149.102.132.219:30216');
    console.log('✅ Server nickname: RISE 3X');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRconPassword(); 