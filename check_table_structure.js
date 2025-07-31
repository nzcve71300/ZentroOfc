const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTableStructure() {
  console.log('🔍 Table Structure Check');
  console.log('========================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('📋 Guilds table structure:');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guilds'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME]);

    for (const column of columns) {
      console.log(`- ${column.COLUMN_NAME}: ${column.DATA_TYPE}${column.CHARACTER_MAXIMUM_LENGTH ? `(${column.CHARACTER_MAXIMUM_LENGTH})` : ''} ${column.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    }

    console.log('\n🔍 Current discord_id values:');
    const [guilds] = await connection.execute('SELECT id, name, discord_id, LENGTH(discord_id) as length FROM guilds');
    
    for (const guild of guilds) {
      console.log(`Guild ${guild.id}: "${guild.name}" - Discord ID: ${guild.discord_id} (length: ${guild.length})`);
    }

    await connection.end();

    console.log('\n💡 SOLUTION:');
    console.log('If discord_id is BIGINT/INT, we need to:');
    console.log('1. ALTER TABLE guilds MODIFY COLUMN discord_id VARCHAR(20)');
    console.log('2. Then update the values');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTableStructure(); 