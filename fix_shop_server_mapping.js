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

    console.log(`\n📊 Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`  - ID: ${server.id}, Name: ${server.nickname}, IP: ${server.ip}:${server.port}`);
    });

    // Step 2: Check current shop categories
    console.log('\n📋 Step 2: Checking current shop categories...');
    const [categories] = await connection.execute(`
      SELECT sc.id, sc.name, sc.type, sc.server_id, rs.nickname as server_name
      FROM shop_categories sc
      JOIN rust_servers rs ON sc.server_id = rs.id
      WHERE rs.nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY rs.nickname, sc.name
    `);

    if (categories.length === 0) {
      console.log('❌ No shop categories found for these servers!');
      return;
    }

    console.log(`\n🏷️ Found ${categories.length} shop categories:`);
    categories.forEach(cat => {
      console.log(`  - Category: ${cat.name} (${cat.type}) -> Server: ${cat.server_name} (ID: ${cat.server_id})`);
    });

    // Step 3: Identify the correct mapping
    console.log('\n📋 Step 3: Identifying the correct mapping...');
    
    // Based on your description:
    // - When you select "DeadOps" in shop → should deliver to USA-DeadOps server
    // - When you select "USA-DeadOps" in shop → should deliver to Dead-ops server
    
    const deadOpsServer = servers.find(s => s.nickname === 'Dead-ops');
    const usaDeadOpsServer = servers.find(s => s.nickname === 'USA-DeadOps');
    
    if (!deadOpsServer || !usaDeadOpsServer) {
      console.log('❌ Could not find both servers!');
      return;
    }

    console.log(`✅ Dead-ops server: ${deadOpsServer.nickname} (ID: ${deadOpsServer.id})`);
    console.log(`✅ USA-DeadOps server: ${usaDeadOpsServer.nickname} (ID: ${usaDeadOpsServer.id})`);

    // Step 4: Find which categories need to be swapped
    console.log('\n📋 Step 4: Identifying categories that need swapping...');
    
    // Categories that currently point to Dead-ops should point to USA-DeadOps
    // Categories that currently point to USA-DeadOps should point to Dead-ops
    const categoriesToSwap = categories.map(cat => {
      if (cat.server_id === deadOpsServer.id) {
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          currentServer: 'Dead-ops',
          newServer: 'USA-DeadOps',
          newServerId: usaDeadOpsServer.id
        };
      } else if (cat.server_id === usaDeadOpsServer.id) {
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          currentServer: 'USA-DeadOps',
          newServer: 'Dead-ops',
          newServerId: deadOpsServer.id
        };
      }
      return null;
    }).filter(Boolean);

    if (categoriesToSwap.length === 0) {
      console.log('✅ No categories need swapping!');
      return;
    }

    console.log(`\n🔧 Found ${categoriesToSwap.length} categories that need swapping:`);
    categoriesToSwap.forEach(cat => {
      console.log(`  - Category: ${cat.categoryName} (${cat.currentServer} → ${cat.newServer})`);
    });

    // Step 5: Swap the server mappings
    console.log('\n📋 Step 5: Swapping server mappings...');
    
    for (const category of categoriesToSwap) {
      console.log(`\n🔧 Updating category "${category.categoryName}"...`);
      console.log(`  - Current server: ${category.currentServer}`);
      console.log(`  - New server: ${category.newServer} (ID: ${category.newServerId})`);
      
      const [updateResult] = await connection.execute(
        'UPDATE shop_categories SET server_id = ? WHERE id = ?',
        [category.newServerId, category.categoryId]
      );
      
      if (updateResult.affectedRows > 0) {
        console.log(`✅ Successfully updated category "${category.categoryName}" to point to ${category.newServer}`);
      } else {
        console.log(`❌ Failed to update category "${category.categoryName}"`);
      }
    }

    // Step 6: Verify the fix
    console.log('\n📋 Step 6: Verifying the fix...');
    const [verifyCategories] = await connection.execute(`
      SELECT sc.id, sc.name, sc.type, sc.server_id, rs.nickname as server_name
      FROM shop_categories sc
      JOIN rust_servers rs ON sc.server_id = rs.id
      WHERE rs.nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY rs.nickname, sc.name
    `);

    console.log(`\n📊 Updated categories:`);
    verifyCategories.forEach(cat => {
      console.log(`  - Category: ${cat.name} (${cat.type}) -> Server: ${cat.server_name} (ID: ${cat.server_id})`);
    });

    console.log('\n✅ Shop server mapping fix completed!');
    console.log('\n📝 Summary:');
    console.log(`  - Shop categories now correctly map to the intended servers`);
    console.log(`  - When you select "DeadOps" in the shop → items will be delivered to USA-DeadOps server`);
    console.log(`  - When you select "USA-DeadOps" in the shop → items will be delivered to Dead-ops server`);
    console.log(`  - The RCON commands will now be sent to the correct IP/port combinations`);

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
