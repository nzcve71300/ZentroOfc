const mysql = require('mysql2/promise');
require('dotenv').config();

async function deployKillfeedRandomizer() {
  console.log('🎲 Deploying Killfeed Randomizer');
  console.log('================================\n');

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

    console.log('\n📋 Step 2: Verifying killfeed configurations...');
    const [killfeedConfigs] = await connection.execute('SELECT COUNT(*) as count FROM killfeed_configs');
    console.log(`✅ Found ${killfeedConfigs[0].count} killfeed configurations`);

    console.log('\n📋 Step 3: Checking randomizer status...');
    const [enabledRandomizers] = await connection.execute('SELECT COUNT(*) as count FROM killfeed_configs WHERE randomizer_enabled = TRUE');
    console.log(`✅ ${enabledRandomizers[0].count} servers have randomizer enabled`);

    await connection.end();

    console.log('\n🎉 Killfeed Randomizer Deployment Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Configure killfeed randomizer per server:');
    console.log('   - /killfeed-setup server: [ServerName] format_string: "{Killer} killed {Victim}" randomizer: Enable');
    console.log('3. Test the system with player kills');

    console.log('\n💡 Randomizer Phrases:');
    console.log('• killed (the classic)');
    console.log('• murked');
    console.log('• clapped');
    console.log('• smoked');
    console.log('• deleted');
    console.log('• dropped');
    console.log('• rekt');
    console.log('• bonked');

    console.log('\n🎲 How it works:');
    console.log('• When randomizer is enabled, "killed" will be randomly replaced');
    console.log('• Each kill message gets a random phrase from the list');
    console.log('• Works with any killfeed format that contains "killed"');

  } catch (error) {
    console.error('❌ Error deploying killfeed randomizer:', error.message);
  }
}

deployKillfeedRandomizer();
