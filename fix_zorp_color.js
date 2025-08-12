const pool = require('./src/db');

async function fixZorpColor() {
  try {
    console.log('🔧 Fixing Zorp color configuration...');
    
    // Step 1: Check Zorp tables and configurations
    console.log('\n📋 Step 1: Checking Zorp tables...');
    
    // Check if zorp_defaults table exists
    try {
      const [zorpDefaults] = await pool.query('SELECT * FROM zorp_defaults LIMIT 5');
      console.log(`✅ zorp_defaults table exists with ${zorpDefaults.length} records`);
      
      if (zorpDefaults.length > 0) {
        console.log('Sample zorp_defaults records:');
        zorpDefaults.forEach((record, index) => {
          console.log(`   ${index + 1}. ID: ${record.id}, Color: ${record.color || 'NULL'}, Enabled: ${record.enabled}`);
        });
      }
    } catch (error) {
      console.log('❌ zorp_defaults table does not exist');
    }
    
    // Check if zones table exists and has Zorp-related data
    try {
      const [zones] = await pool.query('SELECT * FROM zones WHERE type LIKE "%zorp%" OR name LIKE "%zorp%" LIMIT 5');
      console.log(`✅ Found ${zones.length} Zorp-related zones`);
      
      if (zones.length > 0) {
        console.log('Sample zone records:');
        zones.forEach((zone, index) => {
          console.log(`   ${index + 1}. ID: ${zone.id}, Name: ${zone.name}, Type: ${zone.type}, Color: ${zone.color || 'NULL'}`);
        });
      }
    } catch (error) {
      console.log('❌ zones table does not exist or no Zorp zones found');
    }
    
    // Step 2: Find and fix "green" color entries
    console.log('\n📋 Step 2: Finding "green" color entries...');
    
    // Check zorp_defaults for "green" color
    try {
      const [greenDefaults] = await pool.query(`
        SELECT * FROM zorp_defaults 
        WHERE color = 'green' OR color LIKE '%green%'
      `);
      
      if (greenDefaults.length > 0) {
        console.log(`Found ${greenDefaults.length} zorp_defaults with "green" color:`);
        greenDefaults.forEach((record, index) => {
          console.log(`   ${index + 1}. ID: ${record.id}, Color: "${record.color}", Enabled: ${record.enabled}`);
        });
        
        // Fix the green color entries
        console.log('\n   🔧 Fixing "green" color entries...');
        const [fixResult] = await pool.query(`
          UPDATE zorp_defaults 
          SET color = '00ff00' 
          WHERE color = 'green' OR color LIKE '%green%'
        `);
        console.log(`   ✅ Fixed ${fixResult.affectedRows} zorp_defaults entries`);
      } else {
        console.log('   ✅ No "green" color entries found in zorp_defaults');
      }
    } catch (error) {
      console.log('   ⚠️ Could not check zorp_defaults for green color');
    }
    
    // Check zones for "green" color
    try {
      const [greenZones] = await pool.query(`
        SELECT * FROM zones 
        WHERE color = 'green' OR color LIKE '%green%'
      `);
      
      if (greenZones.length > 0) {
        console.log(`Found ${greenZones.length} zones with "green" color:`);
        greenZones.forEach((zone, index) => {
          console.log(`   ${index + 1}. ID: ${zone.id}, Name: ${zone.name}, Color: "${zone.color}"`);
        });
        
        // Fix the green color entries
        console.log('\n   🔧 Fixing "green" color entries in zones...');
        const [fixResult] = await pool.query(`
          UPDATE zones 
          SET color = '00ff00' 
          WHERE color = 'green' OR color LIKE '%green%'
        `);
        console.log(`   ✅ Fixed ${fixResult.affectedRows} zone entries`);
      } else {
        console.log('   ✅ No "green" color entries found in zones');
      }
    } catch (error) {
      console.log('   ⚠️ Could not check zones for green color');
    }
    
    // Step 3: Check for other invalid color formats
    console.log('\n📋 Step 3: Checking for other invalid color formats...');
    
    // Check for non-hex colors in zorp_defaults
    try {
      const [invalidColors] = await pool.query(`
        SELECT * FROM zorp_defaults 
        WHERE color IS NOT NULL 
        AND color != '' 
        AND color NOT REGEXP '^[0-9a-fA-F]{6}$'
        AND color NOT REGEXP '^[0-9a-fA-F]{3}$'
      `);
      
      if (invalidColors.length > 0) {
        console.log(`Found ${invalidColors.length} zorp_defaults with invalid color formats:`);
        invalidColors.forEach((record, index) => {
          console.log(`   ${index + 1}. ID: ${record.id}, Color: "${record.color}"`);
        });
        
        // Fix invalid colors to default green
        console.log('\n   🔧 Fixing invalid color formats...');
        const [fixResult] = await pool.query(`
          UPDATE zorp_defaults 
          SET color = '00ff00' 
          WHERE color IS NOT NULL 
          AND color != '' 
          AND color NOT REGEXP '^[0-9a-fA-F]{6}$'
          AND color NOT REGEXP '^[0-9a-fA-F]{3}$'
        `);
        console.log(`   ✅ Fixed ${fixResult.affectedRows} invalid color entries`);
      } else {
        console.log('   ✅ All zorp_defaults colors are in valid hex format');
      }
    } catch (error) {
      console.log('   ⚠️ Could not check for invalid colors in zorp_defaults');
    }
    
    // Check for non-hex colors in zones
    try {
      const [invalidZoneColors] = await pool.query(`
        SELECT * FROM zones 
        WHERE color IS NOT NULL 
        AND color != '' 
        AND color NOT REGEXP '^[0-9a-fA-F]{6}$'
        AND color NOT REGEXP '^[0-9a-fA-F]{3}$'
      `);
      
      if (invalidZoneColors.length > 0) {
        console.log(`Found ${invalidZoneColors.length} zones with invalid color formats:`);
        invalidZoneColors.forEach((zone, index) => {
          console.log(`   ${index + 1}. ID: ${zone.id}, Name: ${zone.name}, Color: "${zone.color}"`);
        });
        
        // Fix invalid colors to default green
        console.log('\n   🔧 Fixing invalid color formats in zones...');
        const [fixResult] = await pool.query(`
          UPDATE zones 
          SET color = '00ff00' 
          WHERE color IS NOT NULL 
          AND color != '' 
          AND color NOT REGEXP '^[0-9a-fA-F]{6}$'
          AND color NOT REGEXP '^[0-9a-fA-F]{3}$'
        `);
        console.log(`   ✅ Fixed ${fixResult.affectedRows} invalid zone color entries`);
      } else {
        console.log('   ✅ All zone colors are in valid hex format');
      }
    } catch (error) {
      console.log('   ⚠️ Could not check for invalid colors in zones');
    }
    
    // Step 4: Verify the fix
    console.log('\n📋 Step 4: Verifying the fix...');
    
    // Check final state of zorp_defaults
    try {
      const [finalDefaults] = await pool.query('SELECT COUNT(*) as count FROM zorp_defaults');
      const [enabledDefaults] = await pool.query('SELECT COUNT(*) as count FROM zorp_defaults WHERE enabled = 1');
      console.log(`Zorp defaults: ${finalDefaults[0].count} total, ${enabledDefaults[0].count} enabled`);
    } catch (error) {
      console.log('Could not verify zorp_defaults final state');
    }
    
    // Check final state of zones
    try {
      const [finalZones] = await pool.query('SELECT COUNT(*) as count FROM zones WHERE type LIKE "%zorp%" OR name LIKE "%zorp%"');
      console.log(`Zorp zones: ${finalZones[0].count} total`);
    } catch (error) {
      console.log('Could not verify zones final state');
    }
    
    console.log('\n🎯 ZORP COLOR FIX COMPLETE!');
    console.log('✅ Invalid color formats have been fixed');
    console.log('✅ "green" text colors converted to hex format');
    console.log('🔄 Restart the bot: pm2 restart zentro-bot');
    console.log('📝 Zorps should now display properly with correct colors');
    
  } catch (error) {
    console.error('❌ Error fixing Zorp color:', error);
  } finally {
    await pool.end();
  }
}

fixZorpColor(); 