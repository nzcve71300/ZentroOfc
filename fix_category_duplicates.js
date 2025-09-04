const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCategoryDuplicates() {
  console.log('🛠️  Fixing shop category duplicates...\n');
  
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

    // Step 1: Remove duplicate shop categories (keep the one with lowest ID)
    console.log('📂 Removing duplicate shop categories...');
    const [categoriesDeleteResult] = await connection.execute(`
      DELETE c1 FROM shop_categories c1
      INNER JOIN shop_categories c2 
      WHERE c1.id > c2.id 
      AND c1.name = c2.name 
      AND c1.type = c2.type 
      AND c1.server_id = c2.server_id
    `);
    console.log(`   • Removed ${categoriesDeleteResult.affectedRows} duplicate categories`);

    // Step 2: Remove categories with same name but different server_id (keep the one with lowest ID)
    console.log('🔍 Removing categories with same name but different server_id...');
    const [nameDuplicatesDeleteResult] = await connection.execute(`
      DELETE c1 FROM shop_categories c1
      INNER JOIN shop_categories c2 
      WHERE c1.id > c2.id 
      AND c1.name = c2.name
    `);
    console.log(`   • Removed ${nameDuplicatesDeleteResult.affectedRows} name duplicate categories`);

    // Step 3: Add unique constraints to prevent future duplicates
    console.log('\n🔒 Adding unique constraints to prevent future duplicates...');
    
    try {
      await connection.execute(`
        ALTER TABLE shop_categories 
        ADD CONSTRAINT unique_category_per_server 
        UNIQUE (name, type, server_id)
      `);
      console.log('   ✅ Added unique constraint to shop_categories (name, type, server_id)');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Unique constraint already exists on shop_categories');
      } else {
        console.log(`   ⚠️  Could not add constraint to shop_categories: ${error.message}`);
      }
    }

    try {
      await connection.execute(`
        ALTER TABLE shop_categories 
        ADD CONSTRAINT unique_category_name 
        UNIQUE (name)
      `);
      console.log('   ✅ Added unique constraint to shop_categories (name)');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  Unique constraint already exists on shop_categories (name)');
      } else {
        console.log(`   ⚠️  Could not add constraint to shop_categories (name): ${error.message}`);
      }
    }

    // Step 4: Add performance indexes
    console.log('\n🚀 Adding performance indexes...');
    
    try {
      await connection.execute(`CREATE INDEX IF NOT EXISTS idx_shop_categories_name ON shop_categories(name)`);
      console.log('   ✅ Added index to shop_categories (name)');
    } catch (error) {
      console.log(`   ℹ️  Index already exists on shop_categories (name): ${error.message}`);
    }

    try {
      await connection.execute(`CREATE INDEX IF NOT EXISTS idx_shop_categories_server ON shop_categories(server_id)`);
      console.log('   ✅ Added index to shop_categories (server_id)');
    } catch (error) {
      console.log(`   ℹ️  Index already exists on shop_categories (server_id): ${error.message}`);
    }

    // Step 5: Show remaining categories
    console.log('\n📋 Remaining shop categories:');
    const [remainingCategoriesResult] = await connection.execute(`
      SELECT id, name, type, server_id, nickname 
      FROM shop_categories sc
      LEFT JOIN rust_servers rs ON sc.server_id = rs.id
      ORDER BY name, type, server_id
    `);

    remainingCategoriesResult.forEach(category => {
      console.log(`   • ID: ${category.id} - ${category.name} (${category.type}) - Server: ${category.nickname || category.server_id}`);
    });

    // Summary
    const totalRemoved = categoriesDeleteResult.affectedRows + nameDuplicatesDeleteResult.affectedRows;
    console.log(`\n🎉 CATEGORY DUPLICATE CLEANUP COMPLETE!`);
    console.log(`   • Total duplicates removed: ${totalRemoved}`);
    console.log(`   • Exact duplicates cleaned: ${categoriesDeleteResult.affectedRows}`);
    console.log(`   • Name duplicates cleaned: ${nameDuplicatesDeleteResult.affectedRows}`);
    console.log(`   • Remaining categories: ${remainingCategoriesResult.length}`);
    console.log(`\n🔒 Future duplicates are now prevented by database constraints`);
    console.log(`🚀 Performance improved with new indexes`);

  } catch (error) {
    console.error('❌ Error fixing category duplicates:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixCategoryDuplicates();
