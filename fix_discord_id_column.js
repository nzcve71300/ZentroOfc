const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDiscordIdColumn() {
  console.log('🔧 Fix Discord ID Column');
  console.log('========================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('📋 Current state:');
    const [guilds] = await connection.execute('SELECT id, name, discord_id FROM guilds');
    for (const guild of guilds) {
      console.log(`Guild ${guild.id}: "${guild.name}" - Discord ID: ${guild.discord_id}`);
    }

    console.log('\n🔄 Step 1: Changing column type from BIGINT to VARCHAR(20)...');
    await connection.execute('ALTER TABLE guilds MODIFY COLUMN discord_id VARCHAR(20) NOT NULL');
    console.log('✅ Column type changed successfully!');

    console.log('\n🔄 Step 2: Updating Discord IDs with correct values...');
    
    // Update Guild 176 (RISE 3X) with the correct Discord ID
    await connection.execute(
      'UPDATE guilds SET discord_id = ? WHERE id = ?',
      ['1391149977434329230', 176]
    );
    console.log('✅ Updated Guild 176 (RISE 3X)');

    // Update Guild 177 (Zentro Bot) with the correct Discord ID
    await connection.execute(
      'UPDATE guilds SET discord_id = ? WHERE id = ?',
      ['1385691441967267800', 177]
    );
    console.log('✅ Updated Guild 177 (Zentro Bot)');

    console.log('\n✅ Verification:');
    const [verifyGuilds] = await connection.execute('SELECT id, name, discord_id FROM guilds');
    for (const guild of verifyGuilds) {
      console.log(`Guild ${guild.id}: "${guild.name}" - Discord ID: ${guild.discord_id}`);
    }

    // Test the autokit query
    console.log('\n🧪 Testing autokit query:');
    const [autokitTest] = await connection.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      ['1391149977434329230', 'RISE 3X']
    );
    
    if (autokitTest.length > 0) {
      console.log('✅ Autokit query works!');
      console.log(`  Server ID: ${autokitTest[0].id}`);
    } else {
      console.log('❌ Autokit query fails');
    }

    await connection.end();

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixDiscordIdColumn(); 