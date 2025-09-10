const mysql = require('mysql2/promise');

async function fixPlayerLzips() {
  let connection;
  
  try {
    console.log('🔧 Fixing player lZips- issues');
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
    
    // 1. Check economy table structure first
    console.log('1. 📊 ECONOMY TABLE STRUCTURE:');
    const [economyColumns] = await connection.execute('DESCRIBE economy');
    console.log('Economy table columns:');
    economyColumns.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type})`);
    });
    
    // 2. Check economy entries with correct column name
    console.log('\n2. 💰 ECONOMY ENTRIES:');
    const [economyEntries] = await connection.execute(
      'SELECT * FROM economy WHERE ign LIKE ? OR ign LIKE ?',
      ['%lZips%', '%lzips%']
    );
    
    if (economyEntries.length === 0) {
      console.log('❌ No economy entries found for lZips-');
    } else {
      console.log(`✅ Found ${economyEntries.length} economy entries:`);
      economyEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. IGN: "${entry.ign}", Balance: ${entry.balance}, Server: ${entry.server_id}, Guild: ${entry.guild_id}`);
      });
    }
    
    // 3. Show current player entries
    console.log('\n3. 👤 CURRENT PLAYER ENTRIES:');
    const [allPlayers] = await connection.execute(
      'SELECT * FROM players WHERE ign = ?',
      ['lZips-']
    );
    
    console.log(`Found ${allPlayers.length} player entries:`);
    allPlayers.forEach((player, index) => {
      console.log(`   ${index + 1}. ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Server: ${player.server_id}`);
    });
    
    // 4. Fix the Discord ID
    console.log('\n4. 🔧 FIXING DISCORD ID:');
    const correctDiscordId = '1411881661712306247';
    const incorrectDiscordId = '1411881661712306200';
    
    console.log(`Updating Discord ID from ${incorrectDiscordId} to ${correctDiscordId}`);
    
    // Update all entries with the wrong Discord ID
    const [updateResult] = await connection.execute(
      'UPDATE players SET discord_id = ? WHERE discord_id = ? AND ign = ?',
      [correctDiscordId, incorrectDiscordId, 'lZips-']
    );
    
    console.log(`✅ Updated ${updateResult.affectedRows} player entries`);
    
    // 5. Remove duplicate entries (keep only one per server)
    console.log('\n5. 🧹 REMOVING DUPLICATES:');
    
    // Get all entries grouped by server
    const [groupedPlayers] = await connection.execute(
      'SELECT server_id, COUNT(*) as count FROM players WHERE ign = ? GROUP BY server_id',
      ['lZips-']
    );
    
    for (const group of groupedPlayers) {
      if (group.count > 1) {
        console.log(`Server ${group.server_id} has ${group.count} entries - removing duplicates`);
        
        // Keep the most recent entry, delete others
        const [duplicates] = await connection.execute(
          'SELECT id FROM players WHERE ign = ? AND server_id = ? ORDER BY id DESC',
          ['lZips-', group.server_id]
        );
        
        // Delete all but the first (most recent) entry
        for (let i = 1; i < duplicates.length; i++) {
          await connection.execute(
            'DELETE FROM players WHERE id = ?',
            [duplicates[i].id]
          );
          console.log(`   Deleted duplicate entry ID: ${duplicates[i].id}`);
        }
      }
    }
    
    // 6. Verify the fix
    console.log('\n6. ✅ VERIFICATION:');
    const [finalPlayers] = await connection.execute(
      'SELECT * FROM players WHERE ign = ?',
      ['lZips-']
    );
    
    console.log(`Final player entries (${finalPlayers.length}):`);
    finalPlayers.forEach((player, index) => {
      console.log(`   ${index + 1}. ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Server: ${player.server_id}`);
    });
    
    // 7. Check economy entries again
    console.log('\n7. 💰 FINAL ECONOMY CHECK:');
    const [finalEconomy] = await connection.execute(
      'SELECT * FROM economy WHERE ign = ?',
      ['lZips-']
    );
    
    if (finalEconomy.length === 0) {
      console.log('❌ No economy entries found - this might be why /balance shows 0');
      console.log('💡 You may need to add currency again after the fix');
    } else {
      console.log(`✅ Found ${finalEconomy.length} economy entries:`);
      finalEconomy.forEach((entry, index) => {
        console.log(`   ${index + 1}. IGN: "${entry.ign}", Balance: ${entry.balance}, Server: ${entry.server_id}`);
      });
    }
    
    console.log('\n🎉 FIX COMPLETE!');
    console.log('   - Discord ID corrected');
    console.log('   - Duplicate entries removed');
    console.log('   - Player should now work correctly');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixPlayerLzips();
