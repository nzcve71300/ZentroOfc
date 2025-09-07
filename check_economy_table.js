const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkEconomyTable() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Checking economy table structure...');
    
    // Check table structure
    const [structure] = await connection.execute('DESCRIBE economy');
    console.log('📋 Economy table structure:');
    structure.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? col.Key : ''} ${col.Default ? 'DEFAULT ' + col.Default : ''}`);
    });

    // Check constraints (MariaDB syntax)
    const [constraints] = await connection.execute(`
      SELECT 
        tc.CONSTRAINT_NAME,
        tc.CONSTRAINT_TYPE,
        kcu.COLUMN_NAME
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.KEY_COLUMN_USAGE kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME 
        AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      WHERE tc.TABLE_SCHEMA = ? AND tc.TABLE_NAME = 'economy'
      ORDER BY tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `, [process.env.DB_NAME]);
    
    console.log('\n🔒 Economy table constraints:');
    constraints.forEach(constraint => {
      console.log(`   ${constraint.CONSTRAINT_NAME}: ${constraint.CONSTRAINT_TYPE} on ${constraint.COLUMN_NAME}`);
    });

    // Check for orphaned economy records
    const [orphaned] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM economy e
      LEFT JOIN players p ON e.player_id = p.id
      WHERE p.id IS NULL
    `);
    
    console.log(`\n🚨 Orphaned economy records: ${orphaned[0].count}`);

    // Check for duplicate player_ids in economy
    const [duplicates] = await connection.execute(`
      SELECT player_id, COUNT(*) as count
      FROM economy
      GROUP BY player_id
      HAVING COUNT(*) > 1
    `);
    
    console.log(`\n🔄 Duplicate player_ids in economy: ${duplicates.length}`);
    if (duplicates.length > 0) {
      console.log('   Examples:');
      duplicates.slice(0, 5).forEach(dup => {
        console.log(`      player_id ${dup.player_id}: ${dup.count} records`);
      });
    }

    // Check current auto-increment value for players table
    const [autoIncrement] = await connection.execute(`
      SELECT AUTO_INCREMENT 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'players'
    `, [process.env.DB_NAME]);
    
    console.log(`\n🔢 Players table AUTO_INCREMENT: ${autoIncrement[0].AUTO_INCREMENT}`);

    // Check max player_id in economy table
    const [maxPlayerId] = await connection.execute(`
      SELECT MAX(player_id) as max_player_id, COUNT(*) as total_records
      FROM economy
    `);
    
    console.log(`📊 Economy table: max player_id = ${maxPlayerId[0].max_player_id}, total records = ${maxPlayerId[0].total_records}`);

    // Check for economy records with player_ids that don't exist in players table
    const [missingPlayers] = await connection.execute(`
      SELECT e.player_id, e.balance, e.guild_id
      FROM economy e
      LEFT JOIN players p ON e.player_id = p.id
      WHERE p.id IS NULL
      LIMIT 10
    `);
    
    if (missingPlayers.length > 0) {
      console.log(`\n🚨 Economy records with missing players (first 10):`);
      missingPlayers.forEach(record => {
        console.log(`   player_id: ${record.player_id}, balance: ${record.balance}, guild_id: ${record.guild_id}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkEconomyTable();
