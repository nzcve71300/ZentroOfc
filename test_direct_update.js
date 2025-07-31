const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDirectUpdate() {
  console.log('🧪 Test Direct Update');
  console.log('=====================\n');

  try {
    // Create a fresh connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Check current value
    console.log('📋 Current value:');
    const [current] = await connection.execute('SELECT id, name, discord_id FROM guilds WHERE id = 176');
    console.log(`Guild: "${current[0].name}" (ID: ${current[0].id})`);
    console.log(`Discord ID: ${current[0].discord_id}`);

    // Try to update to a test value first
    console.log('\n🔄 Testing with a different value:');
    const testValue = '999999999999999999';
    await connection.execute(
      'UPDATE guilds SET discord_id = ? WHERE id = ?',
      [testValue, 176]
    );

    // Check if it changed
    const [afterTest] = await connection.execute('SELECT discord_id FROM guilds WHERE id = 176');
    console.log(`After test update: ${afterTest[0].discord_id}`);
    console.log(`Expected: ${testValue}`);
    console.log(`Match: ${afterTest[0].discord_id === testValue ? '✅' : '❌'}`);

    // Now try the real value
    console.log('\n🔄 Testing with correct value:');
    const correctValue = '1391149977434329230';
    await connection.execute(
      'UPDATE guilds SET discord_id = ? WHERE id = ?',
      [correctValue, 176]
    );

    // Check if it changed
    const [afterReal] = await connection.execute('SELECT discord_id FROM guilds WHERE id = 176');
    console.log(`After real update: ${afterReal[0].discord_id}`);
    console.log(`Expected: ${correctValue}`);
    console.log(`Match: ${afterReal[0].discord_id === correctValue ? '✅' : '❌'}`);

    await connection.end();

    console.log('\n🚀 If both updates worked, restart the bot:');
    console.log('pm2 stop zentro-bot');
    console.log('pm2 start zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectUpdate(); 