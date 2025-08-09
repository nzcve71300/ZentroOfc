const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugLinkCommandExecution() {
  console.log('🔍 DEBUG: /LINK COMMAND EXECUTION');
  console.log('=====================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Test the exact query from the link command for different guild IDs
    const testGuilds = [
      { name: 'Snowy Billiards 2x', id: '1252993829007528086' },
      { name: 'Test Guild 1', id: '1342235198175182921' },
      { name: 'Test Guild 2', id: '1391149977434329230' },
      { name: 'Test Guild 3', id: '1391209638308872254' },
      { name: 'Test Guild 4', id: '1379533411009560626' }
    ];

    console.log('📋 TESTING EXACT /LINK COMMAND QUERY FOR EACH GUILD...\n');

    for (const guild of testGuilds) {
      console.log(`🔍 Testing Guild: ${guild.name} (${guild.id})`);
      
      try {
        // This is the EXACT query from src/commands/player/link.js line 23-26
        const [servers] = await connection.execute(
          'SELECT server_id, server_name FROM rust_servers WHERE guild_id = ?',
          [guild.id]
        );

        console.log(`   ✅ Query executed successfully`);
        console.log(`   📊 Found ${servers.length} servers:`);
        
        if (servers.length > 0) {
          servers.forEach((server, index) => {
            console.log(`      ${index + 1}. ${server.server_name} (${server.server_id})`);
          });
        } else {
          console.log(`   ❌ NO SERVERS FOUND - This explains the error!`);
        }
        
      } catch (queryError) {
        console.log(`   ❌ Query failed: ${queryError.message}`);
      }
      
      console.log(''); // Empty line for readability
    }

    // Also check what's in the rust_servers table
    console.log('📋 CHECKING ALL SERVERS IN DATABASE...\n');
    const [allServers] = await connection.execute(
      'SELECT guild_id, server_id, server_name FROM rust_servers ORDER BY guild_id'
    );

    console.log(`📊 Total servers in database: ${allServers.length}`);
    allServers.forEach((server, index) => {
      console.log(`   ${index + 1}. Guild: ${server.guild_id} | Server: ${server.server_name} (${server.server_id})`);
    });

    // Check if there are any data type mismatches
    console.log('\n📋 CHECKING DATA TYPES...\n');
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'rust_servers' AND COLUMN_NAME = 'guild_id'"
    );
    
    console.log('guild_id column info:', columns[0]);

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('This will show exactly which guilds have servers and which don\'t.');
    console.log('If a guild shows "NO SERVERS FOUND", that\'s why /link fails for that guild.');

  } catch (error) {
    console.error('❌ DEBUG ERROR:', error.message);
    console.error(error);
  }
}

debugLinkCommandExecution();