const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixKillfeedRandomizerAndTeleportSpam() {
  console.log('🔧 Fixing Killfeed Randomizer and Teleport Spam Issues');
  console.log('=====================================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Checking killfeed_configs table structure...');
    
    // Check if randomizer_enabled column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'killfeed_configs' AND COLUMN_NAME = 'randomizer_enabled'
    `, [process.env.DB_NAME]);

    if (columns.length === 0) {
      console.log('📋 Adding randomizer_enabled column to killfeed_configs table...');
      await connection.execute(`
        ALTER TABLE killfeed_configs 
        ADD COLUMN randomizer_enabled BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ randomizer_enabled column added!');
    } else {
      console.log('✅ randomizer_enabled column already exists!');
    }

    console.log('\n📋 Step 2: Updating existing killfeed configurations...');
    
    // Update existing configurations to have randomizer disabled by default
    const [updateResult] = await connection.execute(`
      UPDATE killfeed_configs 
      SET randomizer_enabled = FALSE 
      WHERE randomizer_enabled IS NULL
    `);
    
    console.log(`✅ Updated ${updateResult.affectedRows} killfeed configurations`);

    console.log('\n📋 Step 3: Verifying killfeed configurations...');
    const [killfeedConfigs] = await connection.execute('SELECT COUNT(*) as count FROM killfeed_configs');
    console.log(`✅ Found ${killfeedConfigs[0].count} killfeed configurations`);

    console.log('\n📋 Step 4: Checking randomizer status...');
    const [enabledRandomizers] = await connection.execute('SELECT COUNT(*) as count FROM killfeed_configs WHERE randomizer_enabled = TRUE');
    console.log(`✅ ${enabledRandomizers[0].count} servers have randomizer enabled`);

    console.log('\n📋 Step 5: Checking randomizer disabled status...');
    const [disabledRandomizers] = await connection.execute('SELECT COUNT(*) as count FROM killfeed_configs WHERE randomizer_enabled = FALSE');
    console.log(`✅ ${disabledRandomizers[0].count} servers have randomizer disabled`);

    await connection.end();

    console.log('\n🎉 Fixes Applied Successfully!');
    console.log('\n📋 Changes Made:');
    console.log('1. ✅ Fixed killfeed randomizer to respect the database setting');
    console.log('2. ✅ Removed teleport spam from admin feed (Outpost/Bandit Camp)');
    console.log('3. ✅ Updated database to include randomizer_enabled field');
    console.log('4. ✅ Set default randomizer state to disabled');

    console.log('\n📋 Next Steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Configure killfeed randomizer per server:');
    console.log('   - /killfeed-setup server: [ServerName] format_string: "{Killer} killed {Victim}" randomizer: Enable');
    console.log('3. Test the system:');
    console.log('   - With randomizer OFF: Should use exact format string');
    console.log('   - With randomizer ON: Should randomize "killed" word');
    console.log('   - Teleports: Should not spam admin feed');

    console.log('\n💡 Randomizer Behavior:');
    console.log('• When OFF: Uses exact format string (e.g., "{Killer} killed {Victim}")');
    console.log('• When ON: Randomizes "killed" to: killed, murked, clapped, smoked, deleted, dropped, rekt, bonked');

    console.log('\n🚀 Teleport Changes:');
    console.log('• Outpost teleports: No longer spam admin feed');
    console.log('• Bandit Camp teleports: No longer spam admin feed');
    console.log('• Home teleports: Still logged to admin feed (as intended)');

  } catch (error) {
    console.error('❌ Error applying fixes:', error.message);
  }
}

fixKillfeedRandomizerAndTeleportSpam();
