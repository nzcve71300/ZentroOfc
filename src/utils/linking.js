const pool = require('../db');

/**
 * Check if a Discord ID is blocked from linking
 * TEMPORARILY DISABLED - returns false
 */
async function isDiscordIdBlocked(guildId, discordId) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const result = await pool.query(
  //   'SELECT * FROM link_blocks WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND discord_id = $2 AND is_active = true',
  //   [guildId, discordId]
  // );
  // return result.rows.length > 0;
  return false;
}

/**
 * Check if an IGN is blocked from linking
 * TEMPORARILY DISABLED - returns false
 */
async function isIgnBlocked(guildId, ign) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const result = await pool.query(
  //   'SELECT * FROM link_blocks WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND LOWER(ign) = LOWER($2) AND is_active = true',
  //   [guildId, ign]
  // );
  // return result.rows.length > 0;
  return false;
}

/**
 * Get active player links for a Discord ID
 */
async function getActivePlayerLinks(guildId, discordId) {
  const result = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND p.discord_id = $2 
     AND p.is_active = true`,
    [guildId, discordId]
  );
  return result.rows;
}

/**
 * Get active player links for an IGN
 */
async function getActivePlayerLinksByIgn(guildId, ign) {
  const result = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND LOWER(p.ign) = LOWER($2) 
     AND p.is_active = true`,
    [guildId, ign]
  );
  return result.rows;
}

/**
 * Check if Discord ID is already linked to a different IGN
 */
async function isDiscordIdLinkedToDifferentIgn(guildId, discordId, ign) {
  const result = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND discord_id = $2 
     AND ign IS NOT NULL
     AND LOWER(ign) != LOWER($3) 
     AND is_active = true`,
    [guildId, discordId, ign]
  );
  return result.rows.length > 0;
}

/**
 * Check if IGN is already linked to a different Discord ID
 */
async function isIgnLinkedToDifferentDiscordId(guildId, ign, discordId) {
  const result = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND ign IS NOT NULL
     AND LOWER(ign) = LOWER($2) 
     AND discord_id != $3 
     AND is_active = true`,
    [guildId, ign, discordId]
  );
  return result.rows.length > 0;
}

/**
 * Create a link request
 */
