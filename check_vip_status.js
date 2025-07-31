const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkVipStatus() {
  console.log('🔧 Check VIP Status');
  console.log('==================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Get your Discord ID and in-game name
    const discordId = '1391149977434329230'; // Replace with your Discord ID
    const playerName = 'nzcve7130'; // Replace with your in-game name
    const serverId = '1753952654507_7deot3q0';

    console.log('\n📋 Step 1: Checking player data...');
    const [playerResult] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ? AND (ign = ? OR discord_id = ?)',
      [serverId, playerName, discordId]
    );
    
    console.log(`Found ${playerResult.length} player records:`);
    for (const player of playerResult) {
      console.log(`- IGN: ${player.ign}, Discord ID: ${player.discord_id}, Server ID: ${player.server_id}`);
    }

    console.log('\n📋 Step 2: Checking VIP authorization...');
    const [authResult] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ? AND kitlist = ?',
      [serverId, 'VIPkit']
    );
    
    console.log(`Found ${authResult.length} VIP authorization entries:`);
    for (const auth of authResult) {
      console.log(`- Discord ID: ${auth.discord_id}, Kitlist: ${auth.kitlist}`);
    }

    console.log('\n📋 Step 3: Checking if you are authorized...');
    const [yourAuthResult] = await connection.execute(
      'SELECT ka.* FROM kit_auth ka JOIN players p ON ka.discord_id = p.discord_id WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?',
      [serverId, playerName, 'VIPkit']
    );
    
    console.log(`Your VIP authorization status: ${yourAuthResult.length > 0 ? '✅ AUTHORIZED' : '❌ NOT AUTHORIZED'}`);
    if (yourAuthResult.length > 0) {
      console.log('✅ You are authorized for VIP kits!');
    } else {
      console.log('❌ You are NOT authorized for VIP kits');
      console.log('💡 Make sure:');
      console.log('1. Your Discord account is linked to your in-game name');
      console.log('2. You were added to the VIP kit list using /add-to-kit-list');
    }

    console.log('\n📋 Step 4: Testing the exact query used by the bot...');
    const [botQueryResult] = await connection.execute(
      `SELECT ka.* FROM kit_auth ka 
       JOIN players p ON ka.discord_id = p.discord_id 
       WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
      [serverId, playerName, 'VIPkit']
    );
    
    console.log(`Bot query result: ${botQueryResult.length > 0 ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (botQueryResult.length > 0) {
      console.log('✅ The bot should allow you to claim VIP kits');
    } else {
      console.log('❌ The bot will deny VIP kit claims');
    }

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    if (yourAuthResult.length > 0) {
      console.log('✅ You are properly authorized for VIP kits');
      console.log('✅ The bot should allow you to claim VIP kits');
      console.log('💡 If it still says "you need VIP role", try:');
      console.log('1. Restart the bot: pm2 restart zentro-bot');
      console.log('2. Make sure you use the exact in-game name');
    } else {
      console.log('❌ You are NOT authorized for VIP kits');
      console.log('💡 To fix this:');
      console.log('1. Make sure your Discord is linked: /link <your-in-game-name>');
      console.log('2. Have an admin add you: /add-to-kit-list server: RISE 3X name: <your-name> kitlist: VIP Kits');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkVipStatus(); 