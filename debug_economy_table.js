const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugEconomyTable() {
  console.log('🔍 DEBUGGING ECONOMY TABLE STRUCTURE');
  console.log('====================================\n');

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

    // Check economy table structure
    console.log('📋 Checking economy table structure...');
    const [columns] = await connection.execute('DESCRIBE economy');
    console.log('  Economy table columns:');
    columns.forEach(col => {
      console.log(`    - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });

    // Check a few sample records
    console.log('\n📋 Checking sample economy records...');
    const [samples] = await connection.execute('SELECT * FROM economy LIMIT 3');
    console.log('  Sample records:');
    samples.forEach((record, index) => {
      console.log(`    Record ${index + 1}:`, record);
    });

    // Check how economy links to players
    console.log('\n📋 Checking economy to players relationship...');
    const [relationships] = await connection.execute(`
      SELECT e.*, p.ign, p.discord_id, rs.nickname as server_name
      FROM economy e
      LEFT JOIN players p ON e.player_id = p.id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE e.guild_id = 609
      LIMIT 5
    `);
    console.log('  Economy with player info (first 5):');
    relationships.forEach((rel, index) => {
      console.log(`    Record ${index + 1}:`, rel);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the debug
debugEconomyTable().catch(console.error);
