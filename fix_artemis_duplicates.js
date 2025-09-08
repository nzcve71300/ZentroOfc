const pool = require('./src/db');

/**
 * Fix Artemis2689 duplicate player records
 */
async function fixArtemisDuplicates() {
  try {
    console.log('🔍 Fixing Artemis2689 duplicate records...\n');
    
    // Based on the analysis:
    // Dead-ops: ID=19850 (Discord=651542249139179900, Balance=403550) vs ID=20000 (Discord=680226741960441900, Balance=3000)
    // USA-DeadOps: ID=8867 (Discord=null, Balance=1400) vs ID=20001 (Discord=680226741960441900, Balance=3000)
    
    // We need to determine which Discord ID is correct
    // From the user's original message, they mentioned Discord ID 651542249139179900
    // So we'll keep that one and merge the others
    
    const correctDiscordId = 651542249139179900;
    const wrongDiscordId = 680226741960441900;
    
    console.log('📋 Plan:');
    console.log(`  Keep Discord ID: ${correctDiscordId} (ID=19850 on Dead-ops)`);
    console.log(`  Merge Discord ID: ${wrongDiscordId} (ID=20000 on Dead-ops, ID=20001 on USA-DeadOps)`);
    console.log(`  Merge no Discord ID: ID=8867 on USA-DeadOps`);
    
    // Step 1: Get current balances
    const [deadopsCorrect] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [19850]);
    const [deadopsWrong] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [20000]);
    const [usaNoDiscord] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [8867]);
    const [usaWrong] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [20001]);
    
    const deadopsCorrectBal = deadopsCorrect[0]?.balance || 0;
    const deadopsWrongBal = deadopsWrong[0]?.balance || 0;
    const usaNoDiscordBal = usaNoDiscord[0]?.balance || 0;
    const usaWrongBal = usaWrong[0]?.balance || 0;
    
    console.log(`\n💰 Current balances:`);
    console.log(`  Dead-ops correct (ID=19850): ${deadopsCorrectBal}`);
    console.log(`  Dead-ops wrong (ID=20000): ${deadopsWrongBal}`);
    console.log(`  USA no Discord (ID=8867): ${usaNoDiscordBal}`);
    console.log(`  USA wrong (ID=20001): ${usaWrongBal}`);
    
    // Step 2: Create USA-DeadOps record for correct Discord ID if it doesn't exist
    console.log(`\n🔄 Step 1: Creating USA-DeadOps record for correct Discord ID...`);
    
    // Check if correct Discord ID already has USA-DeadOps record
    const [usaCorrectCheck] = await pool.query(`
      SELECT p.id FROM players p 
      WHERE p.discord_id = ? AND p.server_id = (SELECT id FROM rust_servers WHERE nickname = 'USA-DeadOps')
    `, [correctDiscordId]);
    
    let usaCorrectId;
    if (usaCorrectCheck.length === 0) {
      // Create new record - need to get guild_id from existing record
      const [usaServer] = await pool.query('SELECT id FROM rust_servers WHERE nickname = ?', ['USA-DeadOps']);
      const [existingRecord] = await pool.query('SELECT guild_id FROM players WHERE id = ?', [8867]); // Get guild_id from existing record
      
      const [result] = await pool.query(
        'INSERT INTO players (ign, discord_id, server_id, guild_id, is_active, linked_at) VALUES (?, ?, ?, ?, true, CURRENT_TIMESTAMP)',
        ['Artemis2689', correctDiscordId, usaServer[0].id, existingRecord[0].guild_id]
      );
      usaCorrectId = result.insertId;
      console.log(`  ✅ Created new USA-DeadOps record: ID=${usaCorrectId}`);
    } else {
      usaCorrectId = usaCorrectCheck[0].id;
      console.log(`  ✅ USA-DeadOps record already exists: ID=${usaCorrectId}`);
    }
    
    // Step 3: Transfer USA-DeadOps balances
    const totalUsaBalance = usaNoDiscordBal + usaWrongBal;
    console.log(`\n💰 Step 2: Transferring USA-DeadOps balances...`);
    console.log(`  Transferring ${totalUsaBalance} (${usaNoDiscordBal} + ${usaWrongBal}) to correct record`);
    
    await pool.query('UPDATE economy SET balance = ? WHERE player_id = ?', [totalUsaBalance, usaCorrectId]);
    console.log(`  ✅ Transferred ${totalUsaBalance} to correct USA-DeadOps record`);
    
    // Step 4: Transfer Dead-ops balances
    const totalDeadopsBalance = deadopsCorrectBal + deadopsWrongBal;
    console.log(`\n💰 Step 3: Transferring Dead-ops balances...`);
    console.log(`  Transferring ${totalDeadopsBalance} (${deadopsCorrectBal} + ${deadopsWrongBal}) to correct record`);
    
    await pool.query('UPDATE economy SET balance = ? WHERE player_id = ?', [totalDeadopsBalance, 19850]);
    console.log(`  ✅ Transferred ${totalDeadopsBalance} to correct Dead-ops record`);
    
    // Step 5: Deactivate wrong records
    console.log(`\n🗑️ Step 4: Deactivating wrong records...`);
    
    await pool.query(
      'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Merged duplicate - wrong Discord ID" WHERE id IN (?, ?)',
      [20000, 20001]
    );
    console.log(`  ✅ Deactivated wrong Discord ID records: ID=20000, ID=20001`);
    
    await pool.query(
      'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Merged duplicate - no Discord ID" WHERE id = ?',
      [8867]
    );
    console.log(`  ✅ Deactivated no Discord ID record: ID=8867`);
    
    // Step 6: Delete wrong economy records
    console.log(`\n🗑️ Step 5: Deleting wrong economy records...`);
    
    await pool.query('DELETE FROM economy WHERE player_id IN (?, ?, ?)', [20000, 20001, 8867]);
    console.log(`  ✅ Deleted economy records for: ID=20000, ID=20001, ID=8867`);
    
    // Verify the fix
    console.log(`\n🔍 Verifying fix...`);
    const [finalRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, p.server_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE '%Artemis%'
      ORDER BY p.server_id, p.id
    `);
    
    console.log('📋 Final state:');
    for (const record of finalRecords) {
      console.log(`  ID=${record.id}, IGN="${record.ign}", Discord=${record.discord_id}, Server=${record.nickname}, Active=${record.is_active}, Balance=${record.balance || 0}`);
    }
    
    console.log('\n🎉 Artemis2689 duplicate fix completed!');
    console.log('The user should now see:');
    console.log(`  - Dead-ops: ${totalDeadopsBalance} Ops Tokens (on correct Discord ID)`);
    console.log(`  - USA-DeadOps: ${totalUsaBalance} coins (on correct Discord ID)`);
    
  } catch (error) {
    console.error('❌ Error fixing Artemis duplicates:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixArtemisDuplicates();
