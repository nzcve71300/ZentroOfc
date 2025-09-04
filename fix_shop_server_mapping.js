const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔧 Fixing Shop Server Mapping');
console.log('=============================\n');

async function fixShopServerMapping() {
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

    // Step 2: Check where shop data is currently pointing
    console.log('\n📋 Step 2: Checking where shop data is currently pointing...');
    
    // Check items
    const [itemServerMapping] = await connection.execute(`
      SELECT 
        si.id,
        si.display_name,
        si.short_name,
        sc.name as category_name,
        sc.type as category_type,
        rs.nickname as server_nickname,
        rs.id as server_id
      FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      JOIN rust_servers rs ON sc.server_id = rs.id
      ORDER BY rs.nickname, sc.name, si.display_name
    `);

    // Check kits
    const [kitServerMapping] = await connection.execute(`
      SELECT 
        sk.id,
        sk.display_name,
        sk.kit_name,
        sc.name as category_name,
        sc.type as category_type,
        rs.nickname as server_nickname,
        rs.id as server_id
      FROM shop_kits sk
      JOIN shop_categories sc ON sk.category_id = sc.id
      JOIN rust_servers rs ON sc.server_id = rs.id
      ORDER BY rs.nickname, sc.name, sk.display_name
    `);

    // Check vehicles
    const [vehicleServerMapping] = await connection.execute(`
      SELECT 
        sv.id,
        sv.display_name,
        sv.short_name,
        sc.name as category_name,
        sc.type as category_type,
        rs.nickname as server_nickname,
        rs.id as server_id
      FROM shop_vehicles sv
      JOIN shop_categories sc ON sv.category_id = sc.id
      JOIN rust_servers rs ON sc.server_id = rs.id
      ORDER BY rs.nickname, sc.name, sv.display_name
    `);

    console.log(`\n📦 Current shop data distribution:`);
    console.log(`  - Items: ${itemServerMapping.length} total`);
    console.log(`  - Kits: ${kitServerMapping.length} total`);
    console.log(`  - Vehicles: ${vehicleServerMapping.length} total`);

    // Group by server
    const deadOpsItems = itemServerMapping.filter(item => item.server_nickname === 'Dead-ops');
    const usaDeadOpsItems = itemServerMapping.filter(item => item.server_nickname === 'USA-DeadOps');
    
    const deadOpsKits = kitServerMapping.filter(kit => kit.server_nickname === 'Dead-ops');
    const usaDeadOpsKits = kitServerMapping.filter(kit => kit.server_nickname === 'USA-DeadOps');
    
    const deadOpsVehicles = vehicleServerMapping.filter(vehicle => vehicle.server_nickname === 'Dead-ops');
    const usaDeadOpsVehicles = vehicleServerMapping.filter(vehicle => vehicle.server_nickname === 'USA-DeadOps');

    console.log(`\n📊 Current distribution by server:`);
    console.log(`  Dead-ops: ${deadOpsItems.length} items, ${deadOpsKits.length} kits, ${deadOpsVehicles.length} vehicles`);
    console.log(`  USA-DeadOps: ${usaDeadOpsItems.length} items, ${usaDeadOpsKits.length} kits, ${usaDeadOpsVehicles.length} vehicles`);

    // Step 3: Check if we need to swap the data
    console.log('\n📋 Step 3: Analyzing the current setup...');
    
    if (deadOpsItems.length === 0 && usaDeadOpsItems.length > 0) {
      console.log('❌ Problem detected: Dead-ops server has no items, but USA-DeadOps does!');
      console.log('🔧 This means the shop data is pointing to the wrong server.');
      
      // Step 4: Fix the mapping by updating category server_ids
      console.log('\n📋 Step 4: Fixing the server mapping...');
      
      // Get all categories that currently point to USA-DeadOps but should point to Dead-ops
      const [categoriesToFix] = await connection.execute(`
        SELECT id, name, type, server_id
        FROM shop_categories
        WHERE server_id = ?
      `, [usaDeadOpsServer.id]);
      
      console.log(`\n🏷️ Found ${categoriesToFix.length} categories to fix...`);
      
      for (const category of categoriesToFix) {
        // Check if there's already a category with the same name and type on Dead-ops
        const [existingCategory] = await connection.execute(`
          SELECT id FROM shop_categories 
          WHERE name = ? AND type = ? AND server_id = ?
        `, [category.name, category.type, deadOpsServer.id]);
        
        if (existingCategory.length > 0) {
          console.log(`  ℹ️ Category ${category.name} (${category.type}) already exists on Dead-ops`);
          
          // Update all shop data to point to the Dead-ops category
          const [updateItems] = await connection.execute(`
            UPDATE shop_items SET category_id = ? WHERE category_id = ?
          `, [existingCategory[0].id, category.id]);
          
          const [updateKits] = await connection.execute(`
            UPDATE shop_kits SET category_id = ? WHERE category_id = ?
          `, [existingCategory[0].id, category.id]);
          
          const [updateVehicles] = await connection.execute(`
            UPDATE shop_vehicles SET category_id = ? WHERE category_id = ?
          `, [existingCategory[0].id, category.id]);
          
          console.log(`    ✅ Moved shop data: ${updateItems.affectedRows} items, ${updateKits.affectedRows} kits, ${updateVehicles.affectedRows} vehicles`);
          
        } else {
          console.log(`  ⚠️ No matching category found on Dead-ops for ${category.name} (${category.type})`);
        }
      }
      
      // Step 5: Verify the fix
      console.log('\n📋 Step 5: Verifying the fix...');
      
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

      console.log('\n✅ Shop server mapping fix completed!');
      console.log('\n📝 Summary:');
      console.log(`  - Shop data has been moved to point to the correct Dead-ops categories`);
      console.log(`  - The shop should now work correctly for both servers`);
      console.log(`  - Items purchased from Dead-ops shop will be delivered to Dead-ops server`);
      
    } else {
      console.log('✅ Shop data distribution looks correct!');
      console.log('🔍 The issue might be elsewhere in the code...');
    }

  } catch (error) {
    console.error('❌ Error fixing shop server mapping:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

fixShopServerMapping();
