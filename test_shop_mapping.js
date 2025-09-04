const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🧪 Testing Shop Mapping');
console.log('=======================\n');

async function testShopMapping() {
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

    // Test 1: Check what happens when we query a specific item
    console.log('\n📋 Test 1: Querying a specific shop item...');
    
    const [itemTest] = await connection.execute(`
      SELECT 
        si.id,
        si.display_name,
        si.short_name,
        sc.name as category_name,
        sc.server_id as category_server_id,
        rs.nickname as server_nickname,
        rs.ip,
        rs.port
      FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      JOIN rust_servers rs ON sc.server_id = rs.id
      WHERE rs.nickname = 'Dead-ops'
      LIMIT 1
    `);

    if (itemTest.length > 0) {
      const item = itemTest[0];
      console.log(`\n📦 Found item: ${item.display_name}`);
      console.log(`  Category: ${item.category_name}`);
      console.log(`  Category server_id: ${item.category_server_id}`);
      console.log(`  Server: ${item.server_nickname}`);
      console.log(`  RCON: ${item.ip}:${item.port}`);
      
      // Test 2: Simulate the exact query from handleConfirmPurchase
      console.log('\n📋 Test 2: Simulating handleConfirmPurchase query...');
      
      const [confirmPurchaseTest] = await connection.execute(`
        SELECT si.display_name, si.short_name, si.price, si.quantity, si.timer, rs.id as server_id, rs.ip, rs.port, rs.password, rs.nickname 
        FROM shop_items si 
        JOIN shop_categories sc ON si.category_id = sc.id 
        JOIN rust_servers rs ON sc.server_id = rs.id 
        WHERE si.id = ?
      `, [item.id]);
      
      if (confirmPurchaseTest.length > 0) {
        const purchaseData = confirmPurchaseTest[0];
        console.log(`\n🔍 Purchase query result:`);
        console.log(`  Item: ${purchaseData.display_name}`);
        console.log(`  Server ID: ${purchaseData.server_id}`);
        console.log(`  Server Nickname: ${purchaseData.nickname}`);
        console.log(`  RCON IP: ${purchaseData.ip}`);
        console.log(`  RCON Port: ${purchaseData.port}`);
        
        // Test 3: Check if this matches the expected Dead-ops server
        const [deadOpsServer] = await connection.execute(
          'SELECT id, nickname, ip, port FROM rust_servers WHERE nickname = ?',
          ['Dead-ops']
        );
        
        if (deadOpsServer.length > 0) {
          const expectedServer = deadOpsServer[0];
          console.log(`\n🎯 Expected Dead-ops server:`);
          console.log(`  ID: ${expectedServer.id}`);
          console.log(`  Nickname: ${expectedServer.nickname}`);
          console.log(`  IP: ${expectedServer.ip}`);
          console.log(`  Port: ${expectedServer.port}`);
          
          if (purchaseData.server_id === expectedServer.id) {
            console.log('\n✅ SUCCESS: Item is correctly mapped to Dead-ops server!');
            console.log('🔍 The issue must be elsewhere in the code...');
          } else {
            console.log('\n❌ PROBLEM: Item is mapped to wrong server!');
            console.log(`  Expected: ${expectedServer.id} (Dead-ops)`);
            console.log(`  Got: ${purchaseData.server_id} (${purchaseData.nickname})`);
          }
        }
      }
    }

    // Test 4: Check if there are any items pointing to the wrong server
    console.log('\n📋 Test 4: Checking for items pointing to wrong server...');
    
    const [wrongServerItems] = await connection.execute(`
      SELECT 
        si.id,
        si.display_name,
        sc.name as category_name,
        rs.nickname as actual_server,
        rs.ip,
        rs.port
      FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      JOIN rust_servers rs ON sc.server_id = rs.id
      WHERE rs.nickname = 'USA-DeadOps'
      LIMIT 3
    `);
    
    if (wrongServerItems.length > 0) {
      console.log('\n⚠️ Found items pointing to USA-DeadOps server:');
      for (const item of wrongServerItems) {
        console.log(`  - ${item.display_name} in ${item.category_name}`);
        console.log(`    Server: ${item.actual_server} (${item.ip}:${item.port})`);
      }
      console.log('\n🔧 This explains the issue! Items are pointing to USA-DeadOps server.');
    } else {
      console.log('\n✅ No items pointing to USA-DeadOps server found.');
    }

  } catch (error) {
    console.error('❌ Error testing shop mapping:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

testShopMapping();
