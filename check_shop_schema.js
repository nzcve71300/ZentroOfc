const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkShopSchema() {
  console.log('🔍 Checking Shop Table Schema');
  console.log('==============================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Check shop_categories table structure
    console.log('📋 Step 1: Checking shop_categories table...');
    const [categoriesStructure] = await connection.execute(`DESCRIBE shop_categories`);
    console.log('shop_categories columns:');
    categoriesStructure.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
    });

    // Check shop_items table structure
    console.log('\n📋 Step 2: Checking shop_items table...');
    const [itemsStructure] = await connection.execute(`DESCRIBE shop_items`);
    console.log('shop_items columns:');
    itemsStructure.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
    });

    // Check shop_kits table structure
    console.log('\n📋 Step 3: Checking shop_kits table...');
    const [kitsStructure] = await connection.execute(`DESCRIBE shop_kits`);
    console.log('shop_kits columns:');
    kitsStructure.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
    });

    // Check shop_vehicles table structure
    console.log('\n📋 Step 4: Checking shop_vehicles table...');
    const [vehiclesStructure] = await connection.execute(`DESCRIBE shop_vehicles`);
    console.log('shop_vehicles columns:');
    vehiclesStructure.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
    });

    // Check if there are any existing shop records
    console.log('\n📋 Step 5: Checking existing shop data...');
    const [categoriesCount] = await connection.execute(`SELECT COUNT(*) as count FROM shop_categories`);
    const [itemsCount] = await connection.execute(`SELECT COUNT(*) as count FROM shop_items`);
    const [kitsCount] = await connection.execute(`SELECT COUNT(*) as count FROM shop_kits`);
    const [vehiclesCount] = await connection.execute(`SELECT COUNT(*) as count FROM shop_vehicles`);

    console.log(`Existing shop data:`);
    console.log(`   Categories: ${categoriesCount[0].count}`);
    console.log(`   Items: ${itemsCount[0].count}`);
    console.log(`   Kits: ${kitsCount[0].count}`);
    console.log(`   Vehicles: ${vehiclesCount[0].count}`);

    // If there's data, show a sample record
    if (categoriesCount[0].count > 0) {
      console.log('\n📋 Step 6: Sample category record...');
      const [sampleCategory] = await connection.execute(`SELECT * FROM shop_categories LIMIT 1`);
      console.log('Sample category:', sampleCategory[0]);
    }

    if (itemsCount[0].count > 0) {
      console.log('\n📋 Step 7: Sample item record...');
      const [sampleItem] = await connection.execute(`SELECT * FROM shop_items LIMIT 1`);
      console.log('Sample item:', sampleItem[0]);
    }

  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

checkShopSchema();
