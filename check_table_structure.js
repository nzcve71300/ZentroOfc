const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

async function checkTableStructure() {
  try {
    console.log('🔍 Checking MariaDB table structure...');
    
    // Get all tables
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [process.env.DB_NAME]);
    
    console.log(`\n📊 Found ${tables.length} tables:`);
    tables.forEach(table => console.log(`  - ${table.TABLE_NAME}`));
    
    // Check structure of key tables
    const keyTables = ['guilds', 'rust_servers', 'players', 'economy', 'shop_categories', 'autokits'];
    
    for (const tableName of keyTables) {
      console.log(`\n📋 Structure of ${tableName}:`);
      try {
        const [columns] = await pool.execute(`
          SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [process.env.DB_NAME, tableName]);
        
        if (columns.length > 0) {
          columns.forEach(col => {
            console.log(`  ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : ''} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''} ${col.EXTRA || ''}`);
          });
        } else {
          console.log(`  ❌ Table ${tableName} not found`);
        }
      } catch (error) {
        console.log(`  ❌ Error checking ${tableName}: ${error.message}`);
      }
    }
    
    // Check foreign keys
    console.log('\n🔗 Foreign Key Relationships:');
    const [foreignKeys] = await pool.execute(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? 
      AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, COLUMN_NAME
    `, [process.env.DB_NAME]);
    
    foreignKeys.forEach(fk => {
      console.log(`  ${fk.TABLE_NAME}.${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error checking table structure:', error.message);
    await pool.end();
  }
}

checkTableStructure(); 