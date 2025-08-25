const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPlayersTable() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Check table structure
    const [columns] = await connection.execute('DESCRIBE players');
    console.log('\n📋 Players table structure:');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Check if is_active column exists
    const hasIsActive = columns.some(col => col.Field === 'is_active');
    console.log(`\n🔍 Has is_active column: ${hasIsActive ? 'YES' : 'NO'}`);

    // Check if unlinked_at column exists
    const hasUnlinkedAt = columns.some(col => col.Field === 'unlinked_at');
    console.log(`🔍 Has unlinked_at column: ${hasUnlinkedAt ? 'YES' : 'NO'}`);

    // Show sample data
    const [sampleData] = await connection.execute('SELECT * FROM players LIMIT 3');
    console.log('\n📊 Sample player data:');
    sampleData.forEach((row, index) => {
      console.log(`  Player ${index + 1}:`, row);
    });

    await connection.end();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error checking players table:', error);
  }
}

checkPlayersTable();
