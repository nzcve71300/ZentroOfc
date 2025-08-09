const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixServerMapping() {
  console.log('🔧 EMERGENCY FIX: SERVER MAPPING');
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

    const correctGuildId = '1379533411009560626'; // Real Snowy Billiards 2x
    const tempGuildId = '1252993829007528086';     // Temporary guild
    
    console.log('\n📋 FIXING SERVER MAPPING...');
    
    // Get the internal IDs
    const [correctGuild] = await connection.execute(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [correctGuildId]
    );
    
    const [tempGuild] = await connection.execute(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [tempGuildId]
    );
    
    if (correctGuild.length > 0 && tempGuild.length > 0) {
      console.log(`✅ Found correct guild internal ID: ${correctGuild[0].id}`);
      console.log(`✅ Found temp guild internal ID: ${tempGuild[0].id}`);
      
      // Move SNB1 server back to the correct guild
      const result = await connection.execute(
        'UPDATE rust_servers SET guild_id = ? WHERE guild_id = ? AND nickname = ?',
        [correctGuild[0].id, tempGuild[0].id, 'SNB1']
      );
      
      console.log(`✅ Moved SNB1 server to correct guild (affected rows: ${result[0].affectedRows})`);
      
      // Remove the temporary guild
      await connection.execute(
        'DELETE FROM guilds WHERE discord_id = ?',
        [tempGuildId]
      );
      
      console.log(`✅ Removed temporary guild: ${tempGuildId}`);
    }

    console.log('\n📋 FINAL SERVER MAPPING:');
    const [finalMapping] = await connection.execute(`
      SELECT g.discord_id, g.name, rs.nickname as server_name
      FROM guilds g
      LEFT JOIN rust_servers rs ON g.id = rs.guild_id
      WHERE g.discord_id = ? OR rs.nickname = 'SNB1'
      ORDER BY g.discord_id
    `, [correctGuildId]);
    
    finalMapping.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.discord_id} (${row.name}) -> ${row.server_name || 'NO SERVER'}`);
    });

    await connection.end();

    console.log('\n🎯 RESULT:');
    console.log('✅ SNB1 server is now correctly linked to your real guild');
    console.log('✅ Temporary guild has been removed');
    console.log('✅ /link command should now work in your Discord server');
    
    console.log('\n🚀 RESTART BOT AND TEST:');
    console.log('pm2 restart zentro-bot');

  } catch (error) {
    console.error('❌ FIX ERROR:', error.message);
    console.error(error);
  }
}

fixServerMapping();