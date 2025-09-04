const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugDatabase() {
  console.log('🔍 DEBUGGING DATABASE STRUCTURE');
  console.log('================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    // Check what guilds exist
    console.log('📋 Checking guilds table...');
    const [guilds] = await connection.execute('SELECT * FROM guilds');
    console.log(`  Found ${guilds.length} guilds:`);
    guilds.forEach(guild => {
      console.log(`    - ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
    });

    console.log('\n📋 Checking rust_servers table...');
    const [servers] = await connection.execute('SELECT * FROM rust_servers');
    console.log(`  Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`    - ID: ${server.id}, Guild ID: ${server.guild_id}, Nickname: ${server.nickname}`);
    });

    // Check if there's a mismatch between Discord guild ID and database guild ID
    console.log('\n📋 Checking for Discord guild ID mismatch...');
    const [discordGuild] = await connection.execute(
      'SELECT * FROM guilds WHERE discord_id = ?',
      ['1387187628469653555']
    );
    
    if (discordGuild.length > 0) {
      console.log(`  ✅ Found guild with Discord ID 1387187628469653555:`);
      console.log(`    - Database ID: ${discordGuild[0].id}`);
      console.log(`    - Name: ${discordGuild[0].name}`);
      
      // Check what servers belong to this guild
      const [guildServers] = await connection.execute(
        'SELECT * FROM rust_servers WHERE guild_id = ?',
        [discordGuild[0].id]
      );
      console.log(`  📊 Found ${guildServers.length} servers for this guild:`);
      guildServers.forEach(server => {
        console.log(`    - ${server.nickname} (ID: ${server.id})`);
      });
    } else {
      console.log('  ❌ No guild found with Discord ID 1387187628469653555');
      
      // Check if the Discord ID might be stored differently
      console.log('\n📋 Checking for similar Discord IDs...');
      const [similarGuilds] = await connection.execute(
        'SELECT * FROM guilds WHERE discord_id LIKE "%1387187628469653555%" OR discord_id LIKE "%138718762%"'
      );
      if (similarGuilds.length > 0) {
        console.log('  Found similar Discord IDs:');
        similarGuilds.forEach(guild => {
          console.log(`    - ${guild.discord_id} -> ${guild.name}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the debug
debugDatabase().catch(console.error);