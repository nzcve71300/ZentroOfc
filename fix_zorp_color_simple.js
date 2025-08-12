const pool = require('./src/db');

async function fixZorpColorSimple() {
  try {
    console.log('🔧 Simple Zorp color fix (RGB format)...');
    
    // Step 1: Check current zorp_defaults
    console.log('\n📋 Step 1: Checking current zorp_defaults...');
    const [zorpDefaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log(`Found ${zorpDefaults.length} zorp_defaults records:`);
    
    zorpDefaults.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, Color: "${record.color || 'NULL'}", Enabled: ${record.enabled}`);
    });
    
    // Step 2: Fix all zorp_defaults with proper RGB colors
    console.log('\n📋 Step 2: Fixing zorp_defaults colors to RGB format...');
    
    // First, fix "green" to RGB green
    const [greenResult] = await pool.query(`
      UPDATE zorp_defaults 
      SET color = '0,255,0' 
      WHERE color = 'green' OR color LIKE '%green%'
    `);
    console.log(`✅ Fixed ${greenResult.affectedRows} "green" entries to RGB(0,255,0)`);
    
    // Then, fix "red" to RGB red
    const [redResult] = await pool.query(`
      UPDATE zorp_defaults 
      SET color = '255,0,0' 
      WHERE color = 'red' OR color LIKE '%red%'
    `);
    console.log(`✅ Fixed ${redResult.affectedRows} "red" entries to RGB(255,0,0)`);
    
    // Finally, fix any NULL or empty colors to default green
    const [nullResult] = await pool.query(`
      UPDATE zorp_defaults 
      SET color = '0,255,0' 
      WHERE color IS NULL OR color = ''
    `);
    console.log(`✅ Fixed ${nullResult.affectedRows} NULL/empty entries to RGB(0,255,0)`);
    
    // Step 3: Verify the fix
    console.log('\n📋 Step 3: Verifying the fix...');
    const [finalDefaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log('Final zorp_defaults state:');
    
    finalDefaults.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, Color: "${record.color || 'NULL'}", Enabled: ${record.enabled}`);
    });
    
    // Step 4: Check if there are any zones that need fixing
    console.log('\n📋 Step 4: Checking for zones table...');
    try {
      const [zones] = await pool.query('SHOW TABLES LIKE "zones"');
      if (zones.length > 0) {
        console.log('✅ zones table exists');
        
        // Fix "green" in zones
        const [zoneGreenResult] = await pool.query(`
          UPDATE zones 
          SET color = '0,255,0' 
          WHERE color = 'green' OR color LIKE '%green%'
        `);
        console.log(`✅ Fixed ${zoneGreenResult.affectedRows} "green" entries in zones to RGB(0,255,0)`);
        
        // Fix "red" in zones
        const [zoneRedResult] = await pool.query(`
          UPDATE zones 
          SET color = '255,0,0' 
          WHERE color = 'red' OR color LIKE '%red%'
        `);
        console.log(`✅ Fixed ${zoneRedResult.affectedRows} "red" entries in zones to RGB(255,0,0)`);
        
      } else {
        console.log('❌ zones table does not exist');
      }
    } catch (error) {
      console.log('⚠️ Could not check zones table:', error.message);
    }
    
    console.log('\n🎯 SIMPLE ZORP COLOR FIX COMPLETE!');
    console.log('✅ "green" text colors converted to RGB(0,255,0)');
    console.log('✅ "red" text colors converted to RGB(255,0,0)');
    console.log('✅ NULL/empty colors set to RGB(0,255,0) (default green)');
    console.log('🔄 Restart the bot: pm2 restart zentro-bot');
    console.log('📝 Zorps should now display properly with correct RGB colors!');
    
  } catch (error) {
    console.error('❌ Error fixing Zorp color:', error);
  } finally {
    await pool.end();
  }
}

fixZorpColorSimple(); 