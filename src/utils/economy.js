const pool = require('../db');

// Get server by nickname (with guild context)
async function getServerByNickname(guildId, nickname) {
  const result = await pool.query(
    'SELECT rs.id, rs.nickname, rs.ip, rs.port, rs.password FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
    [guildId, nickname]
  );
  return result.rows[0] || null;
}

// Get server by ID for a specific guild
async function getServerById(guildId, serverId) {
  const result = await pool.query(
    'SELECT rs.id, rs.nickname, rs.ip, rs.port, rs.password FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.id = $2',
    [guildId, serverId]
  );
  return result.rows[0] || null;
}

// Get player by IGN for a specific server
async function getPlayerByIGN(guildId, serverId, ign) {
  const result = await pool.query(
    'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND server_id = $2 AND ign ILIKE $3',
    [guildId, serverId, ign]
  );
  return result.rows[0] || null;
}

// Get linked player by Discord ID
async function getLinkedPlayer(guildId, serverId, discordId) {
  const result = await pool.query(
    'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND server_id = $2 AND discord_id = $3',
    [guildId, serverId, discordId]
  );
  return result.rows[0] || null;
}

// Get or create economy record
async function ensureEconomyRecord(playerId) {
  const result = await pool.query(
    'SELECT id, balance FROM economy WHERE player_id = $1',
    [playerId]
  );
  if (result.rows.length === 0) {
    await pool.query('INSERT INTO economy (player_id, balance) VALUES ($1, 0)', [playerId]);
    return { balance: 0 };
  }
  return result.rows[0];
}

// Update balance safely
async function updateBalance(playerId, amount) {
  try {
    const economy = await ensureEconomyRecord(playerId);
    const newBalance = Math.max(0, parseInt(economy.balance || 0) + amount);
    await pool.query('UPDATE economy SET balance = $1 WHERE player_id = $2', [newBalance, playerId]);
    return { success: true, newBalance };
  } catch (error) {
    console.error('Error updating balance:', error);
    return { success: false, newBalance: 0 };
  }
}

// Record a transaction
async function recordTransaction(playerId, amount, type) {
  await pool.query(
    'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
    [playerId, amount, type]
  );
}

// Get player balance for a specific server
async function getPlayerBalance(guildId, serverNickname, discordId) {
  const result = await pool.query(
    `SELECT e.balance, p.id as player_id
     FROM players p
     JOIN economy e ON p.id = e.player_id
     JOIN rust_servers rs ON p.server_id = rs.id
     WHERE p.discord_id = $1 AND rs.nickname = $2 AND rs.guild_id = (SELECT id FROM guilds WHERE discord_id = $3)
     LIMIT 1`,
    [discordId, serverNickname, guildId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return {
    balance: parseInt(result.rows[0].balance || 0),
    playerId: result.rows[0].player_id
  };
}

// Get all servers for a guild (for autocomplete)
async function getServersForGuild(guildId, searchTerm = '') {
  const result = await pool.query(
    'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 ORDER BY nickname LIMIT 25',
    [guildId, `%${searchTerm}%`]
  );
  
  return result.rows.map(row => ({
    name: row.nickname,
    value: row.nickname
  }));
}

module.exports = {
  getServerByNickname,
  getServerById,
  getPlayerByIGN,
  getLinkedPlayer,
  ensureEconomyRecord,
  updateBalance,
  recordTransaction,
  getPlayerBalance,
  getServersForGuild
};
