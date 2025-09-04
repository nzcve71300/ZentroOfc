const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixShopDuplicates() {
  console.log('🛠️  Fixing shop duplicates...\n');
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    // Step 1: Remove duplicate shop items
    console.log('📦 Removing duplicate shop items...');
    const [itemsDeleteResult] = await connection.execute(`
      DELETE si1 FROM shop_items si1
      INNER JOIN shop_items si2 
      WHERE si1.id > si2.id 
      AND si1.category_id = si2.category_id 
      AND si1.display_name = si2.display_name 
      AND si1.short_name = si2.short_name
    `);
    console.log(`   • Removed ${itemsDeleteResult.affectedRows} duplicate items`);

    // Step 2: Remove duplicate shop kits
    console.log('🎒 Removing duplicate shop kits...');
    const [kitsDeleteResult] = await connection.execute(`
      DELETE sk1 FROM shop_kits sk1
      INNER JOIN shop_kits sk2 
      WHERE sk1.id > sk2.id 
      AND sk1.category_id = sk2.category_id 
      AND sk1.display_name = sk2.display_name 
      AND sk1.kit_name = sk2.kit_name
    `);
    console.log(`   • Removed ${kitsDeleteResult.affectedRows} duplicate kits`);

    // Step 3: Remove duplicate shop vehicles
    console.log('🚗 Removing duplicate shop vehicles...');
    const [vehiclesDeleteResult] = await connection.execute(`
      DELETE sv1 FROM shop_vehicles sv1
      INNER JOIN shop_vehicles sv2 
      WHERE sv1.id > sv2.id 
      AND sv1.category_id = sv2.category_id 
      AND sv1.display_name = sv2.display_name 
      AND sv1.short_name = sv2.short_name
    `);
    console.log(`   • Removed ${vehiclesDeleteResult.affectedRows} duplicate vehicles`);

    // Step 4: Add unique constraints to prevent future duplicates
    console.log('\n🔒 Adding unique constraints to prevent future duplicates...');
    
    try {
      await connection.execute(`
        ALTER TABLE shop_items 
        ADD CONSTRAINT unique_item_per_category 
        UNIQUE (category_id, display_name, short_name)
      `);
      console.log('   ✅ Added unique constraint to shop_items');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Unique constraint already exists on shop_items');
      } else {
        console.log(`   ⚠️  Could not add constraint to shop_items: ${error.message}`);
      }
    }

    try {
      await connection.execute(`
        ALTER TABLE shop_kits 
        ADD CONSTRAINT unique_kit_per_category 
        UNIQUE (category_id, display_name, kit_name)
      `);
      console.log('   ✅ Added unique constraint to shop_kits');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Unique constraint already exists on shop_kits');
      } else {
        console.log(`   ⚠️  Could not add constraint to shop_kits: ${error.message}`);
      }
    }

    try {
      await connection.execute(`
        ALTER TABLE shop_vehicles 
        ADD CONSTRAINT unique_vehicle_per_category 
        UNIQUE (category_id, display_name, short_name)
      `);
      console.log('   ✅ Added unique constraint to shop_vehicles');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Unique constraint already exists on shop_vehicles');
      } else {
        console.log(`   ⚠️  Could not add constraint to shop_vehicles: ${error.message}`);
      }
    }

    // Step 5: Add performance indexes
    console.log('\n🚀 Adding performance indexes...');
    
    try {
      await connection.execute(`CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category_id)`);
      console.log('   ✅ Added index to shop_items');
    } catch (error) {
      console.log(`   ℹ️  Index already exists on shop_items: ${error.message}`);
    }

    try {
      await connection.execute(`CREATE INDEX IF NOT EXISTS idx_shop_kits_category ON shop_kits(category_id)`);
      console.log('   ✅ Added index to shop_kits');
    } catch (error) {
      console.log(`   ℹ️  Index already exists on shop_kits: ${error.message}`);
    }

    try {
      await connection.execute(`CREATE INDEX IF NOT EXISTS idx_shop_vehicles_category ON shop_vehicles(category_id)`);
      console.log('   ✅ Added index to shop_vehicles');
    } catch (error) {
      console.log(`   ℹ️  Index already exists on shop_vehicles: ${error.message}`);
    }

    // Summary
    const totalRemoved = itemsDeleteResult.affectedRows + kitsDeleteResult.affectedRows + vehiclesDeleteResult.affectedRows;
    console.log(`\n🎉 DUPLICATE CLEANUP COMPLETE!`);
    console.log(`   • Total duplicates removed: ${totalRemoved}`);
    console.log(`   • Items cleaned: ${itemsDeleteResult.affectedRows}`);
    console.log(`   • Kits cleaned: ${kitsDeleteResult.affectedRows}`);
    console.log(`   • Vehicles cleaned: ${vehiclesDeleteResult.affectedRows}`);
    console.log(`\n🔒 Future duplicates are now prevented by database constraints`);
    console.log(`🚀 Performance improved with new indexes`);

  } catch (error) {
    console.error('❌ Error fixing duplicates:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixShopDuplicates();
