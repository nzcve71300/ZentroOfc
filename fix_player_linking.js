const pool = require('./src/db');

async function fixPlayerLinking() {
  try {
    console.log('🔧 Fixing player linking...');
    
    const guildId = '1391149977434329230';
    const ign = 'nzcve7130';
    const correctDiscordId = '1252993829007528086';
    
    console.log(`🔍 Updating IGN: ${ign}`);
    console.log(`🔍 To Discord ID: ${correctDiscordId}`);
    console.log(`🔍 In Guild ID: ${guildId}`);
    
    // First, check current status
    const [currentPlayer] = await pool.query(
      'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND ign = ?',
      [guildId, ign]
    );
    
    if (currentPlayer.length === 0) {
      console.log('❌ Player not found in database');
      return;
    }
    
    const player = currentPlayer[0];
    console.log(`📋 Current player record:`);
    console.log(`   ID: ${player.id}`);
    console.log(`   IGN: ${player.ign}`);
    console.log(`   Current Discord ID: ${player.discord_id}`);
    console.log(`   Active: ${player.is_active}`);
    
    // Update the Discord ID
    const [updateResult] = await pool.query(
      'UPDATE players SET discord_id = ? WHERE id = ?',
      [correctDiscordId, player.id]
    );
    
    if (updateResult.affectedRows > 0) {
      console.log('✅ Successfully updated Discord ID!');
      
      // Verify the update
      const [verifyPlayer] = await pool.query(
        'SELECT * FROM players WHERE id = ?',
        [player.id]
      );
      
      if (verifyPlayer.length > 0) {
        const updatedPlayer = verifyPlayer[0];
        console.log(`📋 Updated player record:`);
        console.log(`   ID: ${updatedPlayer.id}`);
        console.log(`   IGN: ${updatedPlayer.ign}`);
        console.log(`   New Discord ID: ${updatedPlayer.discord_id}`);
        console.log(`   Active: ${updatedPlayer.is_active}`);
      }
      
      // Check if economy record exists
      const [economyRecord] = await pool.query(
        'SELECT * FROM economy WHERE player_id = ?',
        [player.id]
      );
      
      if (economyRecord.length > 0) {
        console.log(`💰 Economy record found: Balance ${economyRecord[0].balance}`);
      } else {
        console.log('💰 Creating economy record...');
        await pool.query(
          'INSERT INTO economy (player_id, balance) VALUES (?, 0)',
          [player.id]
        );
        console.log('✅ Economy record created with 0 balance');
      }
      
      console.log('\n🎉 Player linking fixed!');
      console.log('💡 You should now be able to use player commands like /balance, /daily, etc.');
      
    } else {
      console.log('❌ Failed to update Discord ID');
    }
    
  } catch (error) {
    console.error('❌ Error fixing player linking:', error);
  } finally {
    await pool.end();
  }
}

fixPlayerLinking(); 