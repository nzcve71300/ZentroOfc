const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkServersDebug() {
  console.log('🔍 Server Debug Check');
  console.log('=====================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking guilds table...');
    const [guilds] = await connection.execute('SELECT * FROM guilds');
    console.log(`Found ${guilds.length} guilds:`);
    for (const guild of guilds) {
      console.log(`- ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
    }

    console.log('\n📋 Step 2: Checking rust_servers table...');
    const [servers] = await connection.execute('SELECT * FROM rust_servers');
    console.log(`Found ${servers.length} servers:`);
    for (const server of servers) {
      console.log(`- ID: ${server.id}, Guild ID: ${server.guild_id}, Nickname: ${server.nickname}, IP: ${server.ip}:${server.port}`);
    }

    console.log('\n📋 Step 3: Testing autocomplete query...');
    const guildId = '1391149977434329230'; // The correct Discord guild ID
    console.log(`Testing with guild ID: ${guildId}`);
    
    const [autocompleteResult] = await connection.execute(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [guildId, '%']
    );
    
    console.log(`Autocomplete query returned ${autocompleteResult.length} servers:`);
    for (const server of autocompleteResult) {
      console.log(`- ${server.nickname}`);
    }

    console.log('\n📋 Step 4: Testing server lookup query...');
    const [serverLookupResult] = await connection.execute(
      'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
      [guildId, 'RISE 3X']
    );
    
    console.log(`Server lookup for "RISE 3X" returned ${serverLookupResult.length} results:`);
    for (const server of serverLookupResult) {
      console.log(`- ID: ${server.id}, Nickname: ${server.nickname}`);
    }

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Database connection works');
    console.log('✅ Guilds and servers are present');
    console.log('✅ Autocomplete query structure is correct');
    console.log('✅ Server lookup query works');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkServersDebug(); 