const pool = require('./src/db');

async function checkGuildPlayers() {
  try {
    console.log('🔍 Checking all players in your guild...');
    
    const guildId = '1391149977434329230'; // Your guild ID
    
    console.log(`🔍 Guild ID: ${guildId}`);
    
    // Get all players in this guild
    const [allPlayers] = await pool.query(
      'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY ign',
      [guildId]
    );
    
    console.log(`📊 Total players in guild: ${allPlayers.length}`);
    
    // Show linked players
    const linkedPlayers = allPlayers.filter(p => p.discord_id);
    console.log(`\n✅ Linked players (${linkedPlayers.length}):`);
    linkedPlayers.forEach(player => {
      console.log(`   IGN: ${player.ign}, Discord ID: ${player.discord_id}, Active: ${player.is_active}`);
    });
    
    // Show unlinked players
    const unlinkedPlayers = allPlayers.filter(p => !p.discord_id);
    console.log(`\n❌ Unlinked players (${unlinkedPlayers.length}):`);
    unlinkedPlayers.forEach(player => {
      console.log(`   IGN: ${player.ign}, Server ID: ${player.server_id}, Active: ${player.is_active}`);
    });
    
    // Show economy records
    const [economyRecords] = await pool.query(
      `SELECT e.*, p.ign, p.discord_id 
       FROM economy e 
       JOIN players p ON e.player_id = p.id 
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       ORDER BY p.ign`,
      [guildId]
    );
    
    console.log(`\n💰 Economy records (${economyRecords.length}):`);
    economyRecords.forEach(econ => {
      const discordStatus = econ.discord_id ? 'Linked' : 'Unlinked';
      console.log(`   IGN: ${econ.ign}, Balance: ${econ.balance}, Status: ${discordStatus}`);
    });
    
    // Show link requests
    const [linkRequests] = await pool.query(
      'SELECT * FROM link_requests WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY created_at DESC',
      [guildId]
    );
    
    console.log(`\n📋 Link requests (${linkRequests.length}):`);
    linkRequests.forEach(req => {
      console.log(`   IGN: ${req.ign}, Discord ID: ${req.discord_id}, Status: ${req.status}, Created: ${req.created_at}`);
    });
    
    console.log('\n💡 To fix your linking:');
    console.log('1. Find your IGN in the list above');
    console.log('2. Use the /link command with your IGN');
    console.log('3. Or use an admin command to manually link you');
    
  } catch (error) {
    console.error('❌ Error checking guild players:', error);
  } finally {
    await pool.end();
  }
}

checkGuildPlayers(); 