const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔧 Fixing Orphaned Shop Data');
console.log('=============================\n');

async function fixOrphanedShopData() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Step 1: Check current server configuration
    console.log('\n📋 Step 1: Checking current server configuration...');
    const [servers] = await connection.execute(`
      SELECT id, nickname, guild_id, ip, port 
      FROM rust_servers 
      WHERE nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY nickname
    `);

    if (servers.length !== 2) {
      console.log('❌ Expected exactly 2 servers (Dead-ops and USA-DeadOps)!');
      return;
    }

    const deadOpsServer = servers.find(s => s.nickname === 'Dead-ops');
    const usaDeadOpsServer = servers.find(s => s.nickname === 'USA-DeadOps');
    
    console.log(`\n📊 Found servers:`);
    console.log(`  - Dead-ops: ${deadOpsServer.id} (${deadOpsServer.ip}:${deadOpsServer.port})`);
    console.log(`  - USA-DeadOps: ${usaDeadOpsServer.id} (${usaDeadOpsServer.ip}:${usaDeadOpsServer.port})`);

    // Step 2: Check what shop data currently exists and where
    console.log('\n📋 Step 2: Checking current shop data distribution...');
    
    const [deadOpsCategories] = await connection.execute(
      'SELECT id, name, type FROM shop_categories WHERE server_id = ?',
      [deadOpsServer.id]
    );
    
    const [usaDeadOpsCategories] = await connection.execute(
      'SELECT id, name, type FROM shop_categories WHERE server_id = ?',
      [usaDeadOpsServer.id]
    );

    console.log(`\n🏷️ Categories:`);
    console.log(`  - Dead-ops: ${deadOpsCategories.length} categories`);
    console.log(`  - USA-DeadOps: ${usaDeadOpsCategories.length} categories`);

    // Step 3: Find all shop data that should be on Dead-ops server
    console.log('\n📋 Step 3: Finding shop data that should be on Dead-ops server...');
    
    // Get all shop items, kits, and vehicles from USA-DeadOps server
    const [usaItems] = await connection.execute(
      'SELECT si.id, si.display_name, si.short_name, si.price, si.quantity, si.timer, sc.name as category_name, sc.type as category_type FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );
    
    const [usaKits] = await connection.execute(
      'SELECT sk.id, sk.display_name, sk.kit_name, sk.price, sk.quantity, sk.timer, sc.name as category_name, sc.type as category_type FROM shop_kits sk JOIN shop_categories sc ON sk.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );
    
    const [usaVehicles] = await connection.execute(
      'SELECT sv.id, sv.display_name, sv.short_name, sv.price, sv.timer, sc.name as category_name, sc.type as category_type FROM shop_vehicles sv JOIN shop_categories sc ON sv.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );

    console.log(`\n📦 Found on USA-DeadOps server:`);
    console.log(`  - Items: ${usaItems.length}`);
    console.log(`  - Kits: ${usaKits.length}`);
    console.log(`  - Vehicles: ${usaVehicles.length}`);

    // Step 4: Copy shop data to Dead-ops server
    console.log('\n📋 Step 4: Copying shop data to Dead-ops server...');
    
    // Copy items
    console.log('\n📦 Copying items to Dead-ops server...');
    for (const item of usaItems) {
      // Find matching category on Dead-ops server
      const matchingDeadOpsCategory = deadOpsCategories.find(cat => 
        cat.name === item.category_name && cat.type === item.category_type
      );
      
      if (matchingDeadOpsCategory) {
        // Check if item already exists
        const [existingItem] = await connection.execute(
          'SELECT id FROM shop_items WHERE category_id = ? AND display_name = ? AND short_name = ?',
          [matchingDeadOpsCategory.id, item.display_name, item.short_name]
        );

        if (existingItem.length === 0) {
          const [insertResult] = await connection.execute(
            'INSERT INTO shop_items (category_id, display_name, short_name, price, quantity, timer) VALUES (?, ?, ?, ?, ?, ?)',
            [matchingDeadOpsCategory.id, item.display_name, item.short_name, item.price, item.quantity, item.timer]
          );
          console.log(`  ✅ Copied item: ${item.display_name} to ${item.category_name}`);
        } else {
          console.log(`  ℹ️ Item already exists: ${item.display_name} in ${item.category_name}`);
        }
      } else {
        console.log(`  ⚠️ No matching category found for item: ${item.display_name} (${item.category_name})`);
      }
    }

    // Copy kits
    console.log('\n🎒 Copying kits to Dead-ops server...');
    for (const kit of usaKits) {
      // Find matching category on Dead-ops server
      const matchingDeadOpsCategory = deadOpsCategories.find(cat => 
        cat.name === kit.category_name && cat.type === kit.category_type
      );
      
      if (matchingDeadOpsCategory) {
        // Check if kit already exists
        const [existingKit] = await connection.execute(
          'SELECT id FROM shop_kits WHERE category_id = ? AND display_name = ? AND kit_name = ?',
          [matchingDeadOpsCategory.id, kit.display_name, kit.kit_name]
        );

        if (existingKit.length === 0) {
          const [insertResult] = await connection.execute(
            'INSERT INTO shop_kits (category_id, display_name, kit_name, price, quantity, timer) VALUES (?, ?, ?, ?, ?, ?)',
            [matchingDeadOpsCategory.id, kit.display_name, kit.kit_name, kit.price, kit.quantity, kit.timer]
          );
          console.log(`  ✅ Copied kit: ${kit.display_name} to ${kit.category_name}`);
        } else {
          console.log(`  ℹ️ Kit already exists: ${kit.display_name} in ${kit.category_name}`);
        }
      } else {
        console.log(`  ⚠️ No matching category found for kit: ${kit.display_name} (${kit.category_name})`);
      }
    }

    // Copy vehicles
    console.log('\n🚗 Copying vehicles to Dead-ops server...');
    for (const vehicle of usaVehicles) {
      // Find matching category on Dead-ops server
      const matchingDeadOpsCategory = deadOpsCategories.find(cat => 
        cat.name === vehicle.category_name && cat.type === vehicle.category_type
      );
      
      if (matchingDeadOpsCategory) {
        // Check if vehicle already exists
        const [existingVehicle] = await connection.execute(
          'SELECT id FROM shop_vehicles WHERE category_id = ? AND display_name = ? AND short_name = ?',
          [matchingDeadOpsCategory.id, vehicle.display_name, vehicle.short_name]
        );

        if (existingVehicle.length === 0) {
          const [insertResult] = await connection.execute(
            'INSERT INTO shop_vehicles (category_id, display_name, short_name, price, timer) VALUES (?, ?, ?, ?, ?)',
            [matchingDeadOpsCategory.id, vehicle.display_name, vehicle.short_name, vehicle.price, vehicle.timer]
          );
          console.log(`  ✅ Copied vehicle: ${vehicle.display_name} to ${vehicle.category_name}`);
        } else {
          console.log(`  ℹ️ Vehicle already exists: ${vehicle.display_name} in ${vehicle.category_name}`);
        }
      } else {
        console.log(`  ⚠️ No matching category found for vehicle: ${vehicle.display_name} (${vehicle.category_name})`);
      }
    }

    // Step 5: Verify the final setup
    console.log('\n📋 Step 5: Verifying the final setup...');
    
    const [finalDeadOpsItemCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id WHERE sc.server_id = ?',
      [deadOpsServer.id]
    );
    
    const [finalUsaDeadOpsItemCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );

    const [finalDeadOpsKitCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_kits sk JOIN shop_categories sc ON sk.category_id = sc.id WHERE sc.server_id = ?',
      [deadOpsServer.id]
    );
    
    const [finalUsaDeadOpsKitCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_kits sk JOIN shop_categories sc ON sk.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );

    const [finalDeadOpsVehicleCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_vehicles sv JOIN shop_categories sc ON sv.category_id = sc.id WHERE sc.server_id = ?',
      [deadOpsServer.id]
    );
    
    const [finalUsaDeadOpsVehicleCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_vehicles sv JOIN shop_categories sc ON sv.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );

    console.log(`\n📊 Final counts:`);
    console.log(`  Dead-ops: ${finalDeadOpsItemCount[0].count} items, ${finalDeadOpsKitCount[0].count} kits, ${finalDeadOpsVehicleCount[0].count} vehicles`);
    console.log(`  USA-DeadOps: ${finalUsaDeadOpsItemCount[0].count} items, ${finalUsaDeadOpsKitCount[0].count} kits, ${finalUsaDeadOpsVehicleCount[0].count} vehicles`);

    console.log('\n✅ Orphaned shop data fix completed!');
    console.log('\n📝 Summary:');
    console.log(`  - All shop data has been copied to both servers`);
    console.log(`  - Dead-ops server now has all the items, kits, and vehicles`);
    console.log(`  - USA-DeadOps server retains all its data`);
    console.log(`  - Both servers now have identical shop inventories`);

  } catch (error) {
    console.error('❌ Error fixing orphaned shop data:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

fixOrphanedShopData();
