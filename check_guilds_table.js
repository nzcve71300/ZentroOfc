const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkGuildsTable() {
  console.log('🔍 CHECK: GUILDS TABLE STRUCTURE');
  console.log('=================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 CHECKING GUILDS TABLE STRUCTURE...\n');
    
    // Get table structure
    const [columns] = await connection.execute('DESCRIBE guilds');
    
    console.log('📊 GUILDS TABLE COLUMNS:');
    columns.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULLABLE' : 'NOT NULL'}`);
    });

    console.log('\n📋 CHECKING ACTUAL DATA IN GUILDS TABLE...\n');
    
    // Get all guilds data
    const [guilds] = await connection.execute('SELECT * FROM guilds');
    
    console.log(`📊 GUILDS DATA (${guilds.length} rows):`);
    if (guilds.length > 0) {
      guilds.forEach((guild, index) => {
        console.log(`   Row ${index + 1}:`, guild);
      });
    } else {
      console.log('   ❌ NO DATA FOUND IN GUILDS TABLE!');
    }

    console.log('\n📋 TESTING THE EXACT LINK COMMAND QUERY...\n');
    
    // Test with Snowy Billiards 2x guild ID
    const testGuildId = '1252993829007528086';
    console.log(`🔍 Testing with guild ID: ${testGuildId}`);
    
    try {
      const [servers] = await connection.execute(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [testGuildId]
      );
      
      console.log(`   ✅ Query executed successfully`);
      console.log(`   📊 Found ${servers.length} servers:`);
      
      if (servers.length > 0) {
        servers.forEach((server, index) => {
          console.log(`      ${index + 1}. ${server.nickname} (${server.id})`);
        });
      } else {
        console.log(`   ❌ NO SERVERS FOUND - This explains the /link error!`);
      }
    } catch (queryError) {
      console.log(`   ❌ Query failed: ${queryError.message}`);
    }

    await connection.end();

    console.log('\n🎯 ANALYSIS:');
    console.log('The /link command does a subquery to find guild.id from discord_id.');
    console.log('If no guild is found with that discord_id, no servers will be returned.');

  } catch (error) {
    console.error('❌ CHECK ERROR:', error.message);
    console.error(error);
  }
}

checkGuildsTable();