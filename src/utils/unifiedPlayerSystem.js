const pool = require('../db');

/**
 * Check if input is a numeric Discord ID
 */
function isDiscordId(input) {
  return /^\d+$/.test(input);
}

/**
 * Get active player by Discord ID and server
 */
async function getActivePlayerByDiscordId(guildId, serverId, discordId) {
  const result = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
     AND p.server_id = $2
     AND p.discord_id = $3
     AND p.is_active = true`,
    [guildId, serverId, discordId]
  );
  return result.rows[0] || null;
}

/**
 * Get active player by IGN and server
 */
async function getActivePlayerByIgn(guildId, serverId, ign) {
  const result = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
     AND p.server_id = $2
     AND LOWER(p.ign) = LOWER($3)
     AND p.is_active = true`,
    [guildId, serverId, ign]
  );
  return result.rows[0] || null;
}

/**
 * Get all active players for a Discord ID across all servers
 */
async function getAllActivePlayersByDiscordId(guildId, discordId) {
  const result = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
     AND p.discord_id = $2
     AND p.is_active = true
     ORDER BY rs.nickname`,
    [guildId, discordId]
  );
  return result.rows;
}

/**
 * Get all active players for an IGN across all servers
 */
async function getAllActivePlayersByIgn(guildId, ign) {
  const result = await pool.query(
    `SELECT p.*, rs.nickname 
     FROM players p
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
     AND LOWER(p.ign) = LOWER($2)
     AND p.is_active = true
     ORDER BY rs.nickname`,
    [guildId, ign]
  );
  return result.rows;
}

/**
 * Get all active players by identifier (Discord ID or IGN) across all servers
 */
async function getAllActivePlayersByIdentifier(guildId, identifier) {
  if (isDiscordId(identifier)) {
    return getAllActivePlayersByDiscordId(guildId, identifier);
  } else {
    return getAllActivePlayersByIgn(guildId, identifier);
  }
}

/**
 * Create or update player link - handles both Discord ID and IGN inputs
 */
async function createOrUpdatePlayerLink(guildId, serverId, identifier, ign = null) {
  let discordId, finalIgn;
  
  if (isDiscordId(identifier)) {
    // Input is a Discord ID
    discordId = identifier;
    finalIgn = ign || 'Unknown';
  } else {
    // Input is an IGN - we need to find or create a Discord ID
    // For now, we'll use a placeholder Discord ID for IGN-only links
    // This could be enhanced to require a Discord ID for IGN links
    discordId = '0'; // Placeholder - you might want to require Discord ID for IGN links
    finalIgn = identifier;
  }

  // First, ensure the player record exists
  const playerResult = await pool.query(
    `INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
     VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4, NOW(), true)
     ON CONFLICT (guild_id, discord_id, server_id)
     DO UPDATE SET 
       ign = EXCLUDED.ign,
       linked_at = NOW(),
       unlinked_at = NULL,
       is_active = true
     RETURNING *`,
    [guildId, serverId, discordId, finalIgn]
  );

  const player = playerResult.rows[0];

  // Ensure economy record exists
  await pool.query(
    'INSERT INTO economy (player_id, balance) VALUES ($1, 0) ON CONFLICT (player_id) DO NOTHING',
    [player.id]
  );

  return player;
}

/**
 * Unlink player from a specific server
 */
async function unlinkPlayer(guildId, serverId, discordId) {
  const result = await pool.query(
    `UPDATE players 
     SET is_active = false, unlinked_at = NOW(), ign = NULL
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
     AND server_id = $2
     AND discord_id = $3
     AND is_active = true
     RETURNING *`,
    [guildId, serverId, discordId]
  );
  return result.rows[0];
}

/**
 * Unlink all players for a Discord ID across all servers
 */
async function unlinkAllPlayersByDiscordId(guildId, discordId) {
  const result = await pool.query(
    `UPDATE players 
     SET is_active = false, unlinked_at = NOW(), ign = NULL
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
     SET is_active = false, unlinked_at = NOW(), ign = NULL
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
     AND LOWER(ign) = LOWER($2)
     AND is_active = true
     RETURNING *`,
    [guildId, ign]
  );
  return result.rows;
}

/**
 * Unlink all players by identifier (Discord ID or IGN) across all servers
 * This function handles both Discord IDs and IGNs with a single query
 */
async function unlinkAllPlayersByIdentifier(guildId, identifier) {
  const result = await pool.query(
    `UPDATE players 
     SET is_active = false, unlinked_at = NOW(), ign = NULL
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
     AND (discord_id = $2 OR LOWER(ign) = LOWER($2))
     AND is_active = true
     RETURNING *`,
    [guildId, identifier]
  );
  return result.rows;
}

/**
 * Check if Discord ID is already linked to a different IGN on any server
 */
async function isDiscordIdLinkedToDifferentIgn(guildId, discordId, ign) {
  const result = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
     AND discord_id = $2
     AND LOWER(ign) != LOWER($3)
     AND is_active = true`,
    [guildId, discordId, ign]
  );
  return result.rows.length > 0;
}

/**
 * Check if IGN is already linked to a different Discord ID on any server
 */
async function isIgnLinkedToDifferentDiscordId(guildId, ign, discordId) {
  const result = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
     AND LOWER(ign) = LOWER($2)
     AND discord_id != $3
     AND is_active = true`,
    [guildId, ign, discordId]
  );
  return result.rows.length > 0;
}

/**
 * Get player balance
 */
async function getPlayerBalance(playerId) {
  const result = await pool.query(
    'SELECT balance FROM economy WHERE player_id = $1',
    [playerId]
  );
  return result.rows[0]?.balance || 0;
}

/**
 * Update player balance
 */
async function updatePlayerBalance(playerId, amount) {
  const result = await pool.query(
    `UPDATE economy 
     SET balance = balance + $2 
     WHERE player_id = $1 
     RETURNING balance`,
    [playerId, amount]
  );
  return result.rows[0]?.balance || 0;
}

/**
 * Record transaction
 */
async function recordTransaction(playerId, amount, type) {
  await pool.query(
    'INSERT INTO transactions (player_id, amount, type) VALUES ($1, $2, $3)',
    [playerId, amount, type]
  );
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

/**
 * Get server by nickname
 */
async function getServerByNickname(guildId, nickname) {
  const result = await pool.query(
    'SELECT * FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname = $2',
    [guildId, nickname]
  );
  return result.rows[0] || null;
}

module.exports = {
  getActivePlayerByDiscordId,
  getActivePlayerByIgn,
  getAllActivePlayersByDiscordId,
  getAllActivePlayersByIgn,
  getAllActivePlayersByIdentifier,
  createOrUpdatePlayerLink,
  unlinkPlayer,
  unlinkAllPlayersByDiscordId,
  unlinkAllPlayersByIgn,
  unlinkAllPlayersByIdentifier,
  isDiscordIdLinkedToDifferentIgn,
  isIgnLinkedToDifferentDiscordId,
  getPlayerBalance,
  updatePlayerBalance,
  recordTransaction,
  getServersForGuild,
  getServerByNickname,
  isDiscordId
};