const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixServerName() {
  console.log('🔧 Fix Server Name');
  console.log('==================\n');

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
    console.log(`Current server: ${currentServer[0].nickname} (ID: ${currentServer[0].id})`);

    console.log('\n📋 Step 2: Updating server nickname...');
    await connection.execute(
      'UPDATE rust_servers SET nickname = ? WHERE guild_id = ?',
      ['RISE 3X', 176]
    );
    console.log('✅ Server nickname updated to "RISE 3X"');

    console.log('\n📋 Step 3: Verifying the update...');
    const [updatedServer] = await connection.execute('SELECT * FROM rust_servers WHERE guild_id = 176');
    console.log(`Updated server: ${updatedServer[0].nickname} (ID: ${updatedServer[0].id})`);

    console.log('\n📋 Step 4: Testing autocomplete query...');
    const guildId = '1391149977434329230';
    const [autocompleteResult] = await connection.execute(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [guildId, '%']
    );
    
    console.log(`Autocomplete query returned ${autocompleteResult.length} servers:`);
    for (const server of autocompleteResult) {
      console.log(`- ${server.nickname}`);
    }

    console.log('\n📋 Step 5: Testing server lookup query...');
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
    console.log('✅ Server nickname updated to "RISE 3X"');
    console.log('✅ Autocomplete now shows "RISE 3X"');
    console.log('✅ Server lookup now works for "RISE 3X"');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixServerName(); 