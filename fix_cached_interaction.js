const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCachedInteraction() {
  console.log('🔧 FIX: CACHED INTERACTION ISSUE');
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

    console.log('\n📋 THE PROBLEM:');
    console.log('You have a cached /link interaction from guild 1252993829007528086');
    console.log('This keeps getting triggered even though you\'re in the correct server');
    console.log('The cached interaction tries to use the deleted guild, causing failures');
    
    console.log('\n🔧 SOLUTION: Temporarily add the guild back so cached interaction can complete');
    
    const problemGuildId = '1252993829007528086';
    const correctGuildId = '1379533411009560626';
    
    // Check if problem guild exists
    const [existing] = await connection.execute(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [problemGuildId]
    );

    if (existing.length === 0) {
      console.log(`Adding temporary guild: ${problemGuildId}`);
      
      // Get the internal ID of the correct guild
      const [correctGuild] = await connection.execute(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [correctGuildId]
      );
      
      if (correctGuild.length > 0) {
        // Add the problem guild temporarily
        await connection.execute(
          'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
          [problemGuildId, 'TEMP - Cached Interaction Fix']
        );
        
        // Get the new guild's internal ID
        const [newGuild] = await connection.execute(
          'SELECT id FROM guilds WHERE discord_id = ?',
          [problemGuildId]
        );
        
        // Link it to the same server as the correct guild
        await connection.execute(
          'UPDATE rust_servers SET guild_id = ? WHERE guild_id = ?',
          [newGuild[0].id, correctGuild[0].id]
        );
        
        console.log(`✅ Temporarily added guild ${problemGuildId}`);
        console.log(`✅ Linked it to the same server as ${correctGuildId}`);
      }
    } else {
      console.log(`Guild ${problemGuildId} already exists`);
    }

    console.log('\n📋 CURRENT GUILD-SERVER MAPPING:');
    const [mapping] = await connection.execute(`
      SELECT g.discord_id, g.name, rs.nickname as server_name
      FROM guilds g
      LEFT JOIN rust_servers rs ON g.id = rs.guild_id
      ORDER BY g.discord_id
    `);
    
    mapping.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.discord_id} (${row.name}) -> ${row.server_name || 'NO SERVER'}`);
    });

    await connection.end();

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. The cached interaction should now work');
    console.log('3. Try a fresh /link command in the correct server');
    console.log('4. Both should work now');

  } catch (error) {
    console.error('❌ FIX ERROR:', error.message);
    console.error(error);
  }
}

fixCachedInteraction();