const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugRestorationConflict() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Debugging restoration conflict...');
    
    // Check the range of player_ids in economy table
    const [economyRange] = await connection.execute(`
      SELECT 
        MIN(player_id) as min_player_id,
        MAX(player_id) as max_player_id,
        COUNT(*) as total_records
      FROM economy
    `);
    
    console.log('📊 Economy table player_id range:');
    console.log(`   Min: ${economyRange[0].min_player_id}`);
    console.log(`   Max: ${economyRange[0].max_player_id}`);
    console.log(`   Total records: ${economyRange[0].total_records}`);

    // Check players table auto-increment and range
    const [playersInfo] = await connection.execute(`
      SELECT 
        AUTO_INCREMENT,
        (SELECT MIN(id) FROM players) as min_id,
        (SELECT MAX(id) FROM players) as max_id,
        (SELECT COUNT(*) FROM players) as total_players
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'players'
    `, [process.env.DB_NAME]);
    
    console.log('\n📊 Players table info:');
    console.log(`   AUTO_INCREMENT: ${playersInfo[0].AUTO_INCREMENT}`);
    console.log(`   Min ID: ${playersInfo[0].min_id}`);
    console.log(`   Max ID: ${playersInfo[0].max_id}`);
    console.log(`   Total players: ${playersInfo[0].total_players}`);

    // Check for economy records with player_ids that are higher than the current players max
    const [futureEconomy] = await connection.execute(`
      SELECT player_id, balance, guild_id
      FROM economy
      WHERE player_id > ?
      ORDER BY player_id
      LIMIT 10
    `, [playersInfo[0].max_id]);
    
    if (futureEconomy.length > 0) {
      console.log('\n🚨 Economy records with player_ids higher than current players max:');
      futureEconomy.forEach(record => {
        console.log(`   player_id: ${record.player_id}, balance: ${record.balance}, guild_id: ${record.guild_id}`);
      });
    } else {
      console.log('\n✅ No economy records with future player_ids found');
    }

    // Check for gaps in player_ids in economy table
    const [gaps] = await connection.execute(`
      SELECT 
        e1.player_id + 1 as gap_start,
        MIN(e2.player_id) - 1 as gap_end
      FROM economy e1
      LEFT JOIN economy e2 ON e2.player_id > e1.player_id
      WHERE e1.player_id + 1 < (SELECT MAX(player_id) FROM economy)
      GROUP BY e1.player_id
      HAVING gap_start < gap_end
      ORDER BY gap_start
      LIMIT 10
    `);
    
    if (gaps.length > 0) {
      console.log('\n🕳️ Gaps in economy player_ids:');
      gaps.forEach(gap => {
        console.log(`   Gap from ${gap.gap_start} to ${gap.gap_end}`);
      });
    }

    // Check if there are any economy records that would conflict with the next few auto-increment values
    const nextAutoIncrement = playersInfo[0].AUTO_INCREMENT;
    const [conflicts] = await connection.execute(`
      SELECT player_id, balance, guild_id
      FROM economy
      WHERE player_id >= ?
      ORDER BY player_id
      LIMIT 20
    `, [nextAutoIncrement]);
    
    if (conflicts.length > 0) {
      console.log(`\n🚨 Economy records that would conflict with next auto-increment values (starting from ${nextAutoIncrement}):`);
      conflicts.forEach(record => {
        console.log(`   player_id: ${record.player_id}, balance: ${record.balance}, guild_id: ${record.guild_id}`);
      });
    } else {
      console.log(`\n✅ No conflicts with next auto-increment values (starting from ${nextAutoIncrement})`);
    }

    // Check for any economy records without corresponding players
    const [orphanedEconomy] = await connection.execute(`
      SELECT e.player_id, e.balance, e.guild_id
      FROM economy e
      LEFT JOIN players p ON e.player_id = p.id
      WHERE p.id IS NULL
      ORDER BY e.player_id
      LIMIT 10
    `);
    
    if (orphanedEconomy.length > 0) {
      console.log('\n🚨 Orphaned economy records (no corresponding player):');
      orphanedEconomy.forEach(record => {
        console.log(`   player_id: ${record.player_id}, balance: ${record.balance}, guild_id: ${record.guild_id}`);
      });
    } else {
      console.log('\n✅ No orphaned economy records found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

debugRestorationConflict();
