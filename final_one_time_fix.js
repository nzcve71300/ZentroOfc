const mysql = require('mysql2/promise');
require('dotenv').config();

async function oneTimeFix() {
  console.log('🔧 ONE-TIME FINAL FIX');
  console.log('======================\n');

  try {
    // Create connection with explicit transaction control
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('📋 Current state:');
    const [guilds] = await connection.execute('SELECT * FROM guilds WHERE id = 176');
    console.log(`Guild 176 Discord ID: ${guilds[0]?.discord_id || 'NOT FOUND'}`);

    // Start transaction
    await connection.beginTransaction();

    // Update with explicit commit
    const correctGuildId = '1391149977434329230';
    await connection.execute(
      'UPDATE guilds SET discord_id = ? WHERE id = ?',
      [correctGuildId, 176]
    );

    // Force commit
    await connection.commit();

    // Verify immediately
    const [verify] = await connection.execute('SELECT * FROM guilds WHERE id = 176');
    console.log(`\n✅ After update: ${verify[0]?.discord_id}`);
    console.log(`Expected: ${correctGuildId}`);
    console.log(`Match: ${verify[0]?.discord_id === correctGuildId ? '✅' : '❌'}`);

    await connection.end();

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

oneTimeFix(); 