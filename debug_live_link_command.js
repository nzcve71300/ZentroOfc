const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugLiveLinkCommand() {
  console.log('🔧 DEBUG LIVE LINK COMMAND');
  console.log('===========================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    const guildId = '1379533411009560626'; // Snowy Billiards 2x from Discord
    
    console.log('\n📋 TESTING EXACT LINK COMMAND LOGIC...');
    console.log(`Using guildId: ${guildId}`);

    // Test with pool.query (what the link command uses)
    console.log('\n1. Testing with pool.query (like link command):');
    try {
      const [servers] = await connection.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
      );
      
      console.log(`   pool.query result: ${servers.length} servers`);
      servers.forEach(server => {
        console.log(`      - ${server.nickname} (${server.id})`);
      });
      
      if (servers.length === 0) {
        console.log('   ❌ This explains why link command fails!');
      }
    } catch (queryError) {
      console.log('   ❌ pool.query failed:', queryError.message);
    }

    // Test with pool.execute (what our diagnostics use)
    console.log('\n2. Testing with pool.execute (like diagnostics):');
    try {
      const [servers] = await connection.execute(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
      );
      
      console.log(`   pool.execute result: ${servers.length} servers`);
      servers.forEach(server => {
        console.log(`      - ${server.nickname} (${server.id})`);
      });
    } catch (executeError) {
      console.log('   ❌ pool.execute failed:', executeError.message);
    }

    // Check if there's a data type issue
    console.log('\n3. Testing data type handling:');
    
    // Test with string
    const [stringTest] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [guildId.toString()]
    );
    console.log(`   String test: ${stringTest.length} servers`);
    
    // Test with number
    const [numberTest] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [parseInt(guildId)]
    );
    console.log(`   Number test: ${numberTest.length} servers`);

    // Test what Discord actually sends
    console.log('\n4. Testing Discord interaction.guildId format:');
    console.log(`   Type of guildId: ${typeof guildId}`);
    console.log(`   Value: ${guildId}`);
    console.log(`   As string: "${guildId}"`);
    console.log(`   As number: ${parseInt(guildId)}`);

    // Check the database value type
    const [guildCheck] = await connection.execute(
      'SELECT discord_id, TYPEOF(discord_id) as type_name FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildCheck.length > 0) {
      console.log(`   Database discord_id: ${guildCheck[0].discord_id}`);
      console.log(`   Database type: ${guildCheck[0].type_name || 'unknown'}`);
    }

    await connection.end();

    console.log('\n🎯 DEBUG COMPLETE!');
    console.log('This should show us why the link command fails while diagnostics work.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

debugLiveLinkCommand();