const mysql = require('mysql2/promise');
require('dotenv').config();

async function testCorrectGuildIds() {
  console.log('🎯 TEST: CORRECT GUILD IDs');
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

    // The correct guild IDs you provided
    const correctGuilds = [
      { name: 'Snowy Billiards 2x', id: '1379533411009560626' },
      { name: 'Emperor 3x', id: '1342235198175182921' },
      { name: 'Rise 3x', id: '1391149977434329230' },
      { name: 'Shadows 3x', id: '1391209638308872254' }
    ];

    console.log('📋 TESTING /LINK COMMAND FOR ALL CORRECT GUILD IDs...\n');

    for (const guild of correctGuilds) {
      console.log(`🔍 Testing: ${guild.name} (${guild.id})`);
      
      try {
        // Test the exact link command query
        const [servers] = await connection.execute(
          'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
          [guild.id]
        );

        console.log(`   ✅ Query executed successfully`);
        console.log(`   📊 Found ${servers.length} servers:`);
        
        if (servers.length > 0) {
          servers.forEach((server, index) => {
            console.log(`      ${index + 1}. ${server.nickname} (${server.id})`);
          });
          console.log(`   ✅ /link command SHOULD WORK for ${guild.name}`);
        } else {
          console.log(`   ❌ /link command WILL FAIL for ${guild.name} - No servers found`);
        }
        
      } catch (queryError) {
        console.log(`   ❌ Query failed: ${queryError.message}`);
      }
      
      console.log(''); // Empty line for readability
    }

    // Check what's actually in the database
    console.log('📋 CURRENT DATABASE STATE...\n');
    
    const [dbGuilds] = await connection.execute('SELECT * FROM guilds ORDER BY discord_id');
    console.log('📊 GUILDS IN DATABASE:');
    dbGuilds.forEach((guild, index) => {
      console.log(`   ${index + 1}. ${guild.discord_id} -> ${guild.name} (internal ID: ${guild.id})`);
    });

    console.log('\n📊 SERVERS IN DATABASE:');
    const [dbServers] = await connection.execute(`
      SELECT rs.id, rs.nickname, rs.guild_id, g.discord_id, g.name as guild_name
      FROM rust_servers rs
      LEFT JOIN guilds g ON rs.guild_id = g.id
      ORDER BY rs.nickname
    `);
    
    dbServers.forEach((server, index) => {
      console.log(`   ${index + 1}. ${server.nickname} -> Guild: ${server.guild_name} (${server.discord_id})`);
    });

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('This shows exactly which guild IDs will work with /link and which won\'t.');
    console.log('If a guild shows "SHOULD WORK", the /link command should work there.');
    console.log('If it shows "WILL FAIL", that guild needs to be fixed in the database.');

  } catch (error) {
    console.error('❌ TEST ERROR:', error.message);
    console.error(error);
  }
}

testCorrectGuildIds();