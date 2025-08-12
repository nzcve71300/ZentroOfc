const pool = require('./src/db');

async function copyPlayerLinks() {
  try {
    console.log('🔗 Copying player links from Emperor 3x to EMP2...');
    
    // Get the server IDs
    const [emperorServer] = await pool.query(
      'SELECT id FROM rust_servers WHERE nickname = ?',
      ['Emperor 3x']
    );
    
    const [emp2Server] = await pool.query(
      'SELECT id FROM rust_servers WHERE nickname = ?',
      ['|EMP2|']
    );
    
    if (emperorServer.length === 0) {
      console.log('❌ Emperor 3x server not found');
      return;
    }
    
    if (emp2Server.length === 0) {
      console.log('❌ EMP2 server not found');
      return;
    }
    
    const emperorServerId = emperorServer[0].id;
    const emp2ServerId = emp2Server[0].id;
    
    console.log(`📋 Source server: Emperor 3x (${emperorServerId})`);
    console.log(`📋 Target server: |EMP2| (${emp2ServerId})`);
    
    // Get all active player links from Emperor 3x
    const [emperorPlayers] = await pool.query(
      'SELECT * FROM players WHERE server_id = ? AND is_active = 1',
      [emperorServerId]
    );
    
    console.log(`\n📊 Found ${emperorPlayers.length} active player links on Emperor 3x`);
    
    if (emperorPlayers.length === 0) {
      console.log('ℹ️ No player links to copy');
      return;
    }
    
    // Check for existing links on EMP2
    const [existingEmp2Players] = await pool.query(
      'SELECT discord_id FROM players WHERE server_id = ? AND is_active = 1',
      [emp2ServerId]
    );
    
    const existingDiscordIds = new Set(existingEmp2Players.map(p => p.discord_id));
    console.log(`📊 Found ${existingEmp2Players.length} existing player links on EMP2`);
    
    // Filter out players that are already linked on EMP2
    const playersToCopy = emperorPlayers.filter(player => !existingDiscordIds.has(player.discord_id));
    
    console.log(`📊 Will copy ${playersToCopy.length} new player links to EMP2`);
    
    if (playersToCopy.length === 0) {
      console.log('ℹ️ All players are already linked on EMP2');
      return;
    }
    
    // Show what will be copied
    console.log('\n📋 Players to be linked on EMP2:');
    playersToCopy.forEach((player, index) => {
      console.log(`   ${index + 1}. ${player.ign} (Discord: ${player.discord_id})`);
    });
    
    console.log('\n⚠️ This will create new player links on EMP2 for all Emperor 3x players.');
    console.log('   Players will keep their existing links on Emperor 3x.');
    
    // Start transaction
    await pool.query('START TRANSACTION');
    
    try {
      let copiedCount = 0;
      let skippedCount = 0;
      
      for (const player of emperorPlayers) {
        // Check if player already exists on EMP2
        const [existingPlayer] = await pool.query(
          'SELECT id FROM players WHERE server_id = ? AND discord_id = ?',
          [emp2ServerId, player.discord_id]
        );
        
        if (existingPlayer.length > 0) {
          console.log(`⏭️ Skipping ${player.ign} - already linked on EMP2`);
          skippedCount++;
          continue;
        }
        
        // Create new player link on EMP2
        await pool.query(
          'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, NOW(), 1)',
          [player.guild_id, emp2ServerId, player.discord_id, player.ign]
        );
        
        console.log(`✅ Linked ${player.ign} to EMP2`);
        copiedCount++;
      }
      
      // Commit transaction
      await pool.query('COMMIT');
      
      console.log('\n🎉 Player link copying completed!');
      console.log(`   ✅ Copied: ${copiedCount} players`);
      console.log(`   ⏭️ Skipped: ${skippedCount} players (already linked)`);
      console.log(`   📊 Total processed: ${emperorPlayers.length} players`);
      
      // Verify the results
      const [finalEmp2Players] = await pool.query(
        'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = 1',
        [emp2ServerId]
      );
      
      console.log(`\n📊 Final player count on EMP2: ${finalEmp2Players[0].count} players`);
      
      console.log('\n🎯 Players can now use commands on both servers without relinking!');
      
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error copying player links:', error);
  } finally {
    await pool.end();
  }
}

copyPlayerLinks(); 