const mysql = require('mysql2/promise');

async function fixDiscordIdDirect() {
  let connection;
  
  try {
    console.log('🔧 Direct Discord ID fix for lZips-');
    console.log('=====================================\n');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'zentro_bot',
      password: 'Zandewet@123',
      database: 'zentro_bot',
      port: 3306
    });
    
    console.log('✅ Connected to database\n');
    
    // Show current state
    console.log('1. 👤 CURRENT PLAYER ENTRIES:');
    const [currentPlayers] = await connection.execute(
      'SELECT * FROM players WHERE ign = ?',
      ['lZips-']
    );
    
    currentPlayers.forEach((player, index) => {
      console.log(`   ${index + 1}. ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Server: ${player.server_id}`);
    });
    
    // Fix Discord ID directly by player ID
    console.log('\n2. 🔧 UPDATING DISCORD ID DIRECTLY:');
    const correctDiscordId = '1411881661712306247';
    
    console.log(`Updating Discord ID to: ${correctDiscordId}`);
    
    // Update both player entries directly by their IDs
    const [updateResult1] = await connection.execute(
      'UPDATE players SET discord_id = ? WHERE id = ?',
      [correctDiscordId, 20112]
    );
    
    const [updateResult2] = await connection.execute(
      'UPDATE players SET discord_id = ? WHERE id = ?',
      [correctDiscordId, 20113]
    );
    
    console.log(`✅ Updated player ID 20112: ${updateResult1.affectedRows} rows`);
    console.log(`✅ Updated player ID 20113: ${updateResult2.affectedRows} rows`);
    
    // Verify the fix
    console.log('\n3. ✅ VERIFICATION:');
    const [finalPlayers] = await connection.execute(
      'SELECT * FROM players WHERE ign = ?',
      ['lZips-']
    );
    
    console.log('Final player entries:');
    finalPlayers.forEach((player, index) => {
      console.log(`   ${index + 1}. ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Server: ${player.server_id}`);
    });
    
    // Check economy
    console.log('\n4. 💰 ECONOMY STATUS:');
    const playerIds = finalPlayers.map(p => p.id);
    const placeholders = playerIds.map(() => '?').join(',');
    const [economyEntries] = await connection.execute(
      `SELECT e.*, p.ign FROM economy e JOIN players p ON e.player_id = p.id WHERE e.player_id IN (${placeholders})`,
      playerIds
    );
    
    console.log(`Economy entries (${economyEntries.length}):`);
    economyEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. Player: "${entry.ign}", Balance: ${entry.balance}, Player ID: ${entry.player_id}`);
    });
    
    console.log('\n🎉 DISCORD ID FIX COMPLETE!');
    console.log('   - Discord ID corrected to: 1411881661712306247');
    console.log('   - Player should now work correctly with /balance');
    console.log('   - Total balance across servers: 6000 (3000 + 3000)');
    
    console.log('\n💡 TESTING:');
    console.log('   1. Have the player try /balance command');
    console.log('   2. Should show 3000 balance per server');
    console.log('   3. If still issues, try /add-currency-player again');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixDiscordIdDirect();
