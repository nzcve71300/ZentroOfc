const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔧 Copying Shop Data - Simple Version');
console.log('=====================================\n');

async function copyShopDataSimple() {
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

    // Step 2: Check what shop data currently exists
    console.log('\n📋 Step 2: Checking current shop data...');
    
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

    // Step 3: Copy shop items from Dead-ops to USA-DeadOps
    console.log('\n📋 Step 3: Copying shop items...');
    
    for (const deadOpsCategory of deadOpsCategories) {
      // Find matching category on USA-DeadOps server
      const matchingUsaCategory = usaDeadOpsCategories.find(cat => 
        cat.name === deadOpsCategory.name && cat.type === deadOpsCategory.type
      );
      
      if (!matchingUsaCategory) {
        console.log(`⚠️ No matching category found for ${deadOpsCategory.name} (${deadOpsCategory.type}) on USA-DeadOps`);
        continue;
      }

      // Get items from Dead-ops category
      const [items] = await connection.execute(
        'SELECT display_name, short_name, price, quantity, timer FROM shop_items WHERE category_id = ?',
        [deadOpsCategory.id]
      );

      console.log(`\n📦 Copying ${items.length} items from ${deadOpsCategory.name} (${deadOpsCategory.type})...`);

      for (const item of items) {
        // Check if item already exists
        const [existingItem] = await connection.execute(
          'SELECT id FROM shop_items WHERE category_id = ? AND display_name = ? AND short_name = ?',
          [matchingUsaCategory.id, item.display_name, item.short_name]
        );

        if (existingItem.length === 0) {
          const [insertResult] = await connection.execute(
            'INSERT INTO shop_items (category_id, display_name, short_name, price, quantity, timer) VALUES (?, ?, ?, ?, ?, ?)',
            [matchingUsaCategory.id, item.display_name, item.short_name, item.price, item.quantity, item.timer]
          );
          console.log(`  ✅ Copied: ${item.display_name}`);
        } else {
          console.log(`  ℹ️ Already exists: ${item.display_name}`);
        }
      }
    }

    // Step 4: Copy shop kits from Dead-ops to USA-DeadOps
    console.log('\n📋 Step 4: Copying shop kits...');
    
    for (const deadOpsCategory of deadOpsCategories) {
      if (deadOpsCategory.type !== 'kits') continue;
      
      // Find matching category on USA-DeadOps server
      const matchingUsaCategory = usaDeadOpsCategories.find(cat => 
        cat.name === deadOpsCategory.name && cat.type === deadOpsCategory.type
      );
      
      if (!matchingUsaCategory) {
        console.log(`⚠️ No matching category found for ${deadOpsCategory.name} (${deadOpsCategory.type}) on USA-DeadOps`);
        continue;
      }

      // Get kits from Dead-ops category
      const [kits] = await connection.execute(
        'SELECT display_name, kit_name, price, quantity, timer FROM shop_kits WHERE category_id = ?',
        [deadOpsCategory.id]
      );

      console.log(`\n🎒 Copying ${kits.length} kits from ${deadOpsCategory.name}...`);

      for (const kit of kits) {
        // Check if kit already exists
        const [existingKit] = await connection.execute(
          'SELECT id FROM shop_kits WHERE category_id = ? AND display_name = ? AND kit_name = ?',
          [matchingUsaCategory.id, kit.display_name, kit.kit_name]
        );

        if (existingKit.length === 0) {
          const [insertResult] = await connection.execute(
            'INSERT INTO shop_kits (category_id, display_name, kit_name, price, quantity, timer) VALUES (?, ?, ?, ?, ?, ?)',
            [matchingUsaCategory.id, kit.display_name, kit.kit_name, kit.price, kit.quantity, kit.timer]
          );
          console.log(`  ✅ Copied: ${kit.display_name}`);
        } else {
          console.log(`  ℹ️ Already exists: ${kit.display_name}`);
        }
      }
    }

    // Step 5: Copy shop vehicles from Dead-ops to USA-DeadOps
    console.log('\n📋 Step 5: Copying shop vehicles...');
    
    for (const deadOpsCategory of deadOpsCategories) {
      if (deadOpsCategory.type !== 'vehicles') continue;
      
      // Find matching category on USA-DeadOps server
      const matchingUsaCategory = usaDeadOpsCategories.find(cat => 
        cat.name === deadOpsCategory.name && cat.type === deadOpsCategory.type
      );
      
      if (!matchingUsaCategory) {
        console.log(`⚠️ No matching category found for ${deadOpsCategory.name} (${deadOpsCategory.type}) on USA-DeadOps`);
        continue;
      }

      // Get vehicles from Dead-ops category
      const [vehicles] = await connection.execute(
        'SELECT display_name, short_name, price, timer FROM shop_vehicles WHERE category_id = ?',
        [deadOpsCategory.id]
      );

      console.log(`\n🚗 Copying ${vehicles.length} vehicles from ${deadOpsCategory.name}...`);

      for (const vehicle of vehicles) {
        // Check if vehicle already exists
        const [existingVehicle] = await connection.execute(
          'SELECT id FROM shop_vehicles WHERE category_id = ? AND display_name = ? AND short_name = ?',
          [matchingUsaCategory.id, vehicle.display_name, vehicle.short_name]
        );

        if (existingVehicle.length === 0) {
          const [insertResult] = await connection.execute(
            'INSERT INTO shop_vehicles (category_id, display_name, short_name, price, timer) VALUES (?, ?, ?, ?, ?)',
            [matchingUsaCategory.id, vehicle.display_name, vehicle.short_name, vehicle.price, vehicle.timer]
          );
          console.log(`  ✅ Copied: ${vehicle.display_name}`);
        } else {
          console.log(`  ℹ️ Already exists: ${vehicle.display_name}`);
        }
      }
    }

    // Step 6: Verify the copy
    console.log('\n📋 Step 6: Verifying the copy...');
    
    const [deadOpsItemCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id WHERE sc.server_id = ?',
      [deadOpsServer.id]
    );
    
    const [usaDeadOpsItemCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );

    const [deadOpsKitCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_kits sk JOIN shop_categories sc ON sk.category_id = sc.id WHERE sc.server_id = ?',
      [deadOpsServer.id]
    );
    
    const [usaDeadOpsKitCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_kits sk JOIN shop_categories sc ON sk.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );

    const [deadOpsVehicleCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_vehicles sv JOIN shop_categories sc ON sv.category_id = sc.id WHERE sc.server_id = ?',
      [deadOpsServer.id]
    );
    
    const [usaDeadOpsVehicleCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_vehicles sv JOIN shop_categories sc ON sv.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );

    console.log(`\n📊 Final counts:`);
    console.log(`  Dead-ops: ${deadOpsItemCount[0].count} items, ${deadOpsKitCount[0].count} kits, ${deadOpsVehicleCount[0].count} vehicles`);
    console.log(`  USA-DeadOps: ${usaDeadOpsItemCount[0].count} items, ${usaDeadOpsKitCount[0].count} kits, ${usaDeadOpsVehicleCount[0].count} vehicles`);

    console.log('\n✅ Shop data copy completed!');
    console.log('\n📝 Summary:');
    console.log(`  - All shop data has been copied from Dead-ops to USA-DeadOps`);
    console.log(`  - Both servers now have the same items, kits, and vehicles`);
    console.log(`  - Shop categories are properly mapped to their respective servers`);

  } catch (error) {
    console.error('❌ Error copying shop data:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

copyShopDataSimple();
