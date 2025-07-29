const pool = require('../db');

/**
 * Get server by nickname and guild
 */
async function getServerByNickname(guildId, nickname) {
  const [result] = await pool.query(
    'SELECT rs.id, rs.nickname, rs.ip, rs.port, rs.password FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
    [guildId, nickname]
  );
  return result[0] || null;
}

/**
 * Get server by ID and guild
 */
async function getServerById(guildId, serverId) {
  const [result] = await pool.query(
    'SELECT rs.id, rs.nickname, rs.ip, rs.port, rs.password FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.id = ?',
    [guildId, serverId]
  );
  return result[0] || null;
}

/**
 * Get player by IGN and server
 */
async function getPlayerByIgn(guildId, serverId, ign) {
  const [result] = await pool.query(
    'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND ign LIKE ?',
    [guildId, serverId, ign]
  );
  return result[0] || null;
}

/**
 * Get player by Discord ID and server
 */
async function getPlayerByDiscordId(guildId, serverId, discordId) {
  const [result] = await pool.query(
    'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ?',
    [guildId, serverId, discordId]
  );
  return result[0] || null;
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
  await pool.query(
    'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
    [amount, playerId]
  );
  
  // Get updated balance
  const [result] = await pool.query(
    'SELECT balance FROM economy WHERE player_id = ?',
    [playerId]
  );
  return result[0]?.balance || 0;
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
 * Get all players for a server
 */
async function getAllPlayersForServer(guildId, serverId) {
  const [result] = await pool.query(
    `SELECT p.*, e.balance 
     FROM players p 
     LEFT JOIN economy e ON p.id = e.player_id 
     WHERE p.discord_id = ? AND rs.id = ? AND rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)`,
    [guildId, serverId, guildId]
  );
  return result;
}

/**
 * Search servers by nickname
 */
async function searchServersByNickname(guildId, searchTerm) {
  const [result] = await pool.query(
    'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? ORDER BY nickname LIMIT 25',
    [guildId, `%${searchTerm}%`]
  );
  return result;
}

module.exports = {
  getServerByNickname,
  getServerById,
  getPlayerByIgn,
  getPlayerByDiscordId,
  getPlayerBalance,
  updatePlayerBalance,
  recordTransaction,
  getAllPlayersForServer,
  searchServersByNickname
};
