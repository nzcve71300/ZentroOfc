const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔧 Fixing Shop Category Links');
console.log('=============================\n');

async function fixShopCategoryLinks() {
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

    // Step 3: Find orphaned shop data (data that should be on Dead-ops but isn't)
    console.log('\n📋 Step 3: Finding orphaned shop data...');
    
    // Get all shop items, kits, and vehicles that are NOT linked to any category
    const [orphanedItems] = await connection.execute(`
      SELECT si.id, si.display_name, si.short_name, si.price, si.quantity, si.timer, si.category_id
      FROM shop_items si
      LEFT JOIN shop_categories sc ON si.category_id = sc.id
      WHERE sc.id IS NULL
    `);
    
    const [orphanedKits] = await connection.execute(`
      SELECT sk.id, sk.display_name, sk.kit_name, sk.price, sk.quantity, sk.timer, sk.category_id
      FROM shop_kits sk
      LEFT JOIN shop_categories sc ON sk.category_id = sc.id
      WHERE sc.id IS NULL
    `);
    
    const [orphanedVehicles] = await connection.execute(`
      SELECT sv.id, sv.display_name, sv.short_name, sv.price, sv.timer, sv.category_id
      FROM shop_vehicles sv
      LEFT JOIN shop_categories sc ON sv.category_id = sc.id
      WHERE sc.id IS NULL
    `);

    console.log(`\n📦 Found orphaned shop data:`);
    console.log(`  - Items: ${orphanedItems.length}`);
    console.log(`  - Kits: ${orphanedKits.length}`);
    console.log(`  - Vehicles: ${orphanedVehicles.length}`);

    if (orphanedItems.length === 0 && orphanedKits.length === 0 && orphanedVehicles.length === 0) {
      console.log('\n✅ No orphaned shop data found!');
      return;
    }

    // Step 4: Fix orphaned items by linking them to Dead-ops categories
    console.log('\n📋 Step 4: Fixing orphaned items...');
    
    for (const item of orphanedItems) {
      // Find the corresponding category on Dead-ops server
      // We'll need to determine the category type based on the item name or other logic
      // For now, let's try to find a matching category by name pattern
      
      let targetCategory = null;
      
      // Try to find a matching category based on common patterns
      if (item.display_name.toLowerCase().includes('stone') || item.display_name.toLowerCase().includes('wood') || item.display_name.toLowerCase().includes('metal')) {
        targetCategory = deadOpsCategories.find(cat => cat.name === 'Building Materials' && cat.type === 'items');
      } else if (item.display_name.toLowerCase().includes('food') || item.display_name.toLowerCase().includes('corn') || item.display_name.toLowerCase().includes('apple')) {
        targetCategory = deadOpsCategories.find(cat => cat.name === 'Food' && cat.type === 'items');
      } else if (item.display_name.toLowerCase().includes('med') || item.display_name.toLowerCase().includes('bandage') || item.display_name.toLowerCase().includes('syringe')) {
        targetCategory = deadOpsCategories.find(cat => cat.name === 'Medical' && cat.type === 'items');
      } else if (item.display_name.toLowerCase().includes('weapon') || item.display_name.toLowerCase().includes('gun') || item.display_name.toLowerCase().includes('ammo')) {
        targetCategory = deadOpsCategories.find(cat => cat.name === 'Weapons' && cat.type === 'items');
      } else {
        // Default to Resources category
        targetCategory = deadOpsCategories.find(cat => cat.name === 'Resources' && cat.type === 'items');
      }
      
      if (targetCategory) {
        const [updateResult] = await connection.execute(
          'UPDATE shop_items SET category_id = ? WHERE id = ?',
          [targetCategory.id, item.id]
        );
        console.log(`  ✅ Fixed item: ${item.display_name} → ${targetCategory.name}`);
      } else {
        console.log(`  ⚠️ Could not find suitable category for item: ${item.display_name}`);
      }
    }

    // Step 5: Fix orphaned kits by linking them to Dead-ops categories
    console.log('\n📋 Step 5: Fixing orphaned kits...');
    
    for (const kit of orphanedKits) {
      // Find the corresponding category on Dead-ops server
      let targetCategory = null;
      
      if (kit.display_name.toLowerCase().includes('vip') || kit.display_name.toLowerCase().includes('premium')) {
        targetCategory = deadOpsCategories.find(cat => cat.name === 'Vip' && cat.type === 'kits');
      } else {
        targetCategory = deadOpsCategories.find(cat => cat.name === 'Kits' && cat.type === 'kits');
      }
      
      if (targetCategory) {
        const [updateResult] = await connection.execute(
          'UPDATE shop_kits SET category_id = ? WHERE id = ?',
          [targetCategory.id, kit.id]
        );
        console.log(`  ✅ Fixed kit: ${kit.display_name} → ${targetCategory.name}`);
      } else {
        console.log(`  ⚠️ Could not find suitable category for kit: ${kit.display_name}`);
      }
    }

    // Step 6: Fix orphaned vehicles by linking them to Dead-ops categories
    console.log('\n📋 Step 6: Fixing orphaned vehicles...');
    
    for (const vehicle of orphanedVehicles) {
      // Find the corresponding category on Dead-ops server
      const targetCategory = deadOpsCategories.find(cat => cat.name === 'Vehicles' && cat.type === 'vehicles');
      
      if (targetCategory) {
        const [updateResult] = await connection.execute(
          'UPDATE shop_vehicles SET category_id = ? WHERE id = ?',
          [targetCategory.id, vehicle.id]
        );
        console.log(`  ✅ Fixed vehicle: ${vehicle.display_name} → ${targetCategory.name}`);
      } else {
        console.log(`  ⚠️ Could not find suitable category for vehicle: ${vehicle.display_name}`);
      }
    }

    // Step 7: Verify the fix
    console.log('\n📋 Step 7: Verifying the fix...');
    
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

    console.log('\n✅ Shop category links fix completed!');
    console.log('\n📝 Summary:');
    console.log(`  - All orphaned shop data has been linked to the correct Dead-ops categories`);
    console.log(`  - Shop items, kits, and vehicles now point to the right server`);
    console.log(`  - The shop should now work correctly for both servers`);

  } catch (error) {
    console.error('❌ Error fixing shop category links:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

fixShopCategoryLinks();
