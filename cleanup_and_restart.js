const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanupAndRestart() {
  console.log('🧹 CLEANUP: REMOVE DUPLICATE GUILD');
  console.log('==================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Remove the duplicate guild entry that has no servers
    const duplicateGuildId = '1252993829007528086';
    
    console.log(`📋 REMOVING DUPLICATE GUILD: ${duplicateGuildId}`);
    
    // Check if it has any servers (it shouldn't)
    const [servers] = await connection.execute(
      'SELECT * FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
      [duplicateGuildId]
    );
    
    if (servers.length > 0) {
      console.log(`⚠️ WARNING: Guild ${duplicateGuildId} has ${servers.length} servers. Not deleting.`);
      servers.forEach(server => console.log(`   - ${server.nickname}`));
    } else {
      console.log(`✅ Guild ${duplicateGuildId} has no servers. Safe to delete.`);
      
      await connection.execute(
        'DELETE FROM guilds WHERE discord_id = ?',
        [duplicateGuildId]
      );
      
      console.log(`✅ Deleted duplicate guild: ${duplicateGuildId}`);
    }

    // Final verification - show clean state
    console.log('\n📋 FINAL GUILD STATE:');
    const [finalGuilds] = await connection.execute('SELECT discord_id, name FROM guilds ORDER BY name');
    finalGuilds.forEach((guild, index) => {
      console.log(`   ${index + 1}. ${guild.discord_id} -> ${guild.name}`);
    });

    await connection.end();

    console.log('\n🎯 CLEANUP COMPLETE!');
    console.log('✅ Database is clean');
    console.log('✅ All 4 guild IDs should work with /link command');
    
    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 restart zentro-bot');
    
    console.log('\n🧪 TEST /LINK COMMAND IN:');
    console.log('• Snowy Billiards 2x (1379533411009560626)');
    console.log('• Emperor 3x (1342235198175182921)');
    console.log('• Rise 3x (1391149977434329230)');
    console.log('• Shadows 3x (1391209638308872254)');

  } catch (error) {
    console.error('❌ CLEANUP ERROR:', error.message);
    console.error(error);
  }
}

cleanupAndRestart();