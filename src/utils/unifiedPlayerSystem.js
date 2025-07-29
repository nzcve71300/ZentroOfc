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
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND p.server_id = ?
     AND p.discord_id = ?
     AND p.is_active = true`,
    [guildId, serverId, discordId]
  );
  return result[0] || null;
}

/**
 * Get active player by IGN and server
 */
async function getActivePlayerByIgn(guildId, serverId, ign) {
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND p.server_id = ?
     AND p.ign IS NOT NULL
     AND LOWER(p.ign) = LOWER(?)
     AND p.is_active = true`,
    [guildId, serverId, ign]
  );
  return result[0] || null;
}

/**
 * Get all active players for a Discord ID across all servers
 */
async function getAllActivePlayersByDiscordId(guildId, discordId) {
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND p.discord_id = ?
     AND p.is_active = true`,
    [guildId, discordId]
  );
  return result;
}

/**
 * Get all active players for an IGN across all servers
 */
async function getAllActivePlayersByIgn(guildId, ign) {
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND p.ign IS NOT NULL
     AND LOWER(p.ign) = LOWER(?)
     AND p.is_active = true`,
    [guildId, ign]
  );
  return result;
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
  const discordId = isDiscordId(identifier) ? identifier : null;
  const playerIgn = isDiscordId(identifier) ? ign : identifier;

  const [result] = await pool.query(
    `INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
     VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, CURRENT_TIMESTAMP, true)
     ON DUPLICATE KEY UPDATE 
       ign = VALUES(ign),
       linked_at = CURRENT_TIMESTAMP,
       is_active = true`,
    [guildId, serverId, discordId, playerIgn]
  );

  // Get the inserted/updated player
  const [playerResult] = await pool.query(
    'SELECT * FROM players WHERE id = ?',
    [result.insertId]
  );
  return playerResult[0];
}

/**
 * Unlink player from a specific server
 */
async function unlinkPlayer(guildId, serverId, discordId) {
  const [result] = await pool.query(
    `UPDATE players 
     SET unlinked_at = CURRENT_TIMESTAMP, is_active = false
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND server_id = ?
     AND discord_id = ?
     AND is_active = true`,
    [guildId, serverId, discordId]
  );
  return result.affectedRows > 0;
}

/**
 * Unlink all players for a Discord ID across all servers
 */
async function unlinkAllPlayersByDiscordId(guildId, discordId) {
  const [result] = await pool.query(
    `UPDATE players 
     SET unlinked_at = CURRENT_TIMESTAMP, is_active = false
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND discord_id = ?
     AND is_active = true`,
    [guildId, discordId]
  );
  return result.affectedRows;
}

/**
 * Unlink all players for an IGN across all servers
 */
async function unlinkAllPlayersByIgn(guildId, ign) {
  const [result] = await pool.query(
    `UPDATE players 
     SET unlinked_at = CURRENT_TIMESTAMP, is_active = false
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND ign IS NOT NULL
     AND LOWER(ign) = LOWER(?)
     AND is_active = true`,
    [guildId, ign]
  );
  return result.affectedRows;
}

/**
 * Unlink all players by identifier (Discord ID or IGN) across all servers
 * This function handles both Discord IDs and IGNs with separate queries to avoid BIGINT LOWER() error
 */
async function unlinkAllPlayersByIdentifier(guildId, identifier) {
  if (isDiscordId(identifier)) {
    // Handle Discord ID (numeric) - direct comparison, always deactivate regardless of current status
    const [result] = await pool.query(
      `UPDATE players 
       SET unlinked_at = CURRENT_TIMESTAMP, is_active = false
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND discord_id = ?`,
      [guildId, identifier]
    );
    
    console.log(`Unlinked ${result.affectedRows} player(s) for Discord ID: ${identifier}`);
    return { rows: result, rowCount: result.affectedRows };
  } else {
    // Handle IGN (text) - case-insensitive match, always deactivate regardless of current status
    const [result] = await pool.query(
      `UPDATE players 
       SET unlinked_at = CURRENT_TIMESTAMP, is_active = false
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND ign IS NOT NULL
       AND LOWER(ign) = LOWER(?)`,
      [guildId, identifier]
    );
    
    console.log(`Unlinked ${result.affectedRows} player(s) for IGN: ${identifier}`);
    return { rows: result, rowCount: result.affectedRows };
  }
}

/**
 * Check if Discord ID is already linked to a different IGN on any server
 */
async function isDiscordIdLinkedToDifferentIgn(guildId, discordId, ign) {
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND discord_id = ?
     AND ign IS NOT NULL
     AND LOWER(ign) != LOWER(?)
     AND is_active = true`,
    [guildId, discordId, ign]
  );
  return result.length > 0;
}

/**
 * Check if IGN is already linked to a different Discord ID on any server
 */
async function isIgnLinkedToDifferentDiscordId(guildId, ign, discordId) {
  const [result] = await pool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND ign IS NOT NULL
     AND LOWER(ign) = LOWER(?)
     AND discord_id != ?
     AND is_active = true`,
    [guildId, ign, discordId]
  );
  return result.length > 0;
}

/**
 * Get player balance
 */
async function getPlayerBalance(playerId) {
  const [result] = await pool.query(
    'SELECT balance FROM economy WHERE player_id = ?',
    [playerId]
  );
  return result[0]?.balance || 0;
}

/**
 * Update player balance
 */
async function updatePlayerBalance(playerId, amount) {
  const [result] = await pool.query(
    `UPDATE economy 
     SET balance = balance + ? 
     WHERE player_id = ?`,
    [amount, playerId]
  );
  
  // Get the updated balance
  const [balanceResult] = await pool.query(
    'SELECT balance FROM economy WHERE player_id = ?',
    [playerId]
  );
  return balanceResult[0]?.balance || 0;
}

/**
 * Record transaction
 */
async function recordTransaction(playerId, amount, type) {
  await pool.query(
    'INSERT INTO transactions (player_id, amount, type) VALUES (?, ?, ?)',
    [playerId, amount, type]
  );
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

/**
 * Get server by nickname
 */
async function getServerByNickname(guildId, nickname) {
  const [result] = await pool.query(
    'SELECT * FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
    [guildId, nickname]
  );
  return result[0] || null;
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