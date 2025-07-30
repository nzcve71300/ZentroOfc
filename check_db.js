const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  let connection;
  
  try {
    console.log('🔍 Checking database contents...\n');
    
    // Create connection using the same config as your bot
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Connected to database successfully!\n');

    // Check channel settings
    console.log('📋 Channel Settings:');
    const [channelSettings] = await connection.execute(`
      SELECT cs.*, rs.nickname, g.discord_id, g.name as guild_name
      FROM channel_settings cs
      JOIN rust_servers rs ON cs.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
    `);

    if (channelSettings.length === 0) {
      console.log('❌ No channel settings found!');
    } else {
      channelSettings.forEach(setting => {
        console.log(`   - ${setting.guild_name}: ${setting.nickname} -> ${setting.channel_type} (${setting.channel_id})`);
      });
    }

    console.log('\n📋 Servers:');
    const [servers] = await connection.execute(`
      SELECT rs.*, g.discord_id, g.name as guild_name
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
    `);

    servers.forEach(server => {
      console.log(`   - ${server.guild_name}: ${server.nickname} (${server.ip}:${server.port})`);
    });

    console.log('\n📋 Guilds:');
    const [guilds] = await connection.execute('SELECT * FROM guilds');
    guilds.forEach(guild => {
      console.log(`   - ${guild.name} (${guild.discord_id})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkDatabase(); 