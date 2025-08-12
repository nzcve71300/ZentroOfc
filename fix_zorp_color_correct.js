const pool = require('./src/db');

async function fixZorpColorCorrect() {
  try {
    console.log('🔧 Fixing Zorp colors with correct column names...');
    
    // Step 1: Check current zorp_defaults
    console.log('\n📋 Step 1: Checking current zorp_defaults...');
    const [zorpDefaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log(`Found ${zorpDefaults.length} zorp_defaults records:`);
    
    zorpDefaults.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, Server: ${record.server_id}`);
      console.log(`      Color Online: "${record.color_online || 'NULL'}"`);
      console.log(`      Color Offline: "${record.color_offline || 'NULL'}"`);
      console.log(`      Enabled: ${record.enabled}`);
    });
    
    // Step 2: Fix color_online column
    console.log('\n📋 Step 2: Fixing color_online column...');
    
    // Fix "green" to RGB green
    const [greenOnlineResult] = await pool.query(`
      UPDATE zorp_defaults 
      SET color_online = '0,255,0' 
      WHERE color_online = 'green' OR color_online LIKE '%green%'
    `);
    console.log(`✅ Fixed ${greenOnlineResult.affectedRows} "green" entries in color_online to RGB(0,255,0)`);
    
    // Fix NULL/empty color_online to default green
    const [nullOnlineResult] = await pool.query(`
      UPDATE zorp_defaults 
      SET color_online = '0,255,0' 
      WHERE color_online IS NULL OR color_online = ''
    `);
    console.log(`✅ Fixed ${nullOnlineResult.affectedRows} NULL/empty entries in color_online to RGB(0,255,0)`);
    
    // Step 3: Fix color_offline column
    console.log('\n📋 Step 3: Fixing color_offline column...');
    
    // Fix "red" to RGB red
    const [redOfflineResult] = await pool.query(`
      UPDATE zorp_defaults 
      SET color_offline = '255,0,0' 
      WHERE color_offline = 'red' OR color_offline LIKE '%red%'
    `);
    console.log(`✅ Fixed ${redOfflineResult.affectedRows} "red" entries in color_offline to RGB(255,0,0)`);
    
    // Fix NULL/empty color_offline to default red
    const [nullOfflineResult] = await pool.query(`
      UPDATE zorp_defaults 
      SET color_offline = '255,0,0' 
      WHERE color_offline IS NULL OR color_offline = ''
    `);
    console.log(`✅ Fixed ${nullOfflineResult.affectedRows} NULL/empty entries in color_offline to RGB(255,0,0)`);
    
    // Step 4: Verify the fix
    console.log('\n📋 Step 4: Verifying the fix...');
    const [finalDefaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log('Final zorp_defaults state:');
    
    finalDefaults.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, Server: ${record.server_id}`);
      console.log(`      Color Online: "${record.color_online || 'NULL'}"`);
      console.log(`      Color Offline: "${record.color_offline || 'NULL'}"`);
      console.log(`      Enabled: ${record.enabled}`);
    });
    
    // Step 5: Check zorp_zones table if it exists
    console.log('\n📋 Step 5: Checking zorp_zones table...');
    try {
      const [zorpZones] = await pool.query('SELECT * FROM zorp_zones LIMIT 5');
      console.log(`Found ${zorpZones.length} zorp_zones records`);
      
      if (zorpZones.length > 0) {
        console.log('Sample zorp_zones data:');
        zorpZones.forEach((zone, index) => {
          console.log(`   ${index + 1}. ID: ${zone.id}, Color Online: "${zone.color_online || 'NULL'}", Color Offline: "${zone.color_offline || 'NULL'}"`);
        });
        
        // Fix any text colors in zorp_zones
        const [zoneGreenResult] = await pool.query(`
          UPDATE zorp_zones 
          SET color_online = '0,255,0' 
          WHERE color_online = 'green' OR color_online LIKE '%green%'
        `);
        console.log(`✅ Fixed ${zoneGreenResult.affectedRows} "green" entries in zorp_zones color_online`);
        
        const [zoneRedResult] = await pool.query(`
          UPDATE zorp_zones 
          SET color_offline = '255,0,0' 
          WHERE color_offline = 'red' OR color_offline LIKE '%red%'
        `);
        console.log(`✅ Fixed ${zoneRedResult.affectedRows} "red" entries in zorp_zones color_offline`);
      }
    } catch (error) {
      console.log('⚠️ Could not check zorp_zones table:', error.message);
    }
    
    console.log('\n🎯 ZORP COLOR FIX COMPLETE!');
    console.log('✅ "green" text colors converted to RGB(0,255,0) for online status');
    console.log('✅ "red" text colors converted to RGB(255,0,0) for offline status');
    console.log('✅ NULL/empty colors set to proper defaults');
    console.log('🔄 Restart the bot: pm2 restart zentro-bot');
    console.log('📝 Zorps should now display properly with correct RGB colors!');
    
  } catch (error) {
    console.error('❌ Error fixing Zorp color:', error);
  } finally {
    await pool.end();
  }
}

fixZorpColorCorrect(); 