const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabaseStructure() {
  console.log('🔍 Checking Database Structure');
  console.log('==============================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Check if rust_servers table exists
    console.log('\n📋 Checking rust_servers table...');
    try {
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'rust_servers'
      `, [process.env.DB_NAME]);
      
      if (tables.length > 0) {
        console.log('✅ rust_servers table exists');
        
        // Check rust_servers structure
        const [columns] = await connection.execute('DESCRIBE rust_servers');
        console.log('📊 rust_servers columns:');
        columns.forEach(col => {
          console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
        });
        
        // Check for guilds table
        const [guildTables] = await connection.execute(`
          SELECT TABLE_NAME 
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'guilds'
        `, [process.env.DB_NAME]);
        
        if (guildTables.length > 0) {
          console.log('\n✅ guilds table exists');
          const [guildColumns] = await connection.execute('DESCRIBE guilds');
          console.log('📊 guilds columns:');
          guildColumns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
          });
        } else {
          console.log('\n❌ guilds table does not exist');
        }
        
        // Check for players table
        const [playerTables] = await connection.execute(`
          SELECT TABLE_NAME 
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'players'
        `, [process.env.DB_NAME]);
        
        if (playerTables.length > 0) {
          console.log('\n✅ players table exists');
          const [playerColumns] = await connection.execute('DESCRIBE players');
          console.log('📊 players columns:');
          playerColumns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
          });
        } else {
          console.log('\n❌ players table does not exist');
        }
        
      } else {
        console.log('❌ rust_servers table does not exist');
        
        // List all tables
        const [allTables] = await connection.execute(`
          SELECT TABLE_NAME 
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = ?
          ORDER BY TABLE_NAME
        `, [process.env.DB_NAME]);
        
        console.log('\n📋 All tables in database:');
        allTables.forEach(table => {
          console.log(`  - ${table.TABLE_NAME}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error checking tables:', error.message);
    }

    await connection.end();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error connecting to database:', error);
  }
}

checkDatabaseStructure();
