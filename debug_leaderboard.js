const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugLeaderboard() {
  console.log('🔍 DEBUGGING LEADERBOARD ISSUES');
  console.log('================================\n');

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

    const guildId = 609; // Database guild ID for DEAD-OPS 10x

    console.log('📋 Step 1: Checking economy table structure...\n');
    
    // Check if economy table exists and has data
    try {
      const [economyCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM economy WHERE guild_id = ?',
        [guildId]
      );
      console.log(`  📊 Economy records for guild ${guildId}: ${economyCount[0].count}`);
      
      // Check a few sample economy records
      const [samples] = await connection.execute(
        'SELECT * FROM economy WHERE guild_id = ? LIMIT 3',
        [guildId]
      );
      console.log('  Sample economy records:', samples);
      
    } catch (error) {
      console.log(`  ❌ Economy table error: ${error.message}`);
    }

    console.log('\n📋 Step 2: Checking players table...\n');
    
    try {
      const [playerCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM players WHERE guild_id = ?',
        [guildId]
      );
      console.log(`  📊 Player records for guild ${guildId}: ${playerCount[0].count}`);
      
    } catch (error) {
      console.log(`  ❌ Players table error: ${error.message}`);
    }

    console.log('\n📋 Step 3: Testing leaderboard query...\n');
    
    try {
      // Try to run a typical leaderboard query
      const [leaderboard] = await connection.execute(`
        SELECT p.ign, e.balance, rs.nickname as server_name
        FROM economy e
        JOIN players p ON e.player_id = p.id
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE e.guild_id = ?
        ORDER BY e.balance DESC
        LIMIT 10
      `, [guildId]);
      
      console.log(`  ✅ Leaderboard query successful: ${leaderboard.length} results`);
      console.log('  Top 3 players:');
      leaderboard.slice(0, 3).forEach((player, index) => {
        console.log(`    ${index + 1}. ${player.ign} - ${player.balance} (${player.server_name})`);
      });
      
    } catch (error) {
      console.log(`  ❌ Leaderboard query failed: ${error.message}`);
      console.log(`  Error code: ${error.code}`);
      console.log(`  SQL State: ${error.sqlState}`);
    }

    console.log('\n📋 Step 4: Checking for common issues...\n');
    
    // Check if there are any NULL values that could cause issues
    try {
      const [nullCheck] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM economy e
        JOIN players p ON e.player_id = p.id
        WHERE e.guild_id = ? AND (e.player_id IS NULL OR p.ign IS NULL OR e.balance IS NULL)
      `, [guildId]);
      
      console.log(`  📊 Records with NULL values: ${nullCheck[0].count}`);
      
    } catch (error) {
      console.log(`  ❌ NULL check failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Connection error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the debug
debugLeaderboard().catch(console.error);
