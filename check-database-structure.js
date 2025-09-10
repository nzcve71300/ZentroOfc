const mysql = require('mysql2/promise');

async function checkDatabaseStructure() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'zentro_bot',
    password: 'Zandewet@123',
    database: 'zentro_bot'
  });

  try {
    console.log('🔍 Checking database structure...\n');

    // Check servers table
    console.log('📋 SERVERS TABLE:');
    const [servers] = await connection.execute('DESCRIBE servers');
    console.table(servers);
    
    const [serverData] = await connection.execute('SELECT * FROM servers LIMIT 3');
    console.log('Sample servers data:');
    console.table(serverData);

    // Check rust_servers table
    console.log('\n📋 RUST_SERVERS TABLE:');
    const [rustServers] = await connection.execute('DESCRIBE rust_servers');
    console.table(rustServers);
    
    const [rustServerData] = await connection.execute('SELECT * FROM rust_servers LIMIT 3');
    console.log('Sample rust_servers data:');
    console.table(rustServerData);

    // Check shop_categories table
    console.log('\n📋 SHOP_CATEGORIES TABLE:');
    const [shopCategories] = await connection.execute('DESCRIBE shop_categories');
    console.table(shopCategories);
    
    const [shopCategoryData] = await connection.execute('SELECT * FROM shop_categories LIMIT 3');
    console.log('Sample shop_categories data:');
    console.table(shopCategoryData);

    // Check foreign key constraints
    console.log('\n🔗 FOREIGN KEY CONSTRAINTS:');
    const [constraints] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE REFERENCED_TABLE_SCHEMA = 'zentro_bot' 
      AND TABLE_NAME IN ('shop_categories', 'shop_items', 'shop_kits', 'shop_vehicles')
    `);
    console.table(constraints);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkDatabaseStructure();
