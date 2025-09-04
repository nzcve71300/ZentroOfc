const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCrossServerPlayers() {
  console.log('🔗 FIXING CROSS-SERVER PLAYER RECORDS');
  console.log('=====================================\n');

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

    console.log('📋 Step 1: Finding all unique players across both servers...\n');
    
    // Get all unique players from both servers
    const [allPlayers] = await connection.execute(
      `SELECT DISTINCT ign, discord_id 
       FROM players 
       WHERE guild_id = ? 
       AND server_id IN (?, ?)`,
      [guildId, deadOpsServerId, usaDeadOpsServerId]
    );

    console.log(`  📊 Found ${allPlayers.length} unique players total\n`);

    console.log('📋 Step 2: Checking which players are missing from each server...\n');
    
    let deadOpsMissing = 0;
    let usaDeadOpsMissing = 0;
    let created = 0;

    for (const player of allPlayers) {
      // Check if player exists on Dead-ops
      const [deadOpsPlayer] = await connection.execute(
        'SELECT id FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
        [guildId, deadOpsServerId, player.ign]
      );

      // Check if player exists on USA-DeadOps
      const [usaDeadOpsPlayer] = await connection.execute(
        'SELECT id FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
        [guildId, usaDeadOpsServerId, player.ign]
      );

      // Create missing record on Dead-ops
      if (deadOpsPlayer.length === 0) {
        try {
          await connection.execute(
            'INSERT INTO players (guild_id, server_id, ign, discord_id, linked_at) VALUES (?, ?, ?, ?, NOW())',
            [guildId, deadOpsServerId, player.ign, player.discord_id]
          );
          console.log(`  ✅ Created Dead-ops record for: ${player.ign}`);
          deadOpsMissing++;
          created++;
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            console.log(`  ⚠️ Dead-ops record already exists for: ${player.ign}`);
          } else {
            console.log(`  ❌ Failed to create Dead-ops record for ${player.ign}: ${error.message}`);
          }
        }
      }

      // Create missing record on USA-DeadOps
      if (usaDeadOpsPlayer.length === 0) {
        try {
          await connection.execute(
            'INSERT INTO players (guild_id, server_id, ign, discord_id, linked_at) VALUES (?, ?, ?, ?, NOW())',
            [guildId, usaDeadOpsServerId, player.ign, player.discord_id]
          );
          console.log(`  ✅ Created USA-DeadOps record for: ${player.ign}`);
          usaDeadOpsMissing++;
          created++;
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            console.log(`  ⚠️ USA-DeadOps record already exists for: ${player.ign}`);
          } else {
            console.log(`  ❌ Failed to create USA-DeadOps record for ${player.ign}: ${error.message}`);
          }
        }
      }
    }

    console.log('\n📋 Step 3: Verifying final player counts...\n');
    
    // Check final counts
    const [deadOpsCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM players WHERE guild_id = ? AND server_id = ?',
      [guildId, deadOpsServerId]
    );
    
    const [usaDeadOpsCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM players WHERE guild_id = ? AND server_id = ?',
      [guildId, usaDeadOpsServerId]
    );
    
    console.log(`  📊 Final Dead-ops players: ${deadOpsCount[0].count}`);
    console.log(`  📊 Final USA-DeadOps players: ${usaDeadOpsCount[0].count}`);
    console.log(`  📊 Records created: ${created}`);

    await connection.end();
    console.log('\n✅ Cross-server player fix complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    if (connection) await connection.end();
  }
}

fixCrossServerPlayers();
