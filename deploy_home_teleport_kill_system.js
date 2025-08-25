const mysql = require('mysql2/promise');
require('dotenv').config();

async function deployHomeTeleportKillSystem() {
  console.log('🏠 Deploying New Home Teleport Kill System');
  console.log('==========================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Verifying home teleport configurations...');
    const [homeConfigs] = await connection.execute('SELECT COUNT(*) as count FROM home_teleport_configs');
    console.log(`✅ Found ${homeConfigs[0].count} home teleport configurations`);

    console.log('\n📋 Step 2: Checking server configurations...');
    const [servers] = await connection.execute('SELECT COUNT(*) as count FROM rust_servers');
    console.log(`✅ Found ${servers[0].count} Rust servers`);

    await connection.end();

    console.log('\n🎉 Home Teleport Kill System Ready!');
    console.log('\n📋 New System Flow:');
    console.log('1. Player uses SET HOME emote (building slot 3)');
    console.log('2. Bot instantly kills player with: kill "IGN"');
    console.log('3. Player respawns on their bed');
    console.log('4. Bot detects respawn: "player has entered the game"');
    console.log('5. Bot gets player position with: printpos "player"');
    console.log('6. Bot sets home teleport at respawn location');
    console.log('7. Bot shows success message: "home location saved successfully!"');
    console.log('8. Player can now use TELEPORT HOME emote (combat slot 1)');

    console.log('\n📋 Changes Made:');
    console.log('✅ Removed yes/no confirmation system');
    console.log('✅ Added instant kill on set home emote (kill command)');
    console.log('✅ Added respawn detection for home setup');
    console.log('✅ Added automatic position capture after respawn');
    console.log('✅ Added 30-second timeout for setup process');
    console.log('✅ Only shows success message at the end');
    console.log('✅ Kept teleport home functionality unchanged');

    console.log('\n📋 Next Steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Test the new system:');
    console.log('   - Player uses SET HOME emote');
    console.log('   - Player gets killed instantly');
    console.log('   - Player respawns on bed');
    console.log('   - Bot automatically sets home');
    console.log('   - Player can teleport home');

    console.log('\n💡 How It Works:');
    console.log('• SET HOME emote: Instantly kills player with kill command');
    console.log('• Respawn detection: Monitors "has entered the game" messages');
    console.log('• Position capture: Uses printpos command after respawn');
    console.log('• Home storage: Saves coordinates to database');
    console.log('• Success message: Only shows at the end');
    console.log('• Timeout: 30 seconds for each step');
    console.log('• Teleport home: Works exactly as before');

    console.log('\n🚀 Benefits:');
    console.log('• No more yes/no spam in chat');
    console.log('• Automatic home setup after respawn');
    console.log('• More immersive gameplay');
    console.log('• Cleaner user experience');

    console.log('\n⚠️ Important Notes:');
    console.log('• Players must respawn on a bed for home setup');
    console.log('• If player doesn\'t respawn, home won\'t be set');
    console.log('• Cooldown system still applies');
    console.log('• Whitelist system still applies');

  } catch (error) {
    console.error('❌ Error deploying home teleport kill system:', error.message);
  }
}

deployHomeTeleportKillSystem();
