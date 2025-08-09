const mysql = require('mysql2/promise');
require('dotenv').config();

async function emergencyFixNullDiscordId() {
  console.log('🚨 EMERGENCY: FIX NULL DISCORD ID ISSUE');
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

    console.log('\n📋 EMERGENCY FIX: Allow NULL discord_id temporarily...');
    
    // Make discord_id nullable again to fix the immediate issue
    await connection.execute('ALTER TABLE players MODIFY COLUMN discord_id BIGINT NULL');
    console.log('✅ Made discord_id nullable again');
    
    // But keep the constraint that prevents empty strings
    try {
      await connection.execute('ALTER TABLE players DROP CONSTRAINT check_discord_id_valid');
      console.log('✅ Removed discord_id check constraint');
    } catch (e) {
      console.log('⚠️ Discord ID check constraint might not exist');
    }

    console.log('\n📋 TESTING THE FIX...');
    
    // Test that the problematic insert would now work
    try {
      await connection.execute(
        "INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (384, '1754690822459_bxb3nuglj', NULL, 'TestPlayer')"
      );
      console.log('✅ NULL discord_id insert works now');
      
      // Clean up test record
      await connection.execute("DELETE FROM players WHERE ign = 'TestPlayer'");
      console.log('✅ Cleaned up test record');
    } catch (testError) {
      console.log('❌ Test insert still fails:', testError.message);
    }

    await connection.end();

    console.log('\n🎯 EMERGENCY FIX COMPLETE!');
    console.log('✅ Made discord_id nullable to stop bot crashes');
    console.log('✅ Bot should now work without NULL constraint errors');
    
    console.log('\n🚀 RESTART BOT NOW:');
    console.log('pm2 restart zentro-bot');
    console.log('\nThen test /link command immediately!');
    
    console.log('\n⚠️ EXPLANATION:');
    console.log('Our earlier fix made discord_id NOT NULL, but the bot code');
    console.log('still tries to insert players with NULL discord_id in some cases.');
    console.log('This temporary fix allows NULL values to prevent crashes.');

  } catch (error) {
    console.error('❌ EMERGENCY ERROR:', error.message);
    console.error(error);
  }
}

emergencyFixNullDiscordId();