const pool = require('./src/db');

async function fixPlayerLinking() {
  try {
    console.log('🔧 Fixing Player Linking...');

    // Update the player record to include Discord ID
    const [result] = await pool.query(
      'UPDATE players SET discord_id = ? WHERE ign = ? AND server_id = ?',
      ['5065661', 'nzcve7130', '1753965211295_c5pfupu9']
    );

    console.log(`Updated ${result.affectedRows} player record(s)`);

    // Verify the fix
    const [players] = await pool.query(
      'SELECT * FROM players WHERE ign = ? AND discord_id = ?',
      ['nzcve7130', '5065661']
    );

    console.log(`\n✅ Verification - Found ${players.length} linked player(s):`);
    players.forEach((player, index) => {
      console.log(`\n${index + 1}. Player:`);
      console.log(`   ID: ${player.id}`);
      console.log(`   Discord ID: ${player.discord_id}`);
      console.log(`   IGN: ${player.ign}`);
      console.log(`   Is Active: ${player.is_active}`);
      console.log(`   Server ID: ${player.server_id}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixPlayerLinking(); 