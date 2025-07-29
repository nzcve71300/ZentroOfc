const pool = require('../db');

/**
 * Check if a Discord ID is blocked from linking
 * TEMPORARILY DISABLED - returns FALSE
 */
async function isDiscordIdBlocked(guildId, discordId) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const [result] = await pool.query(
  //   'SELECT * FROM link_blocks WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND discord_id = ? AND is_active = TRUE',
  //   [guildId, discordId]
  // );
  // return result.length > 0;
  return FALSE;
}

/**
 * Check if an IGN is blocked from linking
 * TEMPORARILY DISABLED - returns FALSE
 */
async function isIgnBlocked(guildId, ign) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const [result] = await pool.query(
  //   'SELECT * FROM link_blocks WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND LOWER(ign) = LOWER(?) AND is_active = TRUE',
  //   [guildId, ign]
  // );
  // return result.length > 0;
  return FALSE;
}

/**
 * Get active player links for a Discord ID
 */
async function getActivePlayerLinks(guildId, discordId) {
  const [result] = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND p.discord_id = ? 
     AND p.is_active = TRUE`,
    [guildId, discordId]
  );
  return result;
}

/**
 * Get active player links for an IGN
 */
async function getActivePlayerLinksByIgn(guildId, ign) {
  const [result] = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND LOWER(p.ign) = LOWER(?) 
     AND p.is_active = TRUE`,
    [guildId, ign]
  );
  return result;
}

/**
 * Check if Discord ID is already linked to a different IGN
 */
async function isDiscordIdLinkedToDifferentIgn(guildId, discordId, ign) {
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND discord_id = ? 
     AND ign IS NOT NULL
     AND LOWER(ign) != LOWER(?) 
     AND is_active = TRUE`,
    [guildId, discordId, ign]
  );
  return result.length > 0;
}

/**
 * Check if IGN is already linked to a different Discord ID
 */
async function isIgnLinkedToDifferentDiscordId(guildId, ign, discordId) {
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND ign IS NOT NULL
     AND LOWER(ign) = LOWER(?) 
     AND discord_id != ? 
     AND is_active = TRUE`,
    [guildId, ign, discordId]
  );
  return result.length > 0;
}

/**
 * Create a link request
 */
