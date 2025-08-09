const mysql = require('mysql2/promise');
require('dotenv').config();

async function liveLinkDebug() {
  console.log('🔍 LIVE /LINK COMMAND DEBUG');
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

    // Test ALL possible scenarios that could cause "No servers found"
    
    console.log('\n📋 SCENARIO 1: Testing exact /link command logic...\n');
    
    const testGuilds = [
      { name: 'Snowy Billiards 2x', id: '1379533411009560626' },
      { name: 'Emperor 3x', id: '1342235198175182921' },
      { name: 'Rise 3x', id: '1391149977434329230' },
      { name: 'Shadows 3x', id: '1391209638308872254' }
    ];

    for (const guild of testGuilds) {
      console.log(`🔍 Testing: ${guild.name} (${guild.id})`);
      
      // Step 1: Check if guild exists
      const [guildCheck] = await connection.execute(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [guild.id]
      );
      
      if (guildCheck.length === 0) {
        console.log(`   ❌ GUILD NOT FOUND in database!`);
        continue;
      }
      
      console.log(`   ✅ Guild found: internal ID ${guildCheck[0].id}`);
      
      // Step 2: Check servers for this guild
      const [servers] = await connection.execute(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = ? ORDER BY nickname',
        [guildCheck[0].id]
      );
      
      console.log(`   📊 Direct guild_id query: ${servers.length} servers`);
      
      // Step 3: Test the exact subquery from link command
      const [subqueryServers] = await connection.execute(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guild.id]
      );
      
      console.log(`   📊 Subquery (link command): ${subqueryServers.length} servers`);
      
      if (servers.length !== subqueryServers.length) {
        console.log(`   ⚠️ MISMATCH! Direct query vs subquery results differ!`);
      }
      
      if (subqueryServers.length > 0) {
        console.log(`   ✅ /link should work - servers found:`);
        subqueryServers.forEach(server => {
          console.log(`      - ${server.nickname} (${server.id})`);
        });
      } else {
        console.log(`   ❌ /link will fail - no servers found`);
      }
      
      console.log('');
    }

    console.log('\n📋 SCENARIO 2: Check for data type issues...\n');
    
    // Check data types
    const [guildColumns] = await connection.execute(
      "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'guilds' AND COLUMN_NAME IN ('id', 'discord_id')"
    );
    
    console.log('Guilds table column info:');
    guildColumns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME}: ${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH || 'N/A'})`);
    });

    const [serverColumns] = await connection.execute(
      "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'rust_servers' AND COLUMN_NAME = 'guild_id'"
    );
    
    console.log('\nRust_servers table guild_id info:');
    serverColumns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });

    console.log('\n📋 SCENARIO 3: Check for recent bot logs/errors...\n');
    
    // Let's also check if there are any constraint issues
    try {
      const [constraints] = await connection.execute(`
        SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_NAME IN ('guilds', 'rust_servers') 
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      `);
      
      console.log('Foreign key constraints:');
      constraints.forEach(constraint => {
        console.log(`   ${constraint.CONSTRAINT_NAME}: ${constraint.CONSTRAINT_TYPE}`);
      });
    } catch (e) {
      console.log('No foreign key info available');
    }

    await connection.end();

    console.log('\n🎯 DEBUGGING SUMMARY:');
    console.log('If all guilds show "should work" but /link still fails, then:');
    console.log('1. Bot code has a different issue (not database)');
    console.log('2. Bot is using different database credentials');
    console.log('3. Bot has cached old code/data');
    console.log('4. There\'s an error in the bot that\'s not being logged');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Watch pm2 logs in real-time while testing /link');
    console.log('2. Look for ANY error messages when /link is used');
    console.log('3. Check if bot is actually connecting to the right database');

  } catch (error) {
    console.error('❌ DEBUG ERROR:', error.message);
    console.error(error);
  }
}

liveLinkDebug();