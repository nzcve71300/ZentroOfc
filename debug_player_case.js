const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugPlayerCase() {
  console.log('🔍 DEBUGGING PLAYER CASE SENSITIVITY ISSUES');
  console.log('============================================\n');

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
    const deadOpsServerId = '1756598716651_wmh0kflng';
    const usaDeadOpsServerId = '1756845346677_j63z09una';

    console.log('📋 Step 1: Checking for Waisted_politics variations...\n');
    
    // Check for case variations
    const variations = [
      'Waisted_politics',
      'waisted_politics', 
      'WAISTED_POLITICS',
      'Waisted_Politics'
    ];

    for (const variation of variations) {
      console.log(`🔍 Searching for: "${variation}"`);
      
      // Check players table
      const [players] = await connection.execute(
        'SELECT id, ign, discord_id, server_id FROM players WHERE guild_id = ? AND ign = ?',
        [guildId, variation]
      );
      
      if (players.length > 0) {
        console.log(`  ✅ Found in players table:`);
        players.forEach(p => {
          console.log(`    - ID: ${p.id}, IGN: ${p.ign}, Server: ${p.server_id}`);
        });
      } else {
        console.log(`  ❌ Not found in players table`);
      }

      // Check economy table
      const [economy] = await connection.execute(
        'SELECT e.id, e.player_id, e.balance, p.ign FROM economy e JOIN players p ON e.player_id = p.id WHERE e.guild_id = ? AND p.ign = ?',
        [guildId, variation]
      );
      
      if (economy.length > 0) {
        console.log(`  ✅ Found in economy table:`);
        economy.forEach(e => {
          console.log(`    - Economy ID: ${e.id}, Player ID: ${e.player_id}, Balance: ${e.balance}, IGN: ${e.ign}`);
        });
      } else {
        console.log(`  ❌ Not found in economy table`);
      }
      
      console.log('');
    }

    console.log('📋 Step 2: Checking all players with similar names...\n');
    
    // Search for partial matches
    const [similarPlayers] = await connection.execute(
      'SELECT id, ign, discord_id, server_id FROM players WHERE guild_id = ? AND ign LIKE ?',
      [guildId, '%waisted%']
    );
    
    if (similarPlayers.length > 0) {
      console.log(`  📊 Found ${similarPlayers.length} players with similar names:`);
      similarPlayers.forEach(p => {
        console.log(`    - ID: ${p.id}, IGN: ${p.ign}, Server: ${p.server_id}`);
      });
    } else {
      console.log(`  ❌ No players found with similar names`);
    }

    console.log('\n📋 Step 3: Checking player counts by server...\n');
    
    // Check player counts
    const [deadOpsCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM players WHERE guild_id = ? AND server_id = ?',
      [guildId, deadOpsServerId]
    );
    
    const [usaDeadOpsCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM players WHERE guild_id = ? AND server_id = ?',
      [guildId, usaDeadOpsServerId]
    );
    
    console.log(`  📊 Dead-ops players: ${deadOpsCount[0].count}`);
    console.log(`  📊 USA-DeadOps players: ${usaDeadOpsCount[0].count}`);

    await connection.end();
    console.log('\n✅ Debug complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    if (connection) await connection.end();
  }
}

debugPlayerCase();