async function createLinkRequest(guildId, discordId, ign, serverId) {
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
    [guildId, discordId, ign, serverId]
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
  console.log('🔗 confirmLinkRequest called with params:', { guildId, discordId, ign, serverId });

  if (!guildId || !discordId || !ign || !serverId) {
    console.error('❌ Missing required parameters:', { guildId, discordId, ign, serverId });
    throw new Error("❌ Linking failed: Missing required parameters. Please try again or contact an admin.");
  }

  // Handle guildId as TEXT (since guilds.discord_id is BIGINT in database)
  const guildIdText = String(guildId);
  const discordIdBigInt = BigInt(discordId);
  const serverIdBigInt = BigInt(serverId);
  const ignText = String(ign);

  console.log('✅ Type-cast params:', { 
    guildIdText, 
    discordIdBigInt: discordIdBigInt.toString(), 
    serverIdBigInt: serverIdBigInt.toString(), 
    ignText 
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

    // Ensure server exists - guild_id subquery now uses BIGINT for discord_id
    const serverInsertQuery = `
      INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password)
      VALUES (?, (SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nickname = VALUES(nickname),
        ip = VALUES(ip),
        port = VALUES(port),
        password = VALUES(password);
    `;
    console.log('🟧 Query:', serverInsertQuery, [serverIdBigInt, guildIdText, serverName, '0.0.0.0', 0, '']);
    await pool.query(serverInsertQuery, [serverIdBigInt, guildIdText, serverName, '0.0.0.0', 0, '']);
    console.log('✅ Server ensured:', serverIdBigInt.toString());

    // Update link request status - guild_id subquery uses BIGINT for discord_id
    const linkRequestUpdateQuery = `
      UPDATE link_requests
      SET status = 'confirmed'
      WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        AND discord_id = ?
        AND server_id = ?
    `;
    try {
      console.log('🟧 Query:', linkRequestUpdateQuery, [guildIdText, discordIdBigInt, serverIdBigInt]);
      await pool.query(linkRequestUpdateQuery, [guildIdText, discordIdBigInt, serverIdBigInt]);
      console.log('✅ Link request status updated');
    } catch (e) {
      console.warn('⚠️ Could not update link request status:', e.message);
    }

    // Check for existing active player link by ign - guild_id subquery uses BIGINT for discord_id
    const playerSelectQuery = `
      SELECT id, is_active FROM players
      WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        AND server_id = ?
        AND LOWER(ign) = LOWER(?)
    `;
    console.log('🟧 Query:', playerSelectQuery, [guildIdText, serverIdBigInt, ignText]);
    const [existingPlayers] = await pool.query(playerSelectQuery, [guildIdText, serverIdBigInt, ignText]);

    if (existingPlayers.length > 0) {
      const existing = existingPlayers[0];
      if (existing.is_active) {
        throw new Error("❌ This IGN is already linked and active. Contact an admin to unlink.");
      }
      // Reactivate inactive player
      const playerUpdateQuery = `
        UPDATE players
        SET discord_id = ?, linked_at = CURRENT_TIMESTAMP, is_active = TRUE, unlinked_at = NULL
        WHERE id = ?
      `;
      console.log('🟧 Query:', playerUpdateQuery, [discordIdBigInt, existing.id]);
      await pool.query(playerUpdateQuery, [discordIdBigInt, existing.id]);
      // Ensure economy record
      const economyInsertQuery = `
        INSERT INTO economy (player_id, balance)
        VALUES (?, 0)
        ON DUPLICATE KEY UPDATE balance = balance
      `;
      console.log('🟧 Query:', economyInsertQuery, [existing.id]);
      await pool.query(economyInsertQuery, [existing.id]);
      console.log('✅ Reactivated existing inactive player:', ignText);
      return { id: existing.id };
    }

    // Insert new player or update existing discord_id (upsert) - guild_id subquery uses BIGINT for discord_id
    const playerInsertQuery = `
      INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
      VALUES (
        (SELECT id FROM guilds WHERE discord_id = ?),
        ?,
        ?,
        ?,
        CURRENT_TIMESTAMP,
        TRUE
      )
      ON DUPLICATE KEY UPDATE
        discord_id = VALUES(discord_id),
        linked_at = CURRENT_TIMESTAMP,
        is_active = TRUE,
        unlinked_at = NULL
    `;
    console.log('🟧 Query:', playerInsertQuery, [guildIdText, serverIdBigInt, discordIdBigInt, ignText]);
    const [result] = await pool.query(playerInsertQuery, [guildIdText, serverIdBigInt, discordIdBigInt, ignText]);

    const playerId = result.insertId || existingPlayers[0]?.id;

    // Ensure economy record
    const economyInsertQuery = `
      INSERT INTO economy (player_id, balance)
      VALUES (?, 0)
      ON DUPLICATE KEY UPDATE balance = balance
    `;
    console.log('🟧 Query:', economyInsertQuery, [playerId]);
    await pool.query(economyInsertQuery, [playerId]);

    // Get the player record
    const [playerResult] = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    const player = playerResult[0];

    console.log('✅ Successfully linked player:', player);
    return player;
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
     SET is_active = FALSE, unlinked_at = CURRENT_TIMESTAMP 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND discord_id = ? 
     AND server_id = ? 
     AND is_active = TRUE`,
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
     SET is_active = FALSE, unlinked_at = CURRENT_TIMESTAMP 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND discord_id = ? 
     AND is_active = TRUE`,
    [guildId, discordId]
  );
  
  if (result.affectedRows > 0) {
    const [players] = await pool.query(
      `SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND discord_id = ?`,
      [guildId, discordId]
    );
    return players;
  }
  return [];
}

/**
 * Unlink all players for an IGN across all servers
 */
async function unlinkAllPlayersByIgn(guildId, ign) {
  const [result] = await pool.query(
    `UPDATE players 
     SET is_active = FALSE, unlinked_at = CURRENT_TIMESTAMP 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND LOWER(ign) = LOWER(?) 
     AND is_active = TRUE`,
    [guildId, ign]
  );
  
  if (result.affectedRows > 0) {
    const [players] = await pool.query(
      `SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(ign) = LOWER(?)`,
      [guildId, ign]
    );
    return players;
  }
  return [];
}

/**
 * Block a Discord ID from linking
 * TEMPORARILY DISABLED - returns null
 */
async function blockDiscordId(guildId, discordId, blockedBy, reason = null) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const [result] = await pool.query(
  //   `INSERT INTO link_blocks (guild_id, discord_id, blocked_by, reason) 
  //    VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?) 
  //    ON DUPLICATE KEY UPDATE 
  //      blocked_at = CURRENT_TIMESTAMP,
  //      blocked_by = VALUES(blocked_by),
  //      reason = VALUES(reason),
  //      is_active = TRUE`,
  //   [guildId, discordId, blockedBy, reason]
  // );
  // return result[0];
  return null;
}

/**
 * Block an IGN from linking
 * TEMPORARILY DISABLED - returns null
 */
async function blockIgn(guildId, ign, blockedBy, reason = null) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const [result] = await pool.query(
  //   `INSERT INTO link_blocks (guild_id, ign, blocked_by, reason) 
  //   VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?) 
  //   ON DUPLICATE KEY UPDATE 
  //     blocked_at = CURRENT_TIMESTAMP,
  //     blocked_by = VALUES(blocked_by),
  //     reason = VALUES(reason),
  //     is_active = TRUE`,
  //   [guildId, ign, blockedBy, reason]
  // );
  // return result[0];
  return null;
}

/**
 * Unblock a Discord ID
 * TEMPORARILY DISABLED - returns null
 */
async function unblockDiscordId(guildId, discordId) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const [result] = await pool.query(
  //   `UPDATE link_blocks 
  //    SET is_active = FALSE 
  //    WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
  //    AND discord_id = ? 
  //    AND is_active = TRUE`,
  //   [guildId, discordId]
  // );
  // return result[0];
  return null;
}

/**
 * Unblock an IGN
 * TEMPORARILY DISABLED - returns null
 */
async function unblockIgn(guildId, ign) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const [result] = await pool.query(
  //   `UPDATE link_blocks 
  //    SET is_active = FALSE 
  //    WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
  //    AND LOWER(ign) = LOWER(?) 
  //    AND is_active = TRUE`,
  //   [guildId, ign]
  // );
  // return result[0];
  return null;
}

/**
 * Get all servers for a guild
 */
async function getServersForGuild(guildId) {
  const [result] = await pool.query(
    'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
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