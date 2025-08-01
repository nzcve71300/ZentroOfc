const pool = require('./src/db');

async function checkPlayerLinking() {
  try {
    console.log('🔍 Checking Player Linking Status...');

    // Check all players for nzcve7130
    const [players] = await pool.query(
      'SELECT * FROM players WHERE ign = ? OR discord_id = ?',
      ['nzcve7130', '5065661'] // Your Discord ID
    );

    console.log(`Found ${players.length} player records:`);
    players.forEach((player, index) => {
      console.log(`\n${index + 1}. Player Record:`);
      console.log(`   ID: ${player.id}`);
      console.log(`   Guild ID: ${player.guild_id}`);
      console.log(`   Server ID: ${player.server_id}`);
      console.log(`   Discord ID: ${player.discord_id}`);
      console.log(`   IGN: ${player.ign}`);
      console.log(`   Is Active: ${player.is_active}`);
      console.log(`   Linked At: ${player.linked_at}`);
    });

    // Check specific server
    const [serverPlayers] = await pool.query(
      `SELECT p.*, rs.nickname as server_name 
       FROM players p 
       JOIN rust_servers rs ON p.server_id = rs.id 
       WHERE p.ign = ? AND rs.nickname = ?`,
      ['nzcve7130', 'Rise 3x']
    );

    console.log(`\n📡 Players on Rise 3x:`);
    serverPlayers.forEach((player, index) => {
      console.log(`\n${index + 1}. Player:`);
      console.log(`   ID: ${player.id}`);
      console.log(`   Discord ID: ${player.discord_id}`);
      console.log(`   IGN: ${player.ign}`);
      console.log(`   Is Active: ${player.is_active}`);
      console.log(`   Server: ${player.server_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkPlayerLinking(); 