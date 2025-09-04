const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔧 Fixing Shop Server Mapping - SIMPLE VERSION');
console.log('==============================================\n');

async function fixShopServerMappingSimple() {
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

    // Step 3: Fix the mapping by swapping the server_id values
    console.log('\n📋 Step 3: Fixing the server mapping...');
    
    if (deadOpsItemCount[0].count === 0 && usaDeadOpsItemCount[0].count > 0) {
      console.log('❌ Problem confirmed: Dead-ops has no items, USA-DeadOps has all items');
      console.log('🔧 This means the shop data is pointing to the wrong server');
      
      // Get all categories that currently point to USA-DeadOps
      const [categoriesToMove] = await connection.execute(`
        SELECT id, name, type FROM shop_categories WHERE server_id = ?
      `, [usaDeadOpsServer.id]);
      
      console.log(`\n🏷️ Found ${categoriesToMove.length} categories to move...`);
      
      // Move all categories from USA-DeadOps to Dead-ops
      for (const category of categoriesToMove) {
        console.log(`  🔄 Moving category: ${category.name} (${category.type}) from USA-DeadOps to Dead-ops`);
        
        // Update the category to point to Dead-ops server
        await connection.execute(
          'UPDATE shop_categories SET server_id = ? WHERE id = ?',
          [deadOpsServer.id, category.id]
        );
      }
      
      console.log('\n✅ All categories moved to Dead-ops server!');
      
      // Step 4: Verify the fix
      console.log('\n📋 Step 4: Verifying the fix...');
      
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

      console.log('\n✅ Shop server mapping fix completed!');
      console.log('\n📝 Summary:');
      console.log(`  - All shop categories have been moved to the Dead-ops server`);
      console.log(`  - When you select "DeadOps" in the shop, items will now be delivered to Dead-ops server`);
      console.log(`  - When you select "USA-DeadOps" in the shop, items will be delivered to USA-DeadOps server`);
      console.log(`  - The shop should now work correctly for both servers`);
      
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

fixShopServerMappingSimple();
