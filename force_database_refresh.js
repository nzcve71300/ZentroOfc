const mysql = require('mysql2/promise');
require('dotenv').config();

async function forceDatabaseRefresh() {
  console.log('🔄 Force Database Refresh');
  console.log('========================\n');

  try {
    // Create a fresh connection
    const freshPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('📋 Checking guild data with fresh connection...');
    const [guilds] = await freshPool.execute('SELECT * FROM guilds');
    
    for (const guild of guilds) {
      console.log(`Guild: "${guild.name}" (ID: ${guild.id}, Discord: ${guild.discord_id})`);
    }

    // Check the specific guild
    console.log('\n🔍 Checking Guild ID 176 specifically:');
    const [guild176] = await freshPool.execute('SELECT * FROM guilds WHERE id = 176');
    
    if (guild176.length > 0) {
      console.log(`Guild: "${guild176[0].name}" (ID: ${guild176[0].id})`);
      console.log(`Discord ID: ${guild176[0].discord_id}`);
    }

    // Try the update again with fresh connection
    console.log('\n🔄 Attempting update with fresh connection...');
    const correctGuildId = '1391149977434329230';
    
    const [updateResult] = await freshPool.execute(
      'UPDATE guilds SET discord_id = ? WHERE id = ?',
      [correctGuildId, 176]
    );
    
    console.log(`Rows affected: ${updateResult.affectedRows}`);

    // Check immediately after update
    console.log('\n✅ Checking immediately after update:');
    const [checkAfter] = await freshPool.execute('SELECT * FROM guilds WHERE id = 176');
    
    if (checkAfter.length > 0) {
      console.log(`Guild: "${checkAfter[0].name}" (ID: ${checkAfter[0].id})`);
      console.log(`Discord ID: ${checkAfter[0].discord_id}`);
      console.log(`Expected: ${correctGuildId}`);
      console.log(`Match: ${checkAfter[0].discord_id === correctGuildId ? '✅' : '❌'}`);
    }

    // Test autokit query
    console.log('\n🧪 Testing autokit query:');
    const [autokitTest] = await freshPool.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [correctGuildId, 'RISE 3X']
    );
    
    if (autokitTest.length > 0) {
      console.log('✅ Autokit query works!');
      console.log(`  Server ID: ${autokitTest[0].id}`);
    } else {
      console.log('❌ Autokit query fails');
    }

    // Close the fresh connection
    await freshPool.end();

    console.log('\n🚀 Now restart the bot:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceDatabaseRefresh();