const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCategoryDuplicates() {
  console.log('🔍 Checking for shop category duplicates...\n');
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    // Check for duplicate shop categories
    console.log('📂 Checking shop_categories for duplicates...');
    const [categoriesResult] = await connection.execute(`
      SELECT 
        name,
        type,
        server_id,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(id ORDER BY id) as duplicate_ids
      FROM shop_categories 
      GROUP BY name, type, server_id
      HAVING COUNT(*) > 1
      ORDER BY name, type
    `);

    if (categoriesResult.length > 0) {
      console.log(`❌ Found ${categoriesResult.length} duplicate category groups:`);
      categoriesResult.forEach(category => {
        console.log(`   • ${category.name} (${category.type}) - Server: ${category.server_id} - ${category.duplicate_count} copies - IDs: ${category.duplicate_ids}`);
      });
    } else {
      console.log('✅ No duplicate categories found');
    }

    // Check for duplicate shop categories with same name but different server_id
    console.log('\n🔍 Checking for categories with same name but different server_id...');
    const [nameDuplicatesResult] = await connection.execute(`
      SELECT 
        name,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(CONCAT(type, ':', server_id) ORDER BY type, server_id) as type_server_combos,
        GROUP_CONCAT(id ORDER BY id) as duplicate_ids
      FROM shop_categories 
      GROUP BY name
      HAVING COUNT(*) > 1
      ORDER BY name
    `);

    if (nameDuplicatesResult.length > 0) {
      console.log(`❌ Found ${nameDuplicatesResult.length} category name duplicates:`);
      nameDuplicatesResult.forEach(category => {
        console.log(`   • ${category.name} - ${category.duplicate_count} copies - Types/Servers: ${category.type_server_combos} - IDs: ${category.duplicate_ids}`);
      });
    } else {
      console.log('✅ No category name duplicates found');
    }

    // Show all categories
    console.log('\n📋 All shop categories:');
    const [allCategoriesResult] = await connection.execute(`
      SELECT id, name, type, server_id, nickname 
      FROM shop_categories sc
      LEFT JOIN rust_servers rs ON sc.server_id = rs.id
      ORDER BY name, type, server_id
    `);

    allCategoriesResult.forEach(category => {
      console.log(`   • ID: ${category.id} - ${category.name} (${category.type}) - Server: ${category.nickname || category.server_id}`);
    });

    // Summary
    const totalDuplicates = categoriesResult.length + nameDuplicatesResult.length;
    console.log(`\n📊 SUMMARY:`);
    console.log(`   • Total duplicate groups found: ${totalDuplicates}`);
    console.log(`   • Exact duplicates: ${categoriesResult.length}`);
    console.log(`   • Name duplicates: ${nameDuplicatesResult.length}`);

    if (totalDuplicates > 0) {
      console.log(`\n🛠️  Run 'node fix_category_duplicates.js' to clean up these duplicates`);
    } else {
      console.log(`\n🎉 No duplicates found! Your categories are clean.`);
    }

  } catch (error) {
    console.error('❌ Error checking category duplicates:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
checkCategoryDuplicates();
