const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkNewServer() {
  console.log('🔧 Check New Server Configuration');
  console.log('==================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking all servers in database...');
    const [servers] = await connection.execute('SELECT * FROM rust_servers');
    
    console.log(`Found ${servers.length} servers:`);
    servers.forEach((server, index) => {
      console.log(`\n${index + 1}. Server Details:`);
      console.log(`   ID: ${server.id}`);
      console.log(`   Guild ID: ${server.guild_id}`);
      console.log(`   Nickname: ${server.nickname}`);
      console.log(`   IP: ${server.ip}`);
      console.log(`   Port: ${server.port}`);
      console.log(`   Password: ${server.password}`);
    });

    console.log('\n📋 Step 2: Looking for server with IP 81.0.247.39...');
    const [targetServer] = await connection.execute(
      'SELECT * FROM rust_servers WHERE ip = ?',
      ['81.0.247.39']
    );

    if (targetServer.length > 0) {
      console.log('✅ Found server with matching IP:');
      const server = targetServer[0];
      console.log(`   Nickname: ${server.nickname}`);
      console.log(`   IP: ${server.ip}`);
      console.log(`   Port: ${server.port} (Expected: 29816)`);
      console.log(`   Password: ${server.password} (Expected: UNeyTVw)`);
      
      // Check if details match
      const portMatches = server.port === 29816;
      const passwordMatches = server.password === 'UNeyTVw';
      
      console.log('\n🔍 Verification Results:');
      console.log(`   Port matches: ${portMatches ? '✅' : '❌'}`);
      console.log(`   Password matches: ${passwordMatches ? '✅' : '❌'}`);
      
      if (!portMatches || !passwordMatches) {
        console.log('\n⚠️ CONFIGURATION MISMATCH DETECTED!');
        console.log('   The server exists but has incorrect details.');
        console.log('\n📝 Would you like to update the server with:');
        console.log('   IP: 81.0.247.39');
        console.log('   Port: 29816');
        console.log('   Password: UNeyTVw');
      } else {
        console.log('\n✅ ALL DETAILS MATCH! Server should connect properly.');
      }
    } else {
      console.log('❌ No server found with IP 81.0.247.39');
      console.log('\n📝 This server needs to be added to the database with:');
      console.log('   IP: 81.0.247.39');
      console.log('   Port: 29816');
      console.log('   Password: UNeyTVw');
    }

    await connection.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkNewServer();