const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

async function diagnoseAutokits() {
  console.log('🔍 Diagnosing Autokit Configuration...\n');
  
  try {
    // Test parameters
    const guildId = '1391149977434329230';
    const serverName = 'RISE 3X';
    const kitKey = 'FREEkit1';
    
    console.log('📋 Test Parameters:');
    console.log(`   Guild ID: ${guildId}`);
    console.log(`   Server Name: ${serverName}`);
    console.log(`   Kit Key: ${kitKey}\n`);
    
    // Step 1: Check guild data
    console.log('✅ Step 1: Checking Guild Data');
    const [guilds] = await pool.execute(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guilds.length > 0) {
      console.log(`   ✅ Guild found: ${guilds[0].name} (ID: ${guilds[0].id})`);
    } else {
      console.log('   ❌ Guild not found! This is the problem.');
      console.log('   💡 Solution: Make sure the guild is registered in the database');
      return;
    }
    
    // Step 2: Check server data
    console.log('\n✅ Step 2: Checking Server Data');
    const [servers] = await pool.execute(`
      SELECT * FROM rust_servers 
      WHERE guild_id = ? AND nickname = ?
    `, [guilds[0].id, serverName]);
    
    if (servers.length > 0) {
      console.log(`   ✅ Server found: ${servers[0].nickname} (ID: ${servers[0].id})`);
    } else {
      console.log('   ❌ Server not found! This is the problem.');
      console.log('   💡 Solution: Use /setup-server to add the server');
      return;
    }
    
    // Step 3: Check autokit configuration
    console.log('\n✅ Step 3: Checking Autokit Configuration');
    const [autokits] = await pool.execute(`
      SELECT * FROM autokits 
      WHERE server_id = ? AND kit_name = ?
    `, [servers[0].id, kitKey]);
    
    if (autokits.length > 0) {
      const autokit = autokits[0];
      console.log(`   ✅ Autokit found: ${autokit.kit_name}`);
      console.log(`   Status: ${autokit.enabled ? '🟢 Enabled' : '🔴 Disabled'}`);
      console.log(`   Cooldown: ${autokit.cooldown || 'Not set'}`);
      console.log(`   Game Name: ${autokit.game_name || 'Not set'}`);
      
      if (!autokit.enabled) {
        console.log('   ❌ Autokit is disabled! Enable it with /autokits-setup');
      }
    } else {
      console.log('   ❌ Autokit not found! This is the problem.');
      console.log('   💡 Solution: Use /autokits-setup to create the autokit');
    }
    
    // Step 4: Check all autokits for this server
    console.log('\n✅ Step 4: All Autokits for Server');
    const [allAutokits] = await pool.execute(`
      SELECT * FROM autokits WHERE server_id = ?
    `, [servers[0].id]);
    
    if (allAutokits.length > 0) {
      console.log(`   Found ${allAutokits.length} autokit(s):`);
      allAutokits.forEach(ak => {
        console.log(`   - ${ak.kit_name}: ${ak.enabled ? '🟢' : '🔴'} ${ak.enabled ? 'Enabled' : 'Disabled'}`);
      });
    } else {
      console.log('   ❌ No autokits configured for this server');
    }
    
    // Step 5: Check table structure
    console.log('\n✅ Step 5: Autokits Table Structure');
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'autokits'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME]);
    
    console.log('   Table structure:');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : ''} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''} ${col.EXTRA || ''}`);
    });
    
    // Step 6: Test autokit creation
    console.log('\n✅ Step 6: Testing Autokit Creation');
    try {
      // Try to create a test autokit
      const [insertResult] = await pool.execute(`
        INSERT INTO autokits (server_id, kit_name, enabled, cooldown, game_name) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        enabled = VALUES(enabled),
        cooldown = VALUES(cooldown),
        game_name = VALUES(game_name)
      `, [servers[0].id, 'TESTkit', true, 300, 'Test Kit']);
      
      console.log('   ✅ Test autokit created/updated successfully');
      
      // Clean up test data
      await pool.execute('DELETE FROM autokits WHERE kit_name = ?', ['TESTkit']);
      console.log('   ✅ Test data cleaned up');
      
    } catch (error) {
      console.log(`   ❌ Error creating test autokit: ${error.message}`);
    }
    
    // Summary and recommendations
    console.log('\n📋 Summary & Recommendations:');
    
    if (autokits.length === 0) {
      console.log('1. ❌ No autokit configuration found');
      console.log('   → Use: /autokits-setup RISE 3X FREEkit1 on');
      console.log('   → Or: /autokits-setup RISE 3X FREEkit1 toggle');
    } else if (!autokits[0].enabled) {
      console.log('1. ❌ Autokit is disabled');
      console.log('   → Use: /autokits-setup RISE 3X FREEkit1 on');
    } else {
      console.log('1. ✅ Autokit configuration looks correct');
    }
    
    console.log('2. 🔧 Debug Commands:');
    console.log('   → /view-autokits-configs RISE 3X');
    console.log('   → /autokits-setup RISE 3X FREEkit1 status');
    
    console.log('3. 🛠️ Manual Database Check:');
    console.log(`   → Run: mysql -u zentro_user -pzentro_password zentro_bot -e "SELECT * FROM autokits WHERE server_id = '${servers[0].id}' AND kit_name = '${kitKey}';"`);
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  } finally {
    await pool.end();
  }
}

diagnoseAutokits(); 