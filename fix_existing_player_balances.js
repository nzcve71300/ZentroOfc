const pool = require('./src/db');

async function fixExistingPlayerBalances() {
  try {
    console.log('🔍 Finding players with 0 balance who should have starting balance...');
    
    // Get all players with 0 balance
    const [playersWithZeroBalance] = await pool.query(`
      SELECT p.id, p.ign, p.server_id, rs.nickname, e.balance, egc.setting_value as starting_balance
      FROM players p
      JOIN economy e ON p.id = e.player_id
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN eco_games_config egc ON rs.id = egc.server_id AND egc.setting_name = 'starting_balance'
      WHERE e.balance = 0 AND p.is_active = true
      ORDER BY rs.nickname, p.ign
    `);
    
    console.log(`📋 Found ${playersWithZeroBalance.length} players with 0 balance:`);
    
    if (playersWithZeroBalance.length === 0) {
      console.log('✅ No players with 0 balance found!');
      return;
    }
    
    let updatedCount = 0;
    let currentServer = '';
    
    for (const player of playersWithZeroBalance) {
      if (player.nickname !== currentServer) {
        console.log(`\n🎯 Server: ${player.nickname}`);
        currentServer = player.nickname;
      }
      
      const startingBalance = parseInt(player.starting_balance) || 0;
      
      if (startingBalance > 0) {
        console.log(`   🔧 Updating ${player.ign}: 0 → ${startingBalance} balance`);
        
        await pool.query(
          'UPDATE economy SET balance = ? WHERE player_id = ?',
          [startingBalance, player.id]
        );
        
        // Record this as a transaction
        await pool.query(
          'INSERT INTO transactions (player_id, guild_id, amount, type, timestamp) VALUES (?, (SELECT guild_id FROM players WHERE id = ?), ?, ?, CURRENT_TIMESTAMP)',
          [player.id, player.id, startingBalance, 'starting_balance_fix']
        );
        
        updatedCount++;
      } else {
        console.log(`   ⚠️ ${player.ign}: No starting_balance config (keeping 0)`);
      }
    }
    
    console.log(`\n🎉 Updated ${updatedCount} players with starting balance!`);
    
    if (updatedCount > 0) {
      console.log('\n📋 Verification - Players with updated balances:');
      const [updatedPlayers] = await pool.query(`
        SELECT p.ign, rs.nickname, e.balance
        FROM players p
        JOIN economy e ON p.id = e.player_id
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.is_active = true AND e.balance > 0
        ORDER BY rs.nickname, p.ign
      `);
      
      let currentServer = '';
      for (const player of updatedPlayers) {
        if (player.nickname !== currentServer) {
          console.log(`\n🎯 ${player.nickname}:`);
          currentServer = player.nickname;
        }
        console.log(`   ✅ ${player.ign}: ${player.balance} balance`);
      }
    }
    
    console.log('\n💡 Fix complete! Players should now see their correct starting balance.');
    
  } catch (error) {
    console.error('❌ Error fixing existing player balances:', error);
  } finally {
    await pool.end();
  }
}

fixExistingPlayerBalances();
