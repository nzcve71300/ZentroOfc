const mysql = require('mysql2/promise');
require('dotenv').config();

async function forceServerFix() {
  console.log('🔧 Force Server Fix');
  console.log('===================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking current server data...');
    const [currentServer] = await connection.execute('SELECT * FROM rust_servers WHERE guild_id = 176');
    console.log('Current server data:');
    console.log(`- ID: ${currentServer[0].id}`);
    console.log(`- Nickname: ${currentServer[0].nickname}`);
    console.log(`- IP: ${currentServer[0].ip}`);
    console.log(`- Port: ${currentServer[0].port}`);
    console.log(`- Guild ID: ${currentServer[0].guild_id}`);

    console.log('\n📋 Step 2: Checking guild data...');
    const [guildData] = await connection.execute('SELECT * FROM guilds WHERE id = 176');
    console.log('Guild data:');
    console.log(`- ID: ${guildData[0].id}`);
    console.log(`- Discord ID: ${guildData[0].discord_id}`);
    console.log(`- Name: ${guildData[0].name}`);

    console.log('\n📋 Step 3: Force updating server IP and port...');
    await connection.execute(
      'UPDATE rust_servers SET ip = ?, port = ? WHERE guild_id = ?',
      ['149.102.132.219', 30216, 176]
    );
    console.log('✅ Server IP updated to 149.102.132.219:30216');

    console.log('\n📋 Step 4: Verifying the update...');
    const [updatedServer] = await connection.execute('SELECT * FROM rust_servers WHERE guild_id = 176');
    console.log('Updated server data:');
    console.log(`- ID: ${updatedServer[0].id}`);
    console.log(`- Nickname: ${updatedServer[0].nickname}`);
    console.log(`- IP: ${updatedServer[0].ip}`);
    console.log(`- Port: ${updatedServer[0].port}`);
    console.log(`- Guild ID: ${updatedServer[0].guild_id}`);

    console.log('\n📋 Step 5: Testing RCON connection query...');
    const [rconQuery] = await connection.execute(
      'SELECT rs.* FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ?',
      ['1391149977434329230']
    );
    console.log(`RCON query returned ${rconQuery.length} servers:`);
    for (const server of rconQuery) {
      console.log(`- ${server.nickname} (${server.ip}:${server.port})`);
    }

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Server IP and port updated');
    console.log('✅ Server nickname should be "RISE 3X"');
    console.log('✅ RCON connection should now work');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceServerFix(); 