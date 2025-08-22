const pool = require('../db');

/**
 * Check if a Discord ID is blocked from linking
 * TEMPORARILY DISABLED - returns false
 */
async function isDiscordIdBlocked(guildId, discordId) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const [result] = await pool.query(
  //   'SELECT * FROM link_blocks WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND discord_id = ? AND is_active = true',
  //   [guildId, discordId]
  // );
  // return result.length > 0;
  return false;
}

/**
 * Check if an IGN is blocked from linking
 * TEMPORARILY DISABLED - returns false
 */
async function isIgnBlocked(guildId, ign) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const [result] = await pool.query(
  //   'SELECT * FROM link_blocks WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND ign = ? AND is_active = true',
  //   [guildId, ign]
  // );
  // return result.length > 0;
  return false;
}

/**
 * Get all active player links for a Discord ID
 */
async function getActivePlayerLinks(guildId, discordId) {
  const [result] = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND p.discord_id = ? 
     AND p.is_active = true`,
    [guildId, discordId]
  );
  return result;
}

/**
 * Get all active player links for an IGN (case-insensitive)
 */
async function getActivePlayerLinksByIgn(guildId, ign) {
  // ✅ NORMALIZE IGN: trim and lowercase
  const normalizedIgn = ign.trim().toLowerCase();
  
  const [result] = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND LOWER(p.ign) = LOWER(?) 
     AND p.is_active = true`,
    [guildId, normalizedIgn]
  );
  return result;
}

/**
 * Check if Discord ID is already linked to a different IGN
 */
async function isDiscordIdLinkedToDifferentIgn(guildId, discordId, ign) {
  // ✅ NORMALIZE IGN: trim and lowercase
  const normalizedIgn = ign.trim().toLowerCase();
  
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND discord_id = ? 
     AND ign IS NOT NULL
     AND LOWER(ign) != LOWER(?) 
     AND is_active = true`,
    [guildId, discordId, normalizedIgn]
  );
  return result.length > 0;
}

/**
 * Check if IGN is already linked to a different Discord ID
 */
async function isIgnLinkedToDifferentDiscordId(guildId, ign, discordId) {
  // ✅ NORMALIZE IGN: trim and lowercase
  const normalizedIgn = ign.trim().toLowerCase();
  
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND ign IS NOT NULL
     AND LOWER(ign) = LOWER(?) 
     AND discord_id != ? 
     AND is_active = true`,
    [guildId, normalizedIgn, discordId]
  );
  return result.length > 0;
}

/**
 * Create a link request
 */
async function createLinkRequest(guildId, discordId, ign, serverId) {
  // ✅ NORMALIZE IGN: trim and lowercase
  const normalizedIgn = ign.trim().toLowerCase();
  
  // Clean up any existing requests for this user/server
  await pool.query(
    `DELETE FROM link_requests 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND discord_id = ? 
     AND server_id = ?`,
    [guildId, discordId, serverId]
  );

  // Create new request
  const [result] = await pool.query(
    `INSERT INTO link_requests (guild_id, discord_id, ign, server_id) 
     VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?)`,
    [guildId, discordId, normalizedIgn, serverId]
  );
  
  // Get the inserted record
  const [inserted] = await pool.query(
    `SELECT * FROM link_requests WHERE id = ?`,
    [result.insertId]
  );
  return inserted[0];
}

/**
 * Confirm a link request - Fully robust implementation
 */
