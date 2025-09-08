const pool = require('./src/db');

/**
 * Fix the specific Meliodas balance issue
 * The user's Discord ID is 1170856076569223200 but the script kept the wrong record
 */
async function fixMeliodasBalance() {
  try {
    console.log('🔍 Fixing Meliodas balance issue...\n');
    
    const correctDiscordId = '1170856076569223200';
    const wrongDiscordId = '22115433549209050';
    
    // Find the current state
    console.log('📋 Current state:');
    const [currentRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Meliodas%'
      ORDER BY p.server_id, p.id
    `);
    
    for (const record of currentRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    // Find the correct player record (the one that should be active)
    const [correctPlayer] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = ? AND p.is_active = true
    `, [correctDiscordId]);
    
    if (correctPlayer.length === 0) {
      console.log('❌ No active player found for the correct Discord ID');
      return;
    }
    
    console.log(`\n✅ Found correct player record:`);
    for (const player of correctPlayer) {
      console.log(`  ID=${player.id}, IGN="${player.ign}", Server=${player.nickname}, Balance=${player.balance || 0}`);
    }
    
    // Find the wrong player record (the one that was incorrectly kept)
    const [wrongPlayer] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = ? AND p.is_active = true
    `, [wrongDiscordId]);
    
    if (wrongPlayer.length === 0) {
      console.log('❌ No active player found for the wrong Discord ID');
      return;
    }
    
    console.log(`\n❌ Found wrong player record (should be deactivated):`);
    for (const player of wrongPlayer) {
      console.log(`  ID=${player.id}, IGN="${player.ign}", Server=${player.nickname}, Balance=${player.balance || 0}`);
    }
    
    // Transfer balances from wrong records to correct records
    console.log(`\n🔄 Transferring balances...`);
    
    for (const wrongRecord of wrongPlayer) {
      // Find the corresponding correct record for the same server
      const correctRecord = correctPlayer.find(c => c.server_id === wrongRecord.server_id);
      
      if (!correctRecord) {
        console.log(`  ⚠️ No correct record found for server ${wrongRecord.nickname}, skipping...`);
        continue;
      }
      
      const wrongBalance = wrongRecord.balance || 0;
      const correctBalance = correctRecord.balance || 0;
      const totalBalance = wrongBalance + correctBalance;
      
      console.log(`  📍 Server: ${wrongRecord.nickname}`);
      console.log(`    Wrong record: ID=${wrongRecord.id}, Balance=${wrongBalance}`);
      console.log(`    Correct record: ID=${correctRecord.id}, Balance=${correctBalance}`);
      console.log(`    Transferring ${wrongBalance} to correct record...`);
      
      // Update the correct record with the total balance
      await pool.query('UPDATE economy SET balance = ? WHERE player_id = ?', [totalBalance, correctRecord.id]);
      
      // Deactivate the wrong record
      await pool.query(
        'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Corrected duplicate merge - wrong Discord ID" WHERE id = ?',
        [wrongRecord.id]
      );
      
      // Delete the wrong economy record
      await pool.query('DELETE FROM economy WHERE player_id = ?', [wrongRecord.id]);
      
      console.log(`    ✅ Transferred! New balance: ${totalBalance}`);
    }
    
    // Verify the fix
    console.log(`\n🔍 Verifying fix...`);
    const [finalRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Meliodas%'
      ORDER BY p.server_id, p.id
    `);
    
    console.log('📋 Final state:');
    for (const record of finalRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    console.log('\n🎉 Meliodas balance fix completed!');
    console.log('The user should now see the correct balance when they run /balance');
    
  } catch (error) {
    console.error('❌ Error fixing Meliodas balance:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixMeliodasBalance();
