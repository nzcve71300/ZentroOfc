const pool = require('./src/db');

async function checkZorpStructure() {
  try {
    console.log('🔍 Checking Zorp table structure...');
    
    // Check zorp_defaults table structure
    console.log('\n📋 Step 1: Checking zorp_defaults table structure...');
    try {
      const [columns] = await pool.query('DESCRIBE zorp_defaults');
      console.log('zorp_defaults table columns:');
      columns.forEach(col => {
        console.log(`   ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } catch (error) {
      console.log('❌ Could not describe zorp_defaults table:', error.message);
    }
    
    // Check zorp_defaults data
    console.log('\n📋 Step 2: Checking zorp_defaults data...');
    try {
      const [data] = await pool.query('SELECT * FROM zorp_defaults LIMIT 5');
      console.log(`Found ${data.length} zorp_defaults records:`);
      
      if (data.length > 0) {
        console.log('Sample data:');
        data.forEach((record, index) => {
          console.log(`   ${index + 1}. Record:`);
          Object.keys(record).forEach(key => {
            console.log(`      ${key}: ${record[key]}`);
          });
        });
      }
    } catch (error) {
      console.log('❌ Could not query zorp_defaults data:', error.message);
    }
    
    // Check if there are other Zorp-related tables
    console.log('\n📋 Step 3: Checking for other Zorp-related tables...');
    try {
      const [tables] = await pool.query("SHOW TABLES LIKE '%zorp%'");
      console.log('Zorp-related tables:');
      tables.forEach(table => {
        console.log(`   ${Object.values(table)[0]}`);
      });
    } catch (error) {
      console.log('❌ Could not check for Zorp tables:', error.message);
    }
    
    // Check zones table if it exists
    console.log('\n📋 Step 4: Checking zones table...');
    try {
      const [zones] = await pool.query('SELECT * FROM zones WHERE type LIKE "%zorp%" OR name LIKE "%zorp%" LIMIT 5');
      console.log(`Found ${zones.length} Zorp-related zones:`);
      
      if (zones.length > 0) {
        console.log('Sample zone data:');
        zones.forEach((zone, index) => {
          console.log(`   ${index + 1}. ID: ${zone.id}, Name: ${zone.name}, Type: ${zone.type}`);
          if (zone.color) {
            console.log(`      Color: ${zone.color}`);
          }
        });
      }
    } catch (error) {
      console.log('❌ Could not check zones table:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking Zorp structure:', error);
  } finally {
    await pool.end();
  }
}

checkZorpStructure(); 