async function confirmLinkRequest(guildId, discordId, ign, serverId, serverName = 'Unknown Server', interaction = null) {
  // ✅ NORMALIZE IGN: trim and lowercase
  const normalizedIgn = ign.trim().toLowerCase();

  // Validate required parameters
  if (!guildId || !discordId || !normalizedIgn || !serverId) {
    console.error('❌ Missing required parameters:', { guildId, discordId, ign: normalizedIgn, serverId });
    throw new Error("❌ Linking failed: Missing required parameters. Please try again or contact an admin.");
  }

  // Handle guildId as TEXT (since guilds.discord_id is BIGINT in database)
  const guildIdText = String(guildId);
  const discordIdBigInt = BigInt(discordId);
  const serverIdText = String(serverId); // Keep serverId as string since it's VARCHAR(32)

  console.log('✅ Type-cast params:', { 
    guildIdText, 
    discordIdBigInt: discordIdBigInt.toString(), 
    serverIdText, 
    normalizedIgn 
  });

  try {
    // Ensure guild exists - guilds.discord_id is BIGINT, so cast as BIGINT
    const guildName = interaction?.guild?.name || 'Unknown Guild';
    const guildInsertQuery = `
      INSERT INTO guilds (discord_id, name)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `;
    console.log('🟧 Query:', guildInsertQuery, [guildIdText, guildName]);
    await pool.query(guildInsertQuery, [guildIdText, guildName]);
    console.log('✅ Guild ensured:', guildIdText);

    // Check if server already exists
    const serverCheckQuery = `
      SELECT id FROM rust_servers 
      WHERE id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
    `;
    const [existingServers] = await pool.query(serverCheckQuery, [serverIdText, guildIdText]);
    
    if (existingServers.length === 0) {
      // Server doesn't exist, skip insertion to avoid placeholder data
      console.log('⚠️ Server not found in database:', serverIdText);
      console.log('💡 Please add the server using admin commands first');
      throw new Error("❌ Server not found. Please contact an admin to add this server first.");
    }
    
    console.log('✅ Server found:', serverIdText);

    // Update link request status - guild_id subquery uses BIGINT for discord_id
    const linkRequestUpdateQuery = `
      UPDATE link_requests
      SET status = 'confirmed'
      WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        AND discord_id = ?
        AND server_id = ?
    `;
    try {
      console.log('🟧 Query:', linkRequestUpdateQuery, [guildIdText, discordIdBigInt, serverIdText]);
      await pool.query(linkRequestUpdateQuery, [guildIdText, discordIdBigInt, serverIdText]);
      console.log('✅ Link request status updated');
    } catch (e) {
      console.warn('⚠️ Could not update link request status:', e.message);
    }

    // ✅ Check for existing active player link by IGN (case-insensitive) - guild_id subquery uses BIGINT for discord_id
    const existingPlayerQuery = `
      SELECT * FROM players 
      WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        AND server_id = ?
        AND LOWER(ign) = LOWER(?)
        AND is_active = true
    `;
    const [existingPlayers] = await pool.query(existingPlayerQuery, [guildIdText, serverIdText, normalizedIgn]);
    
    if (existingPlayers.length > 0) {
      const existing = existingPlayers[0];
      console.log('✅ Found existing player record:', existing.id);
      return { id: existing.id };
    }

    // ✅ Insert new player or update existing discord_id (upsert) - guild_id subquery uses BIGINT for discord_id
    const playerInsertQuery = `
      INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
      VALUES (
        (SELECT id FROM guilds WHERE discord_id = ?),
        ?,
        ?,
        ?,
        CURRENT_TIMESTAMP,
        true
      )
      ON DUPLICATE KEY UPDATE
        discord_id = VALUES(discord_id),
        linked_at = CURRENT_TIMESTAMP,
        is_active = true,
        unlinked_at = NULL
    `;
    console.log('🟧 Query:', playerInsertQuery, [guildIdText, serverIdText, discordIdBigInt, normalizedIgn]);
    const [playerResult] = await pool.query(playerInsertQuery, [guildIdText, serverIdText, discordIdBigInt, normalizedIgn]);
    console.log('✅ Player linked:', normalizedIgn);

    // Ensure economy record exists
    const playerId = playerResult.insertId || playerResult.id;
    const economyInsertQuery = `
      INSERT INTO economy (player_id, guild_id, balance)
      VALUES (?, (SELECT guild_id FROM players WHERE id = ?), 0)
      ON DUPLICATE KEY UPDATE balance = balance
    `;
    console.log('🟧 Query:', economyInsertQuery, [playerId, playerId]);
    await pool.query(economyInsertQuery, [playerId, playerId]);
    console.log('✅ Economy record ensured for player:', playerId);

    return { id: playerId };
  } catch (error) {
    console.error('❌ Error in confirmLinkRequest:', error);
    throw error;
  }
}

