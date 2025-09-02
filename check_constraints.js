const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkConstraints() {
  console.log('🔍 Checking Database Constraints');
  console.log('==============================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Check table structure and constraints
    console.log('📋 Table Structure:');
    console.log('-------------------');
    
    const [tableInfo] = await connection.execute(`
      SHOW CREATE TABLE players
    `);
    
    console.log('Players table structure:');
    console.log(tableInfo[0]['Create Table']);
    
    // Check indexes
    console.log('\n🔑 Indexes:');
    console.log('------------');
    
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM players
    `);
    
    for (const index of indexes) {
      console.log(`Index: ${index.Key_name}, Column: ${index.Column_name}, Non_unique: ${index.Non_unique}`);
    }
    
    // Check current data structure
    console.log('\n📊 Current Data Sample:');
    console.log('------------------------');
    
    const [sampleData] = await connection.execute(`
      SELECT id, guild_id, server_id, discord_id, ign, is_active
      FROM players 
      WHERE guild_id = 609 
      LIMIT 5
    `);
    
    console.log('Sample players in guild 609:');
    for (const player of sampleData) {
      console.log(`  ID: ${player.id}, Guild: ${player.guild_id}, Server: ${player.server_id}, Discord: ${player.discord_id}, IGN: ${player.ign}, Active: ${player.is_active}`);
    }
    
    // Check if there are any existing players on USA-DeadOps
    console.log('\n🔍 Checking USA-DeadOps Players:');
    console.log('--------------------------------');
    
    const [usaPlayers] = await connection.execute(`
      SELECT p.*, rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE rs.nickname = 'USA-DeadOps'
      AND p.is_active = true
    `);
    
    console.log(`Found ${usaPlayers.length} players on USA-DeadOps:`);
    for (const player of usaPlayers) {
      console.log(`  ${player.ign} (Discord: ${player.discord_id})`);
    }

  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

checkConstraints();
