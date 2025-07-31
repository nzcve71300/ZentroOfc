const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPermissions() {
  console.log('🔍 Database Permissions Check');
  console.log('============================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('📋 Current user info:');
    const [userInfo] = await connection.execute('SELECT USER() as current_user, DATABASE() as current_db');
    console.log(`User: ${userInfo[0].current_user}`);
    console.log(`Database: ${userInfo[0].current_db}`);

    console.log('\n🔍 Checking permissions on guilds table:');
    
    // Check if we can SELECT
    try {
      const [selectTest] = await connection.execute('SELECT COUNT(*) as count FROM guilds');
      console.log('✅ SELECT permission: YES');
    } catch (error) {
      console.log('❌ SELECT permission: NO');
    }

    // Check if we can UPDATE
    try {
      const [updateTest] = await connection.execute('UPDATE guilds SET discord_id = discord_id WHERE id = 176');
      console.log('✅ UPDATE permission: YES');
    } catch (error) {
      console.log('❌ UPDATE permission: NO');
      console.log(`   Error: ${error.message}`);
    }

    // Check if we can INSERT
    try {
      const [insertTest] = await connection.execute('INSERT INTO guilds (name, discord_id) VALUES ("test", "123")');
      console.log('✅ INSERT permission: YES');
      // Clean up test insert
      await connection.execute('DELETE FROM guilds WHERE discord_id = "123"');
    } catch (error) {
      console.log('❌ INSERT permission: NO');
      console.log(`   Error: ${error.message}`);
    }

    // Check if we can DELETE
    try {
      const [deleteTest] = await connection.execute('DELETE FROM guilds WHERE discord_id = "999999"');
      console.log('✅ DELETE permission: YES');
    } catch (error) {
      console.log('❌ DELETE permission: NO');
      console.log(`   Error: ${error.message}`);
    }

    await connection.end();

    console.log('\n💡 SOLUTION:');
    console.log('If UPDATE permission is NO, you need to:');
    console.log('1. Connect to MySQL as root/superuser');
    console.log('2. Run: GRANT UPDATE ON zentro_bot.guilds TO "your_user"@"your_host"');
    console.log('3. Run: FLUSH PRIVILEGES;');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPermissions(); 