const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugInteractionGuildId() {
  console.log('🔍 DEBUG: INTERACTION GUILD ID MISMATCH');
  console.log('========================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 ANALYSIS OF THE PROBLEM:');
    console.log('You say you\'re testing in guild 1379533411009560626 (Snowy Billiards 2x)');
    console.log('But logs show: link_confirm_1252993829007528086_nzcve7130');
    console.log('This suggests the /link command was initiated in the wrong server.');
    
    console.log('\n📋 CHECKING CURRENT GUILD STATE:');
    
    const [guilds] = await connection.execute('SELECT * FROM guilds ORDER BY discord_id');
    guilds.forEach((guild, index) => {
      console.log(`   ${index + 1}. ${guild.discord_id} -> ${guild.name}`);
      if (guild.discord_id === '1252993829007528086') {
        console.log('      ❌ THIS GUILD SHOULD BE DELETED BUT STILL EXISTS!');
      }
      if (guild.discord_id === '1379533411009560626') {
        console.log('      ✅ This is the correct Snowy Billiards 2x guild');
      }
    });

    console.log('\n📋 POSSIBLE EXPLANATIONS:');
    console.log('1. You have multiple Discord servers with similar names');
    console.log('2. The /link command was started in one server but button clicked in another');
    console.log('3. There are cached interactions from the wrong server');
    console.log('4. The guild 1252993829007528086 was not properly deleted');

    console.log('\n📋 CHECKING IF DELETED GUILD STILL EXISTS:');
    const [deletedGuild] = await connection.execute(
      'SELECT * FROM guilds WHERE discord_id = ?',
      ['1252993829007528086']
    );
    
    if (deletedGuild.length > 0) {
      console.log('❌ PROBLEM: Guild 1252993829007528086 still exists in database!');
      console.log('   This explains why you\'re seeing interactions from it.');
      console.log('   Guild data:', deletedGuild[0]);
      
      console.log('\n🔧 FIXING: Deleting the problematic guild again...');
      await connection.execute(
        'DELETE FROM guilds WHERE discord_id = ?',
        ['1252993829007528086']
      );
      console.log('✅ Deleted guild 1252993829007528086');
    } else {
      console.log('✅ Guild 1252993829007528086 is properly deleted');
    }

    console.log('\n📋 FINAL GUILD LIST:');
    const [finalGuilds] = await connection.execute('SELECT * FROM guilds ORDER BY discord_id');
    finalGuilds.forEach((guild, index) => {
      console.log(`   ${index + 1}. ${guild.discord_id} -> ${guild.name}`);
    });

    await connection.end();

    console.log('\n🎯 SOLUTION:');
    console.log('1. Make sure you\'re in the RIGHT Discord server (1379533411009560626)');
    console.log('2. Restart the bot to clear any cached interactions');
    console.log('3. Try /link command fresh in the correct server');
    
    console.log('\n🚀 RESTART BOT:');
    console.log('pm2 restart zentro-bot');

  } catch (error) {
    console.error('❌ DEBUG ERROR:', error.message);
    console.error(error);
  }
}

debugInteractionGuildId();