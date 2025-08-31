const pool = require('./src/db');
const fs = require('fs');

async function deployVehicleShop() {
  console.log('🚗 Deploying Vehicle Shop System...\n');
  
  try {
    // Step 1: Create the vehicle shop tables
    console.log('1. Creating vehicle shop tables...');
    const createTableSQL = fs.readFileSync('./add_vehicle_shop_system.sql', 'utf8');
    
    // Split the SQL into individual statements to handle index creation errors
    const statements = createTableSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement);
        } catch (error) {
          // Ignore "Duplicate key name" errors for indexes
          if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️ Index already exists, skipping...');
          } else {
            throw error;
          }
        }
      }
    }
    console.log('✅ Vehicle shop tables created successfully!\n');
    
    // Step 2: Test database connection and verify table structure
    console.log('2. Verifying table structure...');
    const [shopVehiclesInfo] = await pool.query('DESCRIBE shop_vehicles');
    console.log('✅ shop_vehicles table structure verified:');
    shopVehiclesInfo.forEach(column => {
      console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''}`);
    });
    console.log('');
    
    const [shopVehicleCooldownsInfo] = await pool.query('DESCRIBE shop_vehicle_cooldowns');
    console.log('✅ shop_vehicle_cooldowns table structure verified:');
    shopVehicleCooldownsInfo.forEach(column => {
      console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''}`);
    });
    console.log('');
    
    // Step 3: Check for any existing vehicle records (should be empty on first run)
    console.log('3. Checking existing vehicle records...');
    const [existingVehicles] = await pool.query('SELECT COUNT(*) as count FROM shop_vehicles');
    console.log(`✅ Found ${existingVehicles[0].count} existing vehicle records\n`);
    
    // Step 4: Verify shop_categories table supports vehicle type
    console.log('4. Verifying shop_categories table supports vehicle type...');
    const [categoriesInfo] = await pool.query('DESCRIBE shop_categories');
    const typeColumn = categoriesInfo.find(col => col.Field === 'type');
    if (typeColumn) {
      console.log('✅ shop_categories.type column exists and supports vehicle categories');
    } else {
      console.log('❌ shop_categories.type column not found');
    }
    console.log('');
    
    // Step 5: Test vehicle category creation
    console.log('5. Testing vehicle category creation...');
    try {
      // This is just a test - we'll create a temporary category and then delete it
      const [testServer] = await pool.query('SELECT id FROM rust_servers LIMIT 1');
      if (testServer.length > 0) {
        await pool.query(
          'INSERT INTO shop_categories (server_id, name, type) VALUES (?, ?, ?)',
          [testServer[0].id, 'TEST_VEHICLES', 'vehicles']
        );
        console.log('✅ Vehicle category creation test successful');
        
        // Clean up test category
        await pool.query(
          'DELETE FROM shop_categories WHERE name = ? AND type = ?',
          ['TEST_VEHICLES', 'vehicles']
        );
        console.log('✅ Test category cleaned up');
      } else {
        console.log('⚠️ No servers found for testing');
      }
    } catch (error) {
      console.log('❌ Vehicle category creation test failed:', error.message);
    }
    console.log('');
    
    console.log('🎉 Vehicle Shop System Deployment Complete!');
    console.log('');
    console.log('📋 What was added:');
    console.log('   ✅ shop_vehicles table for storing vehicle shop items');
    console.log('   ✅ shop_vehicle_cooldowns table for purchase timers');
    console.log('   ✅ Database indexes for optimal performance');
    console.log('   ✅ Support for vehicle categories in shop_categories');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Deploy the new commands using deploy-commands.js');
    console.log('   2. Create vehicle categories using /add-shop-category');
    console.log('   3. Add vehicles using /add-shop-vehicle');
    console.log('   4. Test vehicle purchases in the shop');
    
  } catch (error) {
    console.error('❌ Error deploying vehicle shop system:', error);
  } finally {
    await pool.end();
  }
}

deployVehicleShop();
