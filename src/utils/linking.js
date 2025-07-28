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
    `SELECT pl.*, rs.nickname 
     FROM player_links pl
     JOIN rust_servers rs ON pl.server_id = rs.id
     WHERE pl.guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND pl.discord_id = $2 
     AND pl.is_active = true`,
    [guildId, discordId]
  );
  return result.rows;
}

/**
 * Get active player links for an IGN
 */
async function getActivePlayerLinksByIgn(guildId, ign) {
  const result = await pool.query(
    `SELECT pl.*, rs.nickname 
     FROM player_links pl
     JOIN rust_servers rs ON pl.server_id = rs.id
     WHERE pl.guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND LOWER(pl.ign) = LOWER($2) 
     AND pl.is_active = true`,
    [guildId, ign]
  );
  return result.rows;
}

/**
 * Check if Discord ID is already linked to a different IGN
 */
async function isDiscordIdLinkedToDifferentIgn(guildId, discordId, ign) {
  const result = await pool.query(
    `SELECT * FROM player_links 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND discord_id = $2 
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
    `SELECT * FROM player_links 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
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
 * Confirm a link request
 */
async function confirmLinkRequest(guildId, discordId, ign, serverId) {
  // Update request status
  await pool.query(
    `UPDATE link_requests 
     SET status = 'confirmed' 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND discord_id = $2 
     AND server_id = $3`,
    [guildId, discordId, serverId]
  );

  // Create active player link
  const result = await pool.query(
    `INSERT INTO player_links (guild_id, discord_id, ign, server_id) 
     VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) 
     ON CONFLICT (guild_id, discord_id, server_id) 
     DO UPDATE SET 
       ign = EXCLUDED.ign,
       linked_at = NOW(),
       unlinked_at = NULL,
       is_active = true
     RETURNING *`,
    [guildId, discordId, ign, serverId]
  );

  // Ensure player record exists in players table
  await pool.query(
    `INSERT INTO players (guild_id, server_id, discord_id, ign) 
     VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) 
     ON CONFLICT (guild_id, server_id, discord_id) 
     DO UPDATE SET ign = EXCLUDED.ign`,
    [guildId, serverId, discordId, ign]
  );

  // Ensure economy record exists
  const playerResult = await pool.query(
    'SELECT id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND server_id = $2 AND discord_id = $3',
    [guildId, serverId, discordId]
  );

  if (playerResult.rows.length > 0) {
    await pool.query(
      'INSERT INTO economy (player_id, balance) VALUES ($1, 0) ON CONFLICT (player_id) DO NOTHING',
      [playerResult.rows[0].id]
    );
  }

  return result.rows[0];
}

/**
 * Unlink a player
 */
async function unlinkPlayer(guildId, discordId, serverId) {
  const result = await pool.query(
    `UPDATE player_links 
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
    `UPDATE player_links 
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
    `UPDATE player_links 
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
 */
async function blockDiscordId(guildId, discordId, blockedBy, reason = null) {
  const result = await pool.query(
    `INSERT INTO link_blocks (guild_id, discord_id, blocked_by, reason) 
     VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) 
     ON CONFLICT (guild_id, discord_id) 
     DO UPDATE SET 
       blocked_at = NOW(),
       blocked_by = EXCLUDED.blocked_by,
       reason = EXCLUDED.reason,
       is_active = true
     RETURNING *`,
    [guildId, discordId, blockedBy, reason]
  );
  return result.rows[0];
}

/**
 * Block an IGN from linking
 */
async function blockIgn(guildId, ign, blockedBy, reason = null) {
  const result = await pool.query(
    `INSERT INTO link_blocks (guild_id, ign, blocked_by, reason) 
     VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) 
     ON CONFLICT (guild_id, ign) 
     DO UPDATE SET 
       blocked_at = NOW(),
       blocked_by = EXCLUDED.blocked_by,
       reason = EXCLUDED.reason,
       is_active = true
     RETURNING *`,
    [guildId, ign, blockedBy, reason]
  );
  return result.rows[0];
}

/**
 * Unblock a Discord ID
 */
async function unblockDiscordId(guildId, discordId) {
  const result = await pool.query(
    `UPDATE link_blocks 
     SET is_active = false 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND discord_id = $2 
     AND is_active = true
     RETURNING *`,
    [guildId, discordId]
  );
  return result.rows[0];
}

/**
 * Unblock an IGN
 */
async function unblockIgn(guildId, ign) {
  const result = await pool.query(
    `UPDATE link_blocks 
     SET is_active = false 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
     AND LOWER(ign) = LOWER($2) 
     AND is_active = true
     RETURNING *`,
    [guildId, ign]
  );
  return result.rows[0];
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