async function createLinkRequest(guildId, discordId, ign, serverId) {
  // Clean up any existing requests for this user/server
  await pool.query(
    `DELETE FROM link_requests 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND discord_id = $2 
     AND server_id = $3`,
    [guildId, discordId, serverId]
  );

  // Create new request
  const result = await pool.query(
    `INSERT INTO link_requests (guild_id, discord_id, ign, server_id) 
     VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) 
     RETURNING *`,
    [guildId, discordId, ign, serverId]
  );
  return result.rows[0];
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

  // Handle guildId as TEXT (since guilds.discord_id is TEXT in database)
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
    // Ensure guild exists - guilds.discord_id is TEXT, so cast as TEXT
    const guildName = interaction?.guild?.name || 'Unknown Guild';
    const guildInsertQuery = `
      INSERT INTO guilds (discord_id, name)
      VALUES ($1::TEXT, $2::TEXT)
      ON CONFLICT (discord_id) DO NOTHING;
    `;
    console.log('🟧 Query:', guildInsertQuery, [guildIdText, guildName]);
    await pool.query(guildInsertQuery, [guildIdText, guildName]);
    console.log('✅ Guild ensured:', guildIdText);

    // Ensure server exists - guild_id subquery now uses TEXT for discord_id
    const serverInsertQuery = `
      INSERT INTO rust_servers (id, guild_id, nickname, ip)
      VALUES (
        $1::BIGINT,
        (SELECT id FROM guilds WHERE discord_id = $2::TEXT),
        $3::TEXT,
        $4::TEXT
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    console.log('🟧 Query:', serverInsertQuery, [serverIdBigInt, guildIdText, serverName, '0.0.0.0']);
    await pool.query(serverInsertQuery, [serverIdBigInt, guildIdText, serverName, '0.0.0.0']);
    console.log('✅ Server ensured:', serverIdBigInt.toString());

    // Update link request status - guild_id subquery uses TEXT for discord_id
    const linkRequestUpdateQuery = `
      UPDATE link_requests
      SET status = 'confirmed'
      WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1::TEXT)
        AND discord_id = $2::BIGINT
        AND server_id = $3::BIGINT
    `;
    try {
      console.log('🟧 Query:', linkRequestUpdateQuery, [guildIdText, discordIdBigInt, serverIdBigInt]);
      await pool.query(linkRequestUpdateQuery, [guildIdText, discordIdBigInt, serverIdBigInt]);
      console.log('✅ Link request status updated');
    } catch (e) {
      console.warn('⚠️ Could not update link request status:', e.message);
    }

    // Check for existing active player link by ign - guild_id subquery uses TEXT for discord_id
    const playerSelectQuery = `
      SELECT id, is_active FROM players
      WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1::TEXT)
        AND server_id = $2::BIGINT
        AND LOWER(ign) = LOWER($3::TEXT)
    `;
    console.log('🟧 Query:', playerSelectQuery, [guildIdText, serverIdBigInt, ignText]);
    const { rows: existingPlayers } = await pool.query(playerSelectQuery, [guildIdText, serverIdBigInt, ignText]);

    if (existingPlayers.length > 0) {
      const existing = existingPlayers[0];
      if (existing.is_active) {
        throw new Error("❌ This IGN is already linked and active. Contact an admin to unlink.");
      }
      // Reactivate inactive player
      const playerUpdateQuery = `
        UPDATE players
        SET discord_id = $3::BIGINT, linked_at = NOW(), is_active = true, unlinked_at = NULL
        WHERE id = $4
      `;
      console.log('🟧 Query:', playerUpdateQuery, [guildIdText, serverIdBigInt, discordIdBigInt, existing.id]);
      await pool.query(playerUpdateQuery, [guildIdText, serverIdBigInt, discordIdBigInt, existing.id]);
      // Ensure economy record
      const economyInsertQuery = `
        INSERT INTO economy (player_id, balance)
        VALUES ($1, 0)
        ON CONFLICT (player_id) DO NOTHING
      `;
      console.log('🟧 Query:', economyInsertQuery, [existing.id]);
      await pool.query(economyInsertQuery, [existing.id]);
      console.log('✅ Reactivated existing inactive player:', ignText);
      return { id: existing.id };
    }

    // Insert new player or update existing discord_id (upsert) - guild_id subquery uses TEXT for discord_id
    const playerInsertQuery = `
      INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
      VALUES (
        (SELECT id FROM guilds WHERE discord_id = $1::TEXT),
        $2::BIGINT,
        $3::BIGINT,
        $4::TEXT,
        NOW(),
        true
      )
      ON CONFLICT (guild_id, server_id, ign)
      DO UPDATE SET
        discord_id = EXCLUDED.discord_id,
        linked_at = NOW(),
        is_active = true,
        unlinked_at = NULL
      RETURNING *;
    `;
    console.log('🟧 Query:', playerInsertQuery, [guildIdText, serverIdBigInt, discordIdBigInt, ignText]);
    const { rows } = await pool.query(playerInsertQuery, [guildIdText, serverIdBigInt, discordIdBigInt, ignText]);

    const player = rows[0];

    // Ensure economy record
    const economyInsertQuery = `
      INSERT INTO economy (player_id, balance)
      VALUES ($1, 0)
      ON CONFLICT (player_id) DO NOTHING
    `;
    console.log('🟧 Query:', economyInsertQuery, [player.id]);
    await pool.query(economyInsertQuery, [player.id]);

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
  const result = await pool.query(
    `UPDATE players 
     SET is_active = false, unlinked_at = NOW() 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND discord_id = $2 
     AND server_id = $3 
     AND is_active = true
     RETURNING *`,
    [guildId, discordId, serverId]
  );
  return result.rows[0];
}

/**
 * Unlink all players for a Discord ID across all servers
 */
async function unlinkAllPlayers(guildId, discordId) {
  const result = await pool.query(
    `UPDATE players 
     SET is_active = false, unlinked_at = NOW() 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND discord_id = $2 
     AND is_active = true
     RETURNING *`,
    [guildId, discordId]
  );
  return result.rows;
}

/**
 * Unlink all players for an IGN across all servers
 */
async function unlinkAllPlayersByIgn(guildId, ign) {
  const result = await pool.query(
    `UPDATE players 
     SET is_active = false, unlinked_at = NOW() 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND LOWER(ign) = LOWER($2) 
     AND is_active = true
     RETURNING *`,
    [guildId, ign]
  );
  return result.rows;
}

/**
 * Block a Discord ID from linking
 * TEMPORARILY DISABLED - returns null
 */
async function blockDiscordId(guildId, discordId, blockedBy, reason = null) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const result = await pool.query(
  //   `INSERT INTO link_blocks (guild_id, discord_id, blocked_by, reason) 
  //    VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) 
  //    ON CONFLICT (guild_id, discord_id) 
  //    DO UPDATE SET 
  //      blocked_at = NOW(),
  //      blocked_by = EXCLUDED.blocked_by,
  //      reason = EXCLUDED.reason,
  //      is_active = true
  //    RETURNING *`,
  //   [guildId, discordId, blockedBy, reason]
  // );
  // return result.rows[0];
  return null;
}

/**
 * Block an IGN from linking
 * TEMPORARILY DISABLED - returns null
 */
async function blockIgn(guildId, ign, blockedBy, reason = null) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const result = await pool.query(
  //   `INSERT INTO link_blocks (guild_id, ign, blocked_by, reason) 
  //   VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) 
  //   ON CONFLICT (guild_id, ign) 
  //   DO UPDATE SET 
  //     blocked_at = NOW(),
  //     blocked_by = EXCLUDED.blocked_by,
  //     reason = EXCLUDED.reason,
  //     is_active = true
  //   RETURNING *`,
  //   [guildId, ign, blockedBy, reason]
  // );
  // return result.rows[0];
  return null;
}

/**
 * Unblock a Discord ID
 * TEMPORARILY DISABLED - returns null
 */
async function unblockDiscordId(guildId, discordId) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const result = await pool.query(
  //   `UPDATE link_blocks 
  //    SET is_active = false 
  //    WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
  //    AND discord_id = $2 
  //    AND is_active = true
  //    RETURNING *`,
  //   [guildId, discordId]
  // );
  // return result.rows[0];
  return null;
}

/**
 * Unblock an IGN
 * TEMPORARILY DISABLED - returns null
 */
async function unblockIgn(guildId, ign) {
  // TEMPORARILY DISABLED - table doesn't exist
  // const result = await pool.query(
  //   `UPDATE link_blocks 
  //    SET is_active = false 
  //    WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
  //    AND LOWER(ign) = LOWER($2) 
  //    AND is_active = true
  //    RETURNING *`,
  //   [guildId, ign]
  // );
  // return result.rows[0];
  return null;
}

/**
 * Get all servers for a guild
 */
async function getServersForGuild(guildId) {
  const result = await pool.query(
    'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) ORDER BY nickname',
    [guildId]
  );
  return result.rows;
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