const pool = require('../db');

/**
 * Ensure database pool is available
 */
function ensurePool() {
  if (!pool) {
    throw new Error('Database pool is not available. Please ensure the database is properly initialized.');
  }
  return pool;
}

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
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND server_id = ?
     AND discord_id = ?
     AND is_active = true`,
    [guildId, serverId, discordId]
  );
  return result[0] || null;
}

/**
 * Get active player by IGN and server
 */
async function getActivePlayerByIgn(guildId, serverId, ign) {
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND server_id = ?
     AND ign IS NOT NULL
     AND LOWER(ign) = LOWER(?)
     AND is_active = true`,
    [guildId, serverId, ign]
  );
  return result[0] || null;
}

/**
 * Get all active players for a Discord ID across all servers
 */
async function getAllActivePlayersByDiscordId(guildId, discordId) {
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND discord_id = ?
     AND is_active = true`,
    [guildId, discordId]
  );
  return result;
}

/**
 * Get all active players for an IGN across all servers
 */
async function getAllActivePlayersByIgn(guildId, ign) {
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND ign IS NOT NULL
     AND LOWER(ign) = LOWER(?)
     AND is_active = true`,
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
  const dbPool = ensurePool();
  const discordId = isDiscordId(identifier) ? identifier : null;
  const playerIgn = isDiscordId(identifier) ? ign : identifier;

  // First check if player already exists on this server
  const [existingPlayer] = await dbPool.query(
    `SELECT id FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
     AND server_id = ? 
     AND discord_id = ?`,
    [guildId, serverId, discordId]
  );

  let result;
  if (existingPlayer.length > 0) {
    // Update existing player
    const normalizedIgn = require('./autoServerLinking').normalizeIGN(playerIgn);
    result = await dbPool.query(
      `UPDATE players 
       SET ign = ?, normalized_ign = ?, linked_at = CURRENT_TIMESTAMP, is_active = true
       WHERE id = ?`,
      [playerIgn, normalizedIgn, existingPlayer[0].id]
    );
    result.insertId = existingPlayer[0].id;
  } else {
    // Insert new player
    const normalizedIgn = require('./autoServerLinking').normalizeIGN(playerIgn);
    result = await dbPool.query(
      `INSERT INTO players (guild_id, server_id, discord_id, ign, normalized_ign, linked_at, is_active)
       VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, ?, CURRENT_TIMESTAMP, true)`,
      [guildId, serverId, discordId, playerIgn, normalizedIgn]
    );
  }

  // Get the inserted/updated player
  const [playerResult] = await dbPool.query(
    'SELECT * FROM players WHERE id = ?',
    [result.insertId]
  );
  
  const player = playerResult[0];
  
  // Check if this is a new player (no existing economy record)
  const [economyResult] = await dbPool.query(
    'SELECT * FROM economy WHERE player_id = ?',
    [player.id]
  );
  
  // If no economy record exists, create one with starting balance
  if (economyResult.length === 0) {
    // Get starting balance from eco_games_config
    const [configResult] = await dbPool.query(
      'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = ?',
      [serverId, 'starting_balance']
    );
    
    let startingBalance = 0; // Default starting balance
    if (configResult.length > 0) {
      startingBalance = parseInt(configResult[0].setting_value) || 0;
    }
    
    // Create economy record with starting balance and guild_id
    await dbPool.query(
      'INSERT INTO economy (player_id, balance, guild_id) VALUES (?, ?, ?)',
      [player.id, startingBalance, guildId]
    );
    
    console.log(`[LINK] Created economy record for player ${playerIgn} with starting balance: ${startingBalance}`);
  }
  
  return player;
}

/**
 * Unlink player from a specific server
 */
async function unlinkPlayer(guildId, serverId, discordId) {
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
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
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
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
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
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
  const dbPool = ensurePool();
  if (isDiscordId(identifier)) {
    // Handle Discord ID (numeric) - direct comparison, always deactivate regardless of current status
    const [result] = await dbPool.query(
      `UPDATE players 
       SET unlinked_at = CURRENT_TIMESTAMP, is_active = false
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND discord_id = ?`,
      [guildId, identifier]
    );
    
    console.log(`Unlinked ${result.affectedRows} player(s) for Discord ID: ${identifier}`);
    return { rows: result, rowCount: result.affectedRows };
  } else {
    // Handle IGN (text) - only unlink players that are actually linked (have Discord ID)
    const [result] = await dbPool.query(
      `UPDATE players 
       SET unlinked_at = CURRENT_TIMESTAMP, is_active = false
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND ign IS NOT NULL
       AND LOWER(ign) = LOWER(?)
       AND discord_id IS NOT NULL`,
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
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
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
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
    `SELECT * FROM players 
     WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
     AND ign IS NOT NULL
     AND LOWER(ign) = LOWER(?)
     AND discord_id IS NOT NULL
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
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
    'SELECT balance FROM economy WHERE player_id = ?',
    [playerId]
  );
  return result[0]?.balance || 0;
}

/**
 * Ensure economy record exists for a player
 */
async function ensureEconomyRecord(playerId, guildId) {
  const dbPool = ensurePool();
  const [economyCheck] = await dbPool.query(
    'SELECT id FROM economy WHERE player_id = ?',
    [playerId]
  );
  
  if (economyCheck.length === 0) {
    // Create missing economy record
    await dbPool.query(
      'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, ?, 0)',
      [playerId, guildId]
    );
    console.log(`[ECONOMY] Created missing economy record for player ${playerId}`);
    return true;
  }
  return false;
}

/**
 * Update player balance
 */
async function updatePlayerBalance(playerId, amount) {
  const dbPool = ensurePool();
  
  // Ensure economy record exists first
  const [playerResult] = await dbPool.query(
    'SELECT guild_id FROM players WHERE id = ?',
    [playerId]
  );
  
  if (playerResult.length > 0) {
    await ensureEconomyRecord(playerId, playerResult[0].guild_id);
  }
  
  const [result] = await dbPool.query(
    `UPDATE economy 
     SET balance = GREATEST(0, balance + ?) 
     WHERE player_id = ?`,
    [amount, playerId]
  );
  
  // Get the updated balance
  const [balanceResult] = await dbPool.query(
    'SELECT balance FROM economy WHERE player_id = ?',
    [playerId]
  );
  return balanceResult[0]?.balance || 0;
}

/**
 * Record transaction
 */
async function recordTransaction(playerId, amount, type) {
  const dbPool = ensurePool();
  await dbPool.query(
    'INSERT INTO transactions (player_id, guild_id, amount, type) VALUES (?, (SELECT guild_id FROM players WHERE id = ?), ?, ?)',
    [playerId, playerId, amount, type]
  );
}

/**
 * Get all servers for a guild
 */
async function getServersForGuild(guildId) {
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
    'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
    [guildId]
  );
  return result;
}

/**
 * Get server by nickname
 */
async function getServerByNickname(guildId, nickname) {
  const dbPool = ensurePool();
  const [result] = await dbPool.query(
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
  isDiscordId,
  ensureEconomyRecord
};