const pool = require('../db');

/**
 * Normalize IGN to prevent case/spaces/unicode issues
 * This ensures consistent comparison and storage
 */
function normalizeIGN(raw) {
  if (!raw || typeof raw !== 'string') return '';
  
  return raw
    .normalize('NFC')         // unify unicode forms (NFC is more standard than NFKC)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')   // strip zero-width chars (more comprehensive)
    .trim()
    .replace(/\s+/g, ' ')     // collapse multiple spaces to single space
    .toLowerCase();            // normalize case
}

/**
 * Automatically creates player records on ALL servers in a guild when linking
 * This ensures players can be found on any server after linking
 * 
 * @param {number} guildId - Database guild ID (NOT Discord guild ID)
 * @param {string} discordId - Discord user ID
 * @param {string} ign - Raw in-game name (will be normalized)
 * @param {string} sourceServerId - Optional source server ID
 */
async function ensurePlayerOnAllServers(guildId, discordId, ign, sourceServerId = null) {
  try {
    // ✅ CRITICAL: Normalize IGN before processing
    const normalizedIgn = normalizeIGN(ign);
    
    if (!normalizedIgn) {
      console.error('❌ AUTO-SERVER-LINKING: Invalid IGN provided');
      return { success: false, error: 'Invalid IGN provided' };
    }
    
    console.log(`🔗 AUTO-SERVER-LINKING: Ensuring "${ign}" (normalized: "${normalizedIgn}") exists on all servers in guild ${guildId}`);
    
    // ✅ CRITICAL: Scope query by guild_id to prevent cross-tenant issues
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
        // ✅ CRITICAL: Scope check by guild_id AND server_id to prevent cross-tenant issues
        const [existingPlayer] = await pool.query(
          'SELECT id FROM players WHERE guild_id = ? AND server_id = ? AND LOWER(ign) = ?',
          [guildId, server.id, normalizedIgn]
        );
        
        if (existingPlayer.length > 0) {
          console.log(`  ✅ "${ign}" already exists on ${server.nickname}`);
          existingCount++;
          results.push({ server: server.nickname, status: 'exists', playerId: existingPlayer[0].id });
          continue;
        }
        
        // ✅ CRITICAL: Use normalized IGN for storage, but preserve original for display
        const [playerResult] = await pool.query(
          'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, true)',
          [guildId, server.id, discordId, ign] // Store original IGN for display, but query by normalized
        );
        
        console.log(`  ✅ Created "${ign}" on ${server.nickname} (ID: ${playerResult.insertId})`);
        createdCount++;
        results.push({ server: server.nickname, status: 'created', playerId: playerResult.insertId });
        
        // Create economy record for this player
        try {
          await pool.query(
            'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE balance = balance',
            [playerResult.insertId, guildId]
          );
          console.log(`  💰 Created economy record for "${ign}" on ${server.nickname}`);
        } catch (economyError) {
          console.log(`  ⚠️ Economy record creation failed for "${ign}" on ${server.nickname}: ${economyError.message}`);
        }
        
      } catch (error) {
        // ✅ CRITICAL: Handle race condition errors gracefully
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`  ⚠️ Race condition detected for "${ign}" on ${server.nickname} - player was created by another process`);
          existingCount++;
          results.push({ server: server.nickname, status: 'race_condition', error: 'Player created by another process' });
        } else {
          console.error(`  ❌ Failed to process ${server.nickname} for "${ign}":`, error);
          results.push({ server: server.nickname, status: 'error', error: error.message });
        }
      }
    }
    
    console.log(`🔗 AUTO-SERVER-LINKING: Complete - ${createdCount} created, ${existingCount} existing`);
    
    return {
      success: true,
      createdCount,
      existingCount,
      totalServers: servers.length,
      results,
      normalizedIgn
    };
    
  } catch (error) {
    console.error('❌ AUTO-SERVER-LINKING: Error ensuring player on all servers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all servers where a player exists (scoped by guild)
 * @param {number} guildId - Database guild ID
 * @param {string} ign - Raw in-game name (will be normalized)
 */
async function getPlayerServers(guildId, ign) {
  try {
    const normalizedIgn = normalizeIGN(ign);
    
    if (!normalizedIgn) {
      console.error('❌ Error: Invalid IGN provided to getPlayerServers');
      return [];
    }
    
    // ✅ CRITICAL: Scope query by guild_id to prevent cross-tenant issues
    const [servers] = await pool.query(
      `SELECT rs.nickname, rs.id, p.id as player_id, p.discord_id, p.linked_at
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = ? AND LOWER(p.ign) = ?
       ORDER BY rs.nickname`,
      [guildId, normalizedIgn]
    );
    
    return servers;
  } catch (error) {
    console.error('❌ Error getting player servers:', error);
    return [];
  }
}

/**
 * Check if a player exists on a specific server (scoped by guild)
 * @param {number} guildId - Database guild ID
 * @param {string} serverId - Server ID
 * @param {string} ign - Raw in-game name (will be normalized)
 */
async function playerExistsOnServer(guildId, serverId, ign) {
  try {
    const normalizedIgn = normalizeIGN(ign);
    
    if (!normalizedIgn) {
      console.error('❌ Error: Invalid IGN provided to playerExistsOnServer');
      return false;
    }
    
    // ✅ CRITICAL: Scope query by guild_id AND server_id to prevent cross-tenant issues
    const [player] = await pool.query(
      'SELECT id FROM players WHERE guild_id = ? AND server_id = ? AND LOWER(ign) = ?',
      [guildId, serverId, normalizedIgn]
    );
    
    return player.length > 0;
  } catch (error) {
    console.error('❌ Error checking if player exists on server:', error);
    return false;
  }
}

/**
 * Check if IGN is available for linking (not already linked to someone else)
 * @param {number} guildId - Database guild ID
 * @param {string} ign - Raw in-game name (will be normalized)
 * @param {string} excludeDiscordId - Discord ID to exclude from check (current user)
 */
async function isIgnAvailable(guildId, ign, excludeDiscordId = null) {
  try {
    const normalizedIgn = normalizeIGN(ign);
    
    if (!normalizedIgn) {
      return { available: false, error: 'Invalid IGN provided' };
    }
    
    // ✅ CRITICAL: Use exact match on normalized_ign column, scope by guild_id only
    // Note: With per-server constraints, we check across all servers in the guild
    let query = `
      SELECT p.discord_id, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = ? AND p.normalized_ign = ? AND p.is_active = true
    `;
    
    let params = [guildId, normalizedIgn];
    
    if (excludeDiscordId) {
      query += ' AND p.discord_id != ?';
      params.push(excludeDiscordId);
    }
    
    const [existingPlayers] = await pool.query(query, params);
    
    if (existingPlayers.length === 0) {
      return { available: true, existingLinks: [] };
    }
    
    return { 
      available: false, 
      existingLinks: existingPlayers,
      message: `IGN "${ign}" is already linked to ${existingPlayers.length} other account(s)`
    };
    
  } catch (error) {
    console.error('❌ Error checking IGN availability:', error);
    return { available: false, error: error.message };
  }
}

module.exports = {
  ensurePlayerOnAllServers,
  getPlayerServers,
  playerExistsOnServer,
  isIgnAvailable,
  normalizeIGN
};
