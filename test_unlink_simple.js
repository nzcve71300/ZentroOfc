const pool = require('./src/db');
require('dotenv').config();

async function testUnlinkLogic() {
  try {
    console.log('🧪 Testing unlink command logic...');
    
    // Test with a Discord ID
    const testDiscordId = '1241672654193426434';
    console.log(`\n📋 Testing with Discord ID: ${testDiscordId}`);
    
    const [players] = await pool.query(
      `SELECT p.*, rs.nickname, g.name as guild_name
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       JOIN guilds g ON p.guild_id = g.id
       WHERE p.discord_id = ? 
       AND p.is_active = true`,
      [testDiscordId]
    );
    
    console.log(`Found ${players.length} active players with Discord ID ${testDiscordId}:`);
    players.forEach(player => {
      console.log(`  • ${player.ign} on ${player.nickname} (${player.guild_name})`);
    });
    
    // Test with an IGN
    const testIgn = 'jadyyy5234';
    console.log(`\n📋 Testing with IGN: ${testIgn}`);
    
    const [playersByIgn] = await pool.query(
      `SELECT p.*, rs.nickname, g.name as guild_name
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       JOIN guilds g ON p.guild_id = g.id
       WHERE LOWER(p.ign) = LOWER(?) 
       AND p.is_active = true`,
      [testIgn]
    );
    
    console.log(`Found ${playersByIgn.length} active players with IGN ${testIgn}:`);
    playersByIgn.forEach(player => {
      console.log(`  • ${player.ign} on ${player.nickname} (${player.guild_name})`);
    });
    
    // Test the playerInfo mapping
    console.log(`\n📋 Testing playerInfo mapping:`);
    const playerInfo = players.map(p => `${p.ign} (${p.nickname} - ${p.guild_name})`);
    console.log('Player info array:', playerInfo);
    
    if (playerInfo.length === 0) {
      console.log('⚠️ Player info array is empty!');
    } else {
      console.log('✅ Player info array has data');
    }
    
  } catch (error) {
    console.error('❌ Error in testUnlinkLogic:', error);
  }
}

testUnlinkLogic().then(() => {
  console.log('\n👋 Test complete');
  process.exit(0);
});
