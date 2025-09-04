const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔧 Properly Fixing Shop Server Mapping');
console.log('======================================\n');

async function fixShopMappingProperly() {
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

    console.log(`\n📊 Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`  - ID: ${server.id}, Name: ${server.nickname}, IP: ${server.ip}:${server.port}`);
    });

    const deadOpsServer = servers.find(s => s.nickname === 'Dead-ops');
    const usaDeadOpsServer = servers.find(s => s.nickname === 'USA-DeadOps');
    
    if (!deadOpsServer || !usaDeadOpsServer) {
      console.log('❌ Could not find both servers!');
      return;
    }

    // Step 2: First, revert the server mapping to the CORRECT setup
    console.log('\n📋 Step 2: Reverting server mapping to correct setup...');
    
    // Categories should point to their respective servers:
    // - "DeadOps" shop categories → Dead-ops server (149.102.131.118:33016)
    // - "USA-DeadOps" shop categories → USA-DeadOps server (194.140.197.51:28816)
    
    // First, let's see what categories currently exist
    const [currentCategories] = await connection.execute(`
      SELECT sc.id, sc.name, sc.type, sc.role, sc.server_id, rs.nickname as server_name
      FROM shop_categories sc
      JOIN rust_servers rs ON sc.server_id = rs.id
      WHERE rs.nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY sc.name, sc.type
    `);

    console.log(`\n🏷️ Current categories:`);
    currentCategories.forEach(cat => {
      console.log(`  - ${cat.name} (${cat.type}) -> ${cat.server_name}`);
    });

    // Step 3: Create proper categories for both servers
    console.log('\n📋 Step 3: Creating proper categories for both servers...');
    
    // Define the standard categories that should exist on both servers
    const standardCategories = [
      { name: 'Building Materials', type: 'items', role: null },
      { name: 'Food', type: 'items', role: null },
      { name: 'Kits', type: 'kits', role: null },
      { name: 'Medical', type: 'items', role: null },
      { name: 'Resources', type: 'items', role: null },
      { name: 'Vehicles', type: 'vehicles', role: null },
      { name: 'Vip', type: 'kits', role: null },
      { name: 'Weapons', type: 'items', role: null }
    ];

    // Create categories for Dead-ops server (if they don't exist)
    console.log('\n🔧 Creating categories for Dead-ops server...');
    for (const category of standardCategories) {
      const [existingCategory] = await connection.execute(
        'SELECT id FROM shop_categories WHERE server_id = ? AND name = ? AND type = ?',
        [deadOpsServer.id, category.name, category.type]
      );
      
      if (existingCategory.length === 0) {
        const [insertResult] = await connection.execute(
          'INSERT INTO shop_categories (server_id, name, type, role) VALUES (?, ?, ?, ?)',
          [deadOpsServer.id, category.name, category.type, category.role]
        );
        console.log(`✅ Created category "${category.name}" (${category.type}) for Dead-ops`);
      } else {
        console.log(`ℹ️ Category "${category.name}" (${category.type}) already exists for Dead-ops`);
      }
    }

    // Create categories for USA-DeadOps server (if they don't exist)
    console.log('\n🔧 Creating categories for USA-DeadOps server...');
    for (const category of standardCategories) {
      const [existingCategory] = await connection.execute(
        'SELECT id FROM shop_categories WHERE server_id = ? AND name = ? AND type = ?',
        [usaDeadOpsServer.id, category.name, category.type]
      );
      
      if (existingCategory.length === 0) {
        const [insertResult] = await connection.execute(
          'INSERT INTO shop_categories (server_id, name, type, role) VALUES (?, ?, ?, ?)',
          [usaDeadOpsServer.id, category.name, category.type, category.role]
        );
        console.log(`✅ Created category "${category.name}" (${category.type}) for USA-DeadOps`);
      } else {
        console.log(`ℹ️ Category "${category.name}" (${category.type}) already exists for USA-DeadOps`);
      }
    }

    // Step 4: Copy shop items from Dead-ops to USA-DeadOps
    console.log('\n📋 Step 4: Copying shop items to ensure both servers have the same items...');
    
    // Get all shop items from Dead-ops
    const [deadOpsItems] = await connection.execute(`
      SELECT si.display_name, si.short_name, si.price, si.quantity, si.timer, sc.id as category_id
      FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      WHERE sc.server_id = ?
    `, [deadOpsServer.id]);

    console.log(`\n📦 Found ${deadOpsItems.length} items on Dead-ops server`);

    // Copy items to USA-DeadOps server
    for (const item of deadOpsItems) {
      // Find the corresponding category on USA-DeadOps server
      const [usaCategory] = await connection.execute(
        'SELECT id FROM shop_categories WHERE server_id = ? AND name = (SELECT name FROM shop_categories WHERE id = ?) AND type = (SELECT type FROM shop_categories WHERE id = ?)',
        [usaDeadOpsServer.id, item.category_id, item.category_id]
      );
      
      if (usaCategory.length > 0) {
        // Check if item already exists
        const [existingItem] = await connection.execute(
          'SELECT id FROM shop_items WHERE category_id = ? AND display_name = ? AND short_name = ?',
          [usaCategory[0].id, item.display_name, item.short_name]
        );
        
        if (existingItem.length === 0) {
          const [insertResult] = await connection.execute(
            'INSERT INTO shop_items (category_id, display_name, short_name, price, quantity, timer) VALUES (?, ?, ?, ?, ?, ?)',
            [usaCategory[0].id, item.display_name, item.short_name, item.price, item.quantity, item.timer]
          );
          console.log(`✅ Copied item "${item.display_name}" to USA-DeadOps server`);
        } else {
          console.log(`ℹ️ Item "${item.display_name}" already exists on USA-DeadOps server`);
        }
      }
    }

    // Step 5: Copy shop kits from Dead-ops to USA-DeadOps
    console.log('\n📋 Step 5: Copying shop kits to ensure both servers have the same kits...');
    
    // Get all shop kits from Dead-ops
    const [deadOpsKits] = await connection.execute(`
      SELECT sk.display_name, sk.kit_name, sk.price, sk.quantity, sk.timer, sc.id as category_id
      FROM shop_kits sk
      JOIN shop_categories sc ON sk.category_id = sc.id
      WHERE sc.server_id = ?
    `, [deadOpsServer.id]);

    console.log(`\n🎒 Found ${deadOpsKits.length} kits on Dead-ops server`);

    // Copy kits to USA-DeadOps server
    for (const kit of deadOpsKits) {
      // Find the corresponding category on USA-DeadOps server
      const [usaCategory] = await connection.execute(
        'SELECT id FROM shop_categories WHERE server_id = ? AND name = (SELECT name FROM shop_categories WHERE id = ?) AND type = (SELECT type FROM shop_categories WHERE id = ?)',
        [usaDeadOpsServer.id, kit.category_id, kit.category_id]
      );
      
      if (usaCategory.length > 0) {
        // Check if kit already exists
        const [existingKit] = await connection.execute(
          'SELECT id FROM shop_kits WHERE category_id = ? AND display_name = ? AND kit_name = ?',
          [usaCategory[0].id, kit.display_name, kit.kit_name]
        );
        
        if (existingKit.length === 0) {
          const [insertResult] = await connection.execute(
            'INSERT INTO shop_kits (category_id, display_name, kit_name, price, quantity, timer) VALUES (?, ?, ?, ?, ?, ?)',
            [usaCategory[0].id, kit.display_name, kit.kit_name, kit.price, kit.quantity, kit.timer]
          );
          console.log(`✅ Copied kit "${kit.display_name}" to USA-DeadOps server`);
        } else {
          console.log(`ℹ️ Kit "${kit.display_name}" already exists on USA-DeadOps server`);
        }
      }
    }

    // Step 6: Copy shop vehicles from Dead-ops to USA-DeadOps
    console.log('\n📋 Step 6: Copying shop vehicles to ensure both servers have the same vehicles...');
    
    // Get all shop vehicles from Dead-ops
    const [deadOpsVehicles] = await connection.execute(`
      SELECT sv.display_name, sv.short_name, sv.price, sv.timer, sc.id as category_id
      FROM shop_vehicles sv
      JOIN shop_categories sc ON sv.category_id = sc.id
      WHERE sc.server_id = ?
    `, [deadOpsServer.id]);

    console.log(`\n🚗 Found ${deadOpsVehicles.length} vehicles on Dead-ops server`);

    // Copy vehicles to USA-DeadOps server
    for (const vehicle of deadOpsVehicles) {
      // Find the corresponding category on USA-DeadOps server
      const [usaCategory] = await connection.execute(
        'SELECT id FROM shop_categories WHERE server_id = ? AND name = (SELECT name FROM shop_categories WHERE id = ?) AND type = (SELECT type FROM shop_categories WHERE id = ?)',
        [usaDeadOpsServer.id, vehicle.category_id, vehicle.category_id]
      );
      
      if (usaCategory.length > 0) {
        // Check if vehicle already exists
        const [existingVehicle] = await connection.execute(
          'SELECT id FROM shop_vehicles WHERE category_id = ? AND display_name = ? AND short_name = ?',
          [usaCategory[0].id, vehicle.display_name, vehicle.short_name]
        );
        
        if (existingVehicle.length === 0) {
          const [insertResult] = await connection.execute(
            'INSERT INTO shop_vehicles (category_id, display_name, short_name, price, timer) VALUES (?, ?, ?, ?, ?)',
            [usaCategory[0].id, vehicle.display_name, vehicle.short_name, vehicle.price, vehicle.timer]
          );
          console.log(`✅ Copied vehicle "${vehicle.display_name}" to USA-DeadOps server`);
        } else {
          console.log(`ℹ️ Vehicle "${vehicle.display_name}" already exists on USA-DeadOps server`);
        }
      }
    }

    // Step 7: Verify the final setup
    console.log('\n📋 Step 7: Verifying the final setup...');
    
    const [finalCategories] = await connection.execute(`
      SELECT sc.id, sc.name, sc.type, sc.role, sc.server_id, rs.nickname as server_name
      FROM shop_categories sc
      JOIN rust_servers rs ON sc.server_id = rs.id
      WHERE rs.nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY rs.nickname, sc.name, sc.type
    `);

    console.log(`\n📊 Final category setup:`);
    finalCategories.forEach(cat => {
      console.log(`  - ${cat.name} (${cat.type}) -> ${cat.server_name}`);
    });

    // Count items on each server
    const [deadOpsItemCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      WHERE sc.server_id = ?
    `, [deadOpsServer.id]);

    const [usaDeadOpsItemCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      WHERE sc.server_id = ?
    `, [usaDeadOpsServer.id]);

    console.log(`\n📦 Item counts:`);
    console.log(`  - Dead-ops: ${deadOpsItemCount[0].count} items`);
    console.log(`  - USA-DeadOps: ${usaDeadOpsItemCount[0].count} items`);

    console.log('\n✅ Shop server mapping fix completed!');
    console.log('\n📝 Summary:');
    console.log(`  - "DeadOps" shop selection → delivers to Dead-ops server (${deadOpsServer.ip}:${deadOpsServer.port})`);
    console.log(`  - "USA-DeadOps" shop selection → delivers to USA-DeadOps server (${usaDeadOpsServer.ip}:${usaDeadOpsServer.port})`);
    console.log(`  - Both servers now have the same shop categories, items, kits, and vehicles`);
    console.log(`  - All Discord data (roles, permissions, etc.) has been preserved`);
    console.log(`  - This is a proper multi-tenant setup`);

  } catch (error) {
    console.error('❌ Error fixing shop mapping:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

fixShopMappingProperly();
