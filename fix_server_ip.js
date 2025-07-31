const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixServerIP() {
  console.log('🔧 Fix Server IP');
  console.log('================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking current server...');
    const [currentServer] = await connection.execute('SELECT * FROM rust_servers WHERE guild_id = 176');
    console.log(`Current server: ${currentServer[0].nickname} (IP: ${currentServer[0].ip}:${currentServer[0].port})`);

    console.log('\n📋 Step 2: Updating server IP and port...');
    await connection.execute(
      'UPDATE rust_servers SET ip = ?, port = ? WHERE guild_id = ?',
      ['149.102.132.219', 30216, 176]
    );
    console.log('✅ Server IP updated to 149.102.132.219:30216');

    console.log('\n📋 Step 3: Verifying the update...');
    const [updatedServer] = await connection.execute('SELECT * FROM rust_servers WHERE guild_id = 176');
    console.log(`Updated server: ${updatedServer[0].nickname} (IP: ${updatedServer[0].ip}:${updatedServer[0].port})`);

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Server IP updated to 149.102.132.219');
    console.log('✅ Server port updated to 30216');
    console.log('✅ RCON connection should now work');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixServerIP(); 