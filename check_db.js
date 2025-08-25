const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected!');

    // Check players table structure
    const [columns] = await connection.execute('DESCRIBE players');
    console.log('\n📋 Players table columns:');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type}`);
    });

    // Check if is_active exists
    const hasIsActive = columns.some(col => col.Field === 'is_active');
    console.log(`\n🔍 Has is_active: ${hasIsActive}`);

    // Check if unlinked_at exists  
    const hasUnlinkedAt = columns.some(col => col.Field === 'unlinked_at');
    console.log(`🔍 Has unlinked_at: ${hasUnlinkedAt}`);

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDB();
