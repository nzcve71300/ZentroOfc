const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔧 Fixing Server Mapping Issue');
console.log('==============================\n');

async function fixServerMapping() {
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

    if (servers.length === 0) {
      console.log('❌ No servers found with names Dead-ops or USA-DeadOps!');
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

    // Step 3: Identify the correct server for DeadOps (the actual game server)
    console.log('\n📋 Step 3: Identifying the correct server mapping...');
    
    // The server with IP 149.102.131.118:33016 should be the actual DeadOps server
    const actualDeadOpsServer = servers.find(s => s.ip === '149.102.131.118' && s.port === 33016);
    
    if (!actualDeadOpsServer) {
      console.log('❌ Could not find the actual DeadOps server (149.102.131.118:33016)!');
      return;
    }

    console.log(`✅ Actual DeadOps server: ${actualDeadOpsServer.nickname} (ID: ${actualDeadOpsServer.id})`);

    // Step 4: Find which shop categories need to be fixed
    console.log('\n📋 Step 4: Identifying categories that need fixing...');
    
    // Categories that should point to the actual DeadOps server
    const categoriesToFix = categories.filter(cat => {
      // If the category name suggests it's for DeadOps but points to wrong server
      return cat.server_id !== actualDeadOpsServer.id;
    });

    if (categoriesToFix.length === 0) {
      console.log('✅ All categories are already correctly mapped!');
      return;
    }

    console.log(`\n🔧 Found ${categoriesToFix.length} categories that need fixing:`);
    categoriesToFix.forEach(cat => {
      console.log(`  - Category: ${cat.name} (${cat.type}) currently points to ${cat.server_name}, should point to ${actualDeadOpsServer.nickname}`);
    });

    // Step 5: Fix the server mapping
    console.log('\n📋 Step 5: Fixing server mapping...');
    
    for (const category of categoriesToFix) {
      console.log(`\n🔧 Updating category "${category.name}" (${category.type})...`);
      
      const [updateResult] = await connection.execute(
        'UPDATE shop_categories SET server_id = ? WHERE id = ?',
        [actualDeadOpsServer.id, category.id]
      );
      
      if (updateResult.affectedRows > 0) {
        console.log(`✅ Successfully updated category "${category.name}" to point to ${actualDeadOpsServer.nickname}`);
      } else {
        console.log(`❌ Failed to update category "${category.name}"`);
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

    console.log('\n✅ Server mapping fix completed!');
    console.log('\n📝 Summary:');
    console.log(`  - Shop categories now correctly point to the actual DeadOps server`);
    console.log(`  - When you select "DeadOps" in the shop, items will be delivered to the correct server`);
    console.log(`  - The RCON commands will be sent to the right IP/port combination`);

  } catch (error) {
    console.error('❌ Error fixing server mapping:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

fixServerMapping();