const pool = require('../db');

/**
 * Automatically creates player records on ALL servers in a guild when linking
 * This ensures players can be found on any server after linking
 */
async function ensurePlayerOnAllServers(guildId, discordId, ign, sourceServerId = null) {
  try {
    console.log(`🔗 AUTO-SERVER-LINKING: Ensuring ${ign} exists on all servers in guild ${guildId}`);
    
    // Get all servers for this guild
    const [servers] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = ? ORDER BY nickname',
      [guildId]
    );
    
    if (servers.length === 0) {
      console.log(`⚠️ AUTO-SERVER-LINKING: No servers found for guild ${guildId}`);
      return { success: false, message: 'No servers found for this guild' };
    }
    
    console.log(`🔗 AUTO-SERVER-LINKING: Found ${servers.length} servers to process`);
    
    let createdCount = 0;
    let existingCount = 0;
    const results = [];
    
    for (const server of servers) {
      try {
        // Check if player already exists on this server
        const [existingPlayer] = await pool.query(
          'SELECT id FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
          [guildId, server.id, ign]
        );
        
        if (existingPlayer.length > 0) {
          console.log(`  ✅ ${ign} already exists on ${server.nickname}`);
          existingCount++;
          results.push({ server: server.nickname, status: 'exists', playerId: existingPlayer[0].id });
          continue;
        }
        
        // Create player record on this server
        const [playerResult] = await pool.query(
          'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, true)',
          [guildId, server.id, discordId, ign]
        );
        
        console.log(`  ✅ Created ${ign} on ${server.nickname} (ID: ${playerResult.insertId})`);
        createdCount++;
        results.push({ server: server.nickname, status: 'created', playerId: playerResult.insertId });
        
        // Create economy record for this player
        try {
          await pool.query(
            'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE balance = balance',
            [playerResult.insertId, guildId]
          );
          console.log(`  💰 Created economy record for ${ign} on ${server.nickname}`);
        } catch (economyError) {
          console.log(`  ⚠️ Economy record creation failed for ${ign} on ${server.nickname}: ${economyError.message}`);
        }
        
      } catch (error) {
        console.error(`  ❌ Failed to process ${server.nickname} for ${ign}:`, error);
        results.push({ server: server.nickname, status: 'error', error: error.message });
      }
    }
    
    console.log(`🔗 AUTO-SERVER-LINKING: Complete - ${createdCount} created, ${existingCount} existing`);
    
    return {
      success: true,
      createdCount,
      existingCount,
      totalServers: servers.length,
      results
    };
    
  } catch (error) {
    console.error('❌ AUTO-SERVER-LINKING: Error ensuring player on all servers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all servers where a player exists
 */
async function getPlayerServers(guildId, ign) {
  try {
    const [servers] = await pool.query(
      `SELECT rs.nickname, rs.id, p.id as player_id, p.discord_id, p.linked_at
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = ? AND p.ign = ?
       ORDER BY rs.nickname`,
      [guildId, ign]
    );
    
    return servers;
  } catch (error) {
    console.error('❌ Error getting player servers:', error);
    return [];
  }
}

/**
 * Check if a player exists on a specific server
 */
async function playerExistsOnServer(guildId, serverId, ign) {
  try {
    const [player] = await pool.query(
      'SELECT id FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
      [guildId, serverId, ign]
    );
    
    return player.length > 0;
  } catch (error) {
    console.error('❌ Error checking if player exists on server:', error);
    return false;
  }
}

module.exports = {
  ensurePlayerOnAllServers,
  getPlayerServers,
  playerExistsOnServer
};