/**
 * Unlink a player
 */
async function unlinkPlayer(guildId, discordId, serverId) {
  const [result] = await pool.query(
    `UPDATE players 
     SET is_active = false, unlinked_at = CURRENT_TIMESTAMP 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND discord_id = ? 
     AND server_id = ? 
     AND is_active = true`,
    [guildId, discordId, serverId]
  );
  
  if (result.affectedRows > 0) {
    const [player] = await pool.query(
      `SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND discord_id = ? AND server_id = ?`,
      [guildId, discordId, serverId]
    );
    return player[0];
  }
  return null;
}

/**
 * Unlink all players for a Discord ID across all servers
 */
async function unlinkAllPlayers(guildId, discordId) {
  const [result] = await pool.query(
    `UPDATE players 
     SET is_active = false, unlinked_at = CURRENT_TIMESTAMP 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND discord_id = ? 
     AND is_active = true`,
    [guildId, discordId]
  );
  return result.affectedRows;
}

/**
 * Unlink all players for an IGN across all servers (case-insensitive)
 */
async function unlinkAllPlayersByIgn(guildId, ign) {
  // ✅ NORMALIZE IGN: trim and lowercase
  const normalizedIgn = ign.trim().toLowerCase();
  
  const [result] = await pool.query(
    `UPDATE players 
     SET is_active = false, unlinked_at = CURRENT_TIMESTAMP 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND LOWER(ign) = LOWER(?) 
     AND is_active = true`,
    [guildId, normalizedIgn]
  );
  return result.affectedRows;
}

/**
 * Block a Discord ID from linking
 */
async function blockDiscordId(guildId, discordId, blockedBy, reason) {
  await pool.query(
    `INSERT INTO link_blocks (guild_id, discord_id, blocked_by, reason) 
     VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?)`,
    [guildId, discordId, blockedBy, reason]
  );
}

/**
 * Block an IGN from linking
 */
async function blockIgn(guildId, ign, blockedBy, reason) {
  // ✅ NORMALIZE IGN: trim and lowercase
  const normalizedIgn = ign.trim().toLowerCase();
  
  await pool.query(
    `INSERT INTO link_blocks (guild_id, ign, blocked_by, reason) 
     VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?)`,
    [guildId, normalizedIgn, blockedBy, reason]
  );
}

/**
 * Unblock a Discord ID
 */
async function unblockDiscordId(guildId, discordId) {
  const [result] = await pool.query(
    `UPDATE link_blocks 
     SET is_active = false 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND discord_id = ? 
     AND is_active = true`,
    [guildId, discordId]
  );
  return result.affectedRows;
}

/**
 * Unblock an IGN
 */
async function unblockIgn(guildId, ign) {
  // ✅ NORMALIZE IGN: trim and lowercase
  const normalizedIgn = ign.trim().toLowerCase();
  
  const [result] = await pool.query(
    `UPDATE link_blocks 
     SET is_active = false 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND LOWER(ign) = LOWER(?) 
     AND is_active = true`,
    [guildId, normalizedIgn]
  );
  return result.affectedRows;
}

/**
 * Get all servers for a guild
 */
async function getServersForGuild(guildId) {
  const [result] = await pool.query(
    'SELECT * FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
    [guildId]
  );
  return result;
}

module.exports = {
  isDiscordIdBlocked,
  isIgnBlocked,
  getActivePlayerLinks,
  getActivePlayerLinksByIgn,
  isDiscordIdLinkedToDifferentIgn,
  isIgnLinkedToDifferentDiscordId,
  createLinkRequest,
  confirmLinkRequest,
  unlinkPlayer,
  unlinkAllPlayers,
  unlinkAllPlayersByIgn,
  blockDiscordId,
  blockIgn,
  unblockDiscordId,
  unblockIgn,
  getServersForGuild
}; 