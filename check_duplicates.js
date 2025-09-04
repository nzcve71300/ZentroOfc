const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkShopDuplicates() {
  console.log('🔍 Checking for shop duplicates...\n');
  
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

    // Check for duplicate shop items
    console.log('📦 Checking shop_items for duplicates...');
    const [itemsResult] = await connection.execute(`
      SELECT 
        category_id,
        display_name,
        short_name,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(id ORDER BY id) as duplicate_ids
      FROM shop_items 
      GROUP BY category_id, display_name, short_name
      HAVING COUNT(*) > 1
      ORDER BY category_id, display_name
    `);

    if (itemsResult.length > 0) {
      console.log(`❌ Found ${itemsResult.length} duplicate item groups:`);
      itemsResult.forEach(item => {
        console.log(`   • ${item.display_name} (${item.short_name}) - ${item.duplicate_count} copies - IDs: ${item.duplicate_ids}`);
      });
    } else {
      console.log('✅ No duplicate items found');
    }

    // Check for duplicate shop kits
    console.log('\n🎒 Checking shop_kits for duplicates...');
    const [kitsResult] = await connection.execute(`
      SELECT 
        category_id,
        display_name,
        kit_name,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(id ORDER BY id) as duplicate_ids
      FROM shop_kits 
      GROUP BY category_id, display_name, kit_name
      HAVING COUNT(*) > 1
      ORDER BY category_id, display_name
    `);

    if (kitsResult.length > 0) {
      console.log(`❌ Found ${kitsResult.length} duplicate kit groups:`);
      kitsResult.forEach(kit => {
        console.log(`   • ${kit.display_name} (${kit.kit_name}) - ${kit.duplicate_count} copies - IDs: ${kit.duplicate_ids}`);
      });
    } else {
      console.log('✅ No duplicate kits found');
    }

    // Check for duplicate shop vehicles
    console.log('\n🚗 Checking shop_vehicles for duplicates...');
    const [vehiclesResult] = await connection.execute(`
      SELECT 
        category_id,
        display_name,
        short_name,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(id ORDER BY id) as duplicate_ids
      FROM shop_vehicles 
      GROUP BY category_id, display_name, short_name
      HAVING COUNT(*) > 1
      ORDER BY category_id, display_name
    `);

    if (vehiclesResult.length > 0) {
      console.log(`❌ Found ${vehiclesResult.length} duplicate vehicle groups:`);
      vehiclesResult.forEach(vehicle => {
        console.log(`   • ${vehicle.display_name} (${vehicle.short_name}) - ${vehicle.duplicate_count} copies - IDs: ${vehicle.duplicate_ids}`);
      });
    } else {
      console.log('✅ No duplicate vehicles found');
    }

    // Summary
    const totalDuplicates = itemsResult.length + kitsResult.length + vehiclesResult.length;
    console.log(`\n📊 SUMMARY:`);
    console.log(`   • Total duplicate groups found: ${totalDuplicates}`);
    console.log(`   • Duplicate items: ${itemsResult.length}`);
    console.log(`   • Duplicate kits: ${kitsResult.length}`);
    console.log(`   • Duplicate vehicles: ${vehiclesResult.length}`);

    if (totalDuplicates > 0) {
      console.log(`\n🛠️  Run 'node fix_duplicates.js' to clean up these duplicates`);
    } else {
      console.log(`\n🎉 No duplicates found! Your shop is clean.`);
    }

  } catch (error) {
    console.error('❌ Error checking duplicates:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
checkShopDuplicates();
