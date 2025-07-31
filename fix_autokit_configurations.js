const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAutokitConfigurations() {
  console.log('🔧 Fix Autokit Configurations');
  console.log('==============================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    const serverId = '1753952654507_7deot3q0';

    console.log('\n📋 Step 1: Check current autokit configurations...');
    const [autokitResult] = await connection.execute(
      'SELECT * FROM autokits WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Found ${autokitResult.length} autokit configurations:`);
    for (const autokit of autokitResult) {
      console.log(`- Kit: ${autokit.kit_name}, Enabled: ${autokit.enabled}, Cooldown: ${autokit.cooldown} minutes`);
    }

    console.log('\n📋 Step 2: Set up proper cooldowns for all kits...');
    
    // Define proper cooldowns for each kit type
    const kitConfigs = [
      { kit_name: 'FREEkit1', cooldown: 30, enabled: true }, // 30 minutes for free kits
      { kit_name: 'FREEkit2', cooldown: 30, enabled: true },
      { kit_name: 'VIPkit', cooldown: 60, enabled: true },   // 60 minutes for VIP
      { kit_name: 'ELITEkit1', cooldown: 120, enabled: true }, // 120 minutes for elite
      { kit_name: 'ELITEkit2', cooldown: 120, enabled: true },
      { kit_name: 'ELITEkit3', cooldown: 120, enabled: true },
      { kit_name: 'ELITEkit4', cooldown: 120, enabled: true },
      { kit_name: 'ELITEkit5', cooldown: 120, enabled: true }
    ];

    for (const config of kitConfigs) {
      // Check if autokit exists
      const [existingResult] = await connection.execute(
        'SELECT id FROM autokits WHERE server_id = ? AND kit_name = ?',
        [serverId, config.kit_name]
      );

      if (existingResult.length > 0) {
        // Update existing autokit
        await connection.execute(
          'UPDATE autokits SET cooldown = ?, enabled = ? WHERE server_id = ? AND kit_name = ?',
          [config.cooldown, config.enabled, serverId, config.kit_name]
        );
        console.log(`✅ Updated ${config.kit_name} - Cooldown: ${config.cooldown} minutes`);
      } else {
        // Create new autokit
        await connection.execute(
          'INSERT INTO autokits (server_id, kit_name, enabled, cooldown, game_name) VALUES (?, ?, ?, ?, ?)',
          [serverId, config.kit_name, config.enabled, config.cooldown, config.kit_name]
        );
        console.log(`✅ Created ${config.kit_name} - Cooldown: ${config.cooldown} minutes`);
      }
    }

    console.log('\n📋 Step 3: Clear all existing cooldown entries...');
    const [deleteResult] = await connection.execute(
      'DELETE FROM kit_cooldowns WHERE server_id = ?',
      [serverId]
    );
    console.log(`✅ Cleared ${deleteResult.affectedRows} existing cooldown entries`);

    console.log('\n📋 Step 4: Verify the fixes...');
    const [updatedAutokits] = await connection.execute(
      'SELECT * FROM autokits WHERE server_id = ? ORDER BY kit_name',
      [serverId]
    );
    
    console.log(`Updated autokit configurations:`);
    for (const autokit of updatedAutokits) {
      console.log(`- Kit: ${autokit.kit_name}, Enabled: ${autokit.enabled}, Cooldown: ${autokit.cooldown} minutes`);
    }

    const [remainingCooldowns] = await connection.execute(
      'SELECT COUNT(*) as count FROM kit_cooldowns WHERE server_id = ?',
      [serverId]
    );
    console.log(`Remaining cooldown entries: ${remainingCooldowns[0].count}`);

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Set up proper cooldowns for all kit types');
    console.log('✅ Free kits: 30 minutes cooldown');
    console.log('✅ VIP kits: 60 minutes cooldown');
    console.log('✅ Elite kits: 120 minutes cooldown');
    console.log('✅ Cleared all existing cooldown entries');
    console.log('✅ Kit spam should now be prevented');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 restart zentro-bot');
    console.log('pm2 logs zentro-bot');

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Test FREEkit1 - should have 30min cooldown');
    console.log('2. Test VIPkit - should have 60min cooldown');
    console.log('3. Test ELITEkit1 - should have 120min cooldown');
    console.log('4. Verify no spam occurs');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

fixAutokitConfigurations(); 