const pool = require('./src/db');
require('dotenv').config();

async function debugUnlinkCommand() {
  try {
    const guildId = '1403300500719538227'; // Mals Mayhem guild
    console.log(`🔍 Debugging unlink command for guild: ${guildId}`);
    
    // Test with a Discord ID
    const testDiscordId = '1241672654193426434'; // Jady's Discord ID
    console.log(`\n🧪 Testing unlink with Discord ID: ${testDiscordId}`);
    
    // Check if this Discord ID has active players
    const [playersByDiscordId] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND p.discord_id = ? 
       AND p.is_active = true`,
      [guildId, testDiscordId]
    );
    
    console.log(`📋 Found ${playersByDiscordId.length} active players with Discord ID ${testDiscordId}:`);
    playersByDiscordId.forEach(player => {
      console.log(`   • ${player.ign} on ${player.nickname} (Active: ${player.is_active})`);
    });
    
    // Test with an IGN
    const testIgn = 'jadyyy5234';
    console.log(`\n🧪 Testing unlink with IGN: ${testIgn}`);
    
    const [playersByIgn] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(p.ign) = LOWER(?) 
       AND p.is_active = true`,
      [guildId, testIgn]
    );
    
    console.log(`📋 Found ${playersByIgn.length} active players with IGN ${testIgn}:`);
    playersByIgn.forEach(player => {
      console.log(`   • ${player.ign} on ${player.nickname} (Active: ${player.is_active})`);
    });
    
    // Show all active players in this guild
    console.log(`\n📋 All active players in guild ${guildId}:`);
    const [allActivePlayers] = await pool.query(
      `SELECT p.discord_id, p.ign, p.is_active, rs.nickname
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND p.is_active = true
       ORDER BY p.ign`,
      [guildId]
    );
    
    if (allActivePlayers.length === 0) {
      console.log('   No active players found');
    } else {
      allActivePlayers.forEach(player => {
        console.log(`   • ${player.ign} (Discord ID: ${player.discord_id}) on ${player.nickname}`);
      });
    }
    
    // Test the exact query that the unlink command uses
    console.log(`\n🧪 Testing exact unlink query logic:`);
    
    // Test with a sample input (you can change this)
    const testInput = 'jadyyy5234';
    const isDiscordId = /^\d+$/.test(testInput);
    
    console.log(`   Input: "${testInput}"`);
    console.log(`   Is Discord ID: ${isDiscordId}`);
    
    if (isDiscordId) {
      const [testResult] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND p.discord_id = ? 
         AND p.is_active = true`,
        [guildId, testInput]
      );
      console.log(`   Found ${testResult.length} results for Discord ID query`);
    } else {
      const [testResult] = await pool.query(
        `SELECT p.*, rs.nickname 
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND LOWER(p.ign) = LOWER(?) 
         AND p.is_active = true`,
        [guildId, testInput]
      );
      console.log(`   Found ${testResult.length} results for IGN query`);
    }
    
  } catch (error) {
    console.error('❌ Error in debugUnlinkCommand:', error);
  }
}

debugUnlinkCommand().then(() => {
  console.log('\n👋 Debug complete');
  process.exit(0);
});
