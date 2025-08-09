const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMissingGuild() {
  console.log('🚨 EMERGENCY: FIX MISSING GUILD');
  console.log('================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // The missing guild ID from your test
    const missingGuildId = '1252993829007528086';
    const guildName = 'Snowy Billiards 2x (Fixed)';

    console.log(`\n📋 ADDING MISSING GUILD: ${missingGuildId}`);
    
    // Check if it already exists
    const [existing] = await connection.execute(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [missingGuildId]
    );

    if (existing.length > 0) {
      console.log('✅ Guild already exists:', existing[0]);
    } else {
      // Add the missing guild
      await connection.execute(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        [missingGuildId, guildName]
      );
      console.log(`✅ Added missing guild: ${missingGuildId} - ${guildName}`);
    }

    // Now we need to link this guild to a server
    // Let's see which server should belong to this guild
    console.log('\n📋 CURRENT GUILD-SERVER RELATIONSHIPS:');
    
    const [relationships] = await connection.execute(`
      SELECT g.discord_id, g.name as guild_name, rs.id as server_id, rs.nickname as server_name
      FROM guilds g
      LEFT JOIN rust_servers rs ON g.id = rs.guild_id
      ORDER BY g.discord_id
    `);

    relationships.forEach((rel, index) => {
      console.log(`   ${index + 1}. Guild: ${rel.discord_id} (${rel.guild_name}) -> Server: ${rel.server_name || 'NO SERVER'}`);
    });

    // Check if there's a server that should belong to the missing guild
    console.log('\n📋 LOOKING FOR ORPHANED SERVERS...');
    
    const [servers] = await connection.execute('SELECT * FROM rust_servers');
    const [guilds] = await connection.execute('SELECT * FROM guilds');
    
    console.log('\nServers in database:');
    servers.forEach((server, index) => {
      const guild = guilds.find(g => g.id === server.guild_id);
      console.log(`   ${index + 1}. ${server.nickname} (guild_id: ${server.guild_id}) -> ${guild ? guild.name : 'GUILD NOT FOUND!'}`);
    });

    // Test the link command query again
    console.log(`\n📋 TESTING LINK COMMAND QUERY AGAIN...`);
    
    const [testServers] = await connection.execute(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [missingGuildId]
    );
    
    console.log(`✅ Query result: ${testServers.length} servers found`);
    if (testServers.length > 0) {
      testServers.forEach((server, index) => {
        console.log(`   ${index + 1}. ${server.nickname} (${server.id})`);
      });
    }

    await connection.end();

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. If no servers found, we need to link a server to the new guild');
    console.log('2. Restart the bot: pm2 restart zentro-bot');
    console.log('3. Test /link command again');

  } catch (error) {
    console.error('❌ FIX ERROR:', error.message);
    console.error(error);
  }
}

fixMissingGuild();