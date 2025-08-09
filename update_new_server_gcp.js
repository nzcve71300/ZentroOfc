const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateNewServer() {
  console.log('🔧 Update New Server Configuration (GCP)');
  console.log('==========================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking for server with IP 81.0.247.39...');
    const [existingServer] = await connection.execute(
      'SELECT * FROM rust_servers WHERE ip = ?',
      ['81.0.247.39']
    );

    if (existingServer.length > 0) {
      const server = existingServer[0];
      console.log('✅ Found existing server:');
      console.log(`   ID: ${server.id}`);
      console.log(`   Guild ID: ${server.guild_id}`);
      console.log(`   Nickname: ${server.nickname}`);
      console.log(`   Current IP: ${server.ip}`);
      console.log(`   Current Port: ${server.port}`);
      console.log(`   Current Password: ${server.password}`);

      // Check what needs updating
      const needsPortUpdate = server.port !== 29816;
      const needsPasswordUpdate = server.password !== 'UNeyTVw';

      if (needsPortUpdate || needsPasswordUpdate) {
        console.log('\n📝 Updating server configuration...');
        
        await connection.execute(
          'UPDATE rust_servers SET port = ?, password = ? WHERE ip = ?',
          [29816, 'UNeyTVw', '81.0.247.39']
        );
        
        console.log('✅ Server updated successfully!');
        
        // Verify the update
        const [updatedServer] = await connection.execute(
          'SELECT * FROM rust_servers WHERE ip = ?',
          ['81.0.247.39']
        );
        
        console.log('\n🔍 Updated server details:');
        console.log(`   IP: ${updatedServer[0].ip}`);
        console.log(`   Port: ${updatedServer[0].port}`);
        console.log(`   Password: ${updatedServer[0].password}`);
      } else {
        console.log('\n✅ Server configuration is already correct!');
      }
    } else {
      console.log('❌ No server found with IP 81.0.247.39');
      console.log('\n📝 This looks like a completely new server that needs to be added.');
      console.log('   You may need to add it through your Discord bot setup process.');
    }

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Server IP: 81.0.247.39');
    console.log('✅ Server Port: 29816');
    console.log('✅ RCON Password: UNeyTVw');

    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Restart the bot to refresh RCON connections:');
    console.log('   pm2 stop zentro-bot');
    console.log('   pm2 start zentro-bot');
    console.log('2. Check bot logs for connection status:');
    console.log('   pm2 logs zentro-bot');

    await connection.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

updateNewServer();