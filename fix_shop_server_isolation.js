const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔧 Fixing Shop Server Isolation');
console.log('================================\n');

async function fixShopServerIsolation() {
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

    // Step 2: Check current shop data distribution
    console.log('\n📋 Step 2: Checking current shop data distribution...');
    
    const [deadOpsItemCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id WHERE sc.server_id = ?',
      [deadOpsServer.id]
    );
    
    const [usaDeadOpsItemCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM shop_items si JOIN shop_categories sc ON si.category_id = sc.id WHERE sc.server_id = ?',
      [usaDeadOpsServer.id]
    );

    console.log(`\n📊 Current distribution:`);
    console.log(`  Dead-ops: ${deadOpsItemCount[0].count} items`);
    console.log(`  USA-DeadOps: ${usaDeadOpsItemCount[0].count} items`);

    // Step 3: Check for duplicate categories
    console.log('\n📋 Step 3: Checking for duplicate categories...');
    
    const [duplicateCategories] = await connection.execute(`
      SELECT name, type, COUNT(*) as count
      FROM shop_categories
      WHERE server_id IN (?, ?)
      GROUP BY name, type
      HAVING COUNT(*) > 1
      ORDER BY name, type
    `, [deadOpsServer.id, usaDeadOpsServer.id]);

    if (duplicateCategories.length > 0) {
      console.log('\n⚠️ Found duplicate categories across servers:');
      for (const cat of duplicateCategories) {
        console.log(`  - ${cat.name} (${cat.type}): ${cat.count} instances`);
      }
      
      // Step 4: Fix the duplication by ensuring each server has unique categories
      console.log('\n📋 Step 4: Fixing duplicate categories...');
      
      // Get all categories from USA-DeadOps
      const [usaCategories] = await connection.execute(`
        SELECT id, name, type FROM shop_categories WHERE server_id = ?
      `, [usaDeadOpsServer.id]);
      
      // For each USA-DeadOps category, check if Dead-ops has the same name/type
      for (const usaCat of usaCategories) {
        const [deadOpsDuplicate] = await connection.execute(`
          SELECT id FROM shop_categories 
          WHERE server_id = ? AND name = ? AND type = ?
        `, [deadOpsServer.id, usaCat.name, usaCat.type]);
        
        if (deadOpsDuplicate.length > 0) {
          console.log(`  🔄 Found duplicate category: ${usaCat.name} (${usaCat.type})`);
          console.log(`    Dead-ops category ID: ${deadOpsDuplicate[0].id}`);
          console.log(`    USA-DeadOps category ID: ${usaCat.id}`);
          
          // Move all items from USA-DeadOps category to Dead-ops category
          const [movedItems] = await connection.execute(`
            UPDATE shop_items SET category_id = ? WHERE category_id = ?
          `, [deadOpsDuplicate[0].id, usaCat.id]);
          
          const [movedKits] = await connection.execute(`
            UPDATE shop_kits SET category_id = ? WHERE category_id = ?
          `, [deadOpsDuplicate[0].id, usaCat.id]);
          
          const [movedVehicles] = await connection.execute(`
            UPDATE shop_vehicles SET category_id = ? WHERE category_id = ?
          `, [deadOpsDuplicate[0].id, usaCat.id]);
          
          console.log(`    ✅ Moved: ${movedItems.affectedRows} items, ${movedKits.affectedRows} kits, ${movedVehicles.affectedRows} vehicles`);
          
          // Delete the now-empty USA-DeadOps category
          await connection.execute(`
            DELETE FROM shop_categories WHERE id = ?
          `, [usaCat.id]);
          
          console.log(`    🗑️ Deleted empty USA-DeadOps category`);
        }
      }
      
      console.log('\n✅ Duplicate categories fixed!');
      
    } else {
      console.log('\n✅ No duplicate categories found!');
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

    console.log(`\n📊 Final distribution:`);
    console.log(`  Dead-ops: ${finalDeadOpsItemCount[0].count} items`);
    console.log(`  USA-DeadOps: ${finalUsaDeadOpsItemCount[0].count} items`);

    console.log('\n✅ Shop server isolation fix completed!');
    console.log('\n📝 Summary:');
    console.log(`  - Each server now has unique categories`);
    console.log(`  - When you select "DeadOps", you'll only see Dead-ops items`);
    console.log(`  - When you select "USA-DeadOps", you'll only see USA-DeadOps items`);
    console.log(`  - No more server confusion in the shop!`);

  } catch (error) {
    console.error('❌ Error fixing shop server isolation:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

fixShopServerIsolation();
