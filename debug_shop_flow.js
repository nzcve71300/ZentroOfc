const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔍 Debugging Shop Flow');
console.log('======================\n');

async function debugShopFlow() {
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

    // Step 1: Check the shop command structure
    console.log('\n📋 Step 1: Checking shop command structure...');
    
    // Check how the shop command works
    const [shopCommand] = await connection.execute(`
      SELECT 
        rs.nickname as server_nickname,
        rs.id as server_id,
        rs.ip,
        rs.port,
        sc.name as category_name,
        sc.type as category_type,
        sc.id as category_id,
        COUNT(si.id) as item_count
      FROM rust_servers rs
      LEFT JOIN shop_categories sc ON rs.id = sc.server_id
      LEFT JOIN shop_items si ON sc.id = si.category_id
      WHERE rs.nickname IN ('Dead-ops', 'USA-DeadOps')
      GROUP BY rs.id, sc.id
      ORDER BY rs.nickname, sc.name
    `);

    console.log('\n🏷️ Shop structure by server:');
    let currentServer = '';
    for (const row of shopCommand) {
      if (row.server_nickname !== currentServer) {
        currentServer = row.server_nickname;
        console.log(`\n📡 ${currentServer}:`);
      }
      if (row.category_name) {
        console.log(`  - ${row.category_name} (${row.category_type}): ${row.item_count} items`);
      }
    }

    // Step 2: Check a specific item to see its server mapping
    console.log('\n📋 Step 2: Checking specific item server mapping...');
    
    const [itemMapping] = await connection.execute(`
      SELECT 
        si.id,
        si.display_name,
        si.short_name,
        sc.name as category_name,
        sc.type as category_type,
        rs.nickname as server_nickname,
        rs.id as server_id,
        rs.ip,
        rs.port
      FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      JOIN rust_servers rs ON sc.server_id = rs.id
      WHERE rs.nickname IN ('Dead-ops', 'USA-DeadOps')
      LIMIT 5
    `);

    console.log('\n📦 Sample items and their server mapping:');
    for (const item of itemMapping) {
      console.log(`  - ${item.display_name} (${item.short_name})`);
      console.log(`    Category: ${item.category_name} (${item.category_type})`);
      console.log(`    Server: ${item.server_nickname} (${item.server_id})`);
      console.log(`    RCON: ${item.ip}:${item.port}`);
      console.log('');
    }

    // Step 3: Check if there's a mismatch in the shop command logic
    console.log('\n📋 Step 3: Checking for potential shop command issues...');
    
    // Look for any items that might be pointing to the wrong server
    const [mismatchedItems] = await connection.execute(`
      SELECT 
        si.id,
        si.display_name,
        sc.name as category_name,
        rs.nickname as actual_server,
        rs.ip as actual_ip,
        rs.port as actual_port
      FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      JOIN rust_servers rs ON sc.server_id = rs.id
      WHERE rs.nickname = 'Dead-ops'
      LIMIT 3
    `);

    if (mismatchedItems.length > 0) {
      console.log('\n🔍 Items that should go to Dead-ops server:');
      for (const item of mismatchedItems) {
        console.log(`  - ${item.display_name} in ${item.category_name}`);
        console.log(`    Will be delivered to: ${item.actual_server} (${item.actual_ip}:${item.actual_port})`);
      }
    }

    console.log('\n📝 Analysis:');
    console.log('  - Both servers have shop items');
    console.log('  - The issue might be in the shop command logic');
    console.log('  - When you select "DeadOps", it should use Dead-ops server');
    console.log('  - When you select "USA-DeadOps", it should use USA-DeadOps server');
    console.log('  - Check if the shop command is correctly identifying the server');

  } catch (error) {
    console.error('❌ Error debugging shop flow:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

debugShopFlow();
