const pool = require('../db');

/**
 * Get server by nickname for a specific guild
 * @param {string} guildId - Discord guild ID
 * @param {string} nickname - Server nickname
 * @returns {Promise<object|null>} - Server object with { id, nickname, ip, port, password } or null
 */
async function getServerByNickname(guildId, nickname) {
  try {
    const result = await pool.query(
      'SELECT rs.id, rs.nickname, rs.ip, rs.port, rs.password FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
      [guildId, nickname]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting server by nickname:', error);
    return null;
  }
}

/**
 * Get server by ID for a specific guild
 * @param {string} guildId - Discord guild ID
 * @param {number} serverId - Server ID
 * @returns {Promise<object|null>} - Server object with { id, nickname, ip, port, password } or null
 */
async function getServerById(guildId, serverId) {
  try {
    const result = await pool.query(
      'SELECT rs.id, rs.nickname, rs.ip, rs.port, rs.password FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.id = $2',
      [guildId, serverId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting server by ID:', error);
    return null;
  }
}

/**
 * Get player by IGN for a specific server
 * @param {string} guildId - Discord guild ID
 * @param {number} serverId - Server ID
 * @param {string} ign - Player's in-game name
 * @returns {Promise<object|null>} - Player row or null
 */
async function getPlayerByIGN(guildId, serverId, ign) {
  try {
    const result = await pool.query(
      'SELECT * FROM players WHERE guild_id = $1 AND server_id = $2 AND LOWER(ign) = LOWER($3) LIMIT 1',
      [guildId, serverId, ign]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting player by IGN:', error);
    return null;
  }
}

/**
 * Get linked player by Discord ID for a specific server
 * @param {string} guildId - Discord guild ID
 * @param {number} serverId - Server ID
 * @param {string} discordId - Discord user ID
 * @returns {Promise<object|null>} - Player row or null
 */
async function getLinkedPlayer(guildId, serverId, discordId) {
  try {
    const result = await pool.query(
      'SELECT * FROM players WHERE guild_id = $1 AND server_id = $2 AND discord_id = $3 LIMIT 1',
      [guildId, serverId, discordId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting linked player:', error);
    return null;
  }
}

/**
 * Safely update player balance (insert if missing, prevent negative)
 * @param {number} playerId - Player ID
 * @param {number} amount - Amount to add/subtract (positive for add, negative for subtract)
 * @returns {Promise<object>} - { success: boolean, newBalance: number, oldBalance: number }
 */
async function updateBalance(playerId, amount) {
  try {
    // Get current balance
    const currentResult = await pool.query(
      'SELECT balance FROM economy WHERE player_id = $1',
      [playerId]
    );

    let oldBalance = 0;
    let newBalance = amount;

    if (currentResult.rows.length === 0) {
      // Create economy record if missing
      if (amount < 0) {
        // Don't allow negative balance for new records
        return { success: false, newBalance: 0, oldBalance: 0, error: 'Cannot create negative balance' };
      }
      await pool.query(
        'INSERT INTO economy (player_id, balance) VALUES ($1, $2)',
        [playerId, amount]
      );
    } else {
      oldBalance = parseInt(currentResult.rows[0].balance || 0);
      newBalance = Math.max(0, oldBalance + amount); // Prevent negative balance
      
      await pool.query(
        'UPDATE economy SET balance = $1 WHERE player_id = $2',
        [newBalance, playerId]
      );
    }

    return { success: true, newBalance, oldBalance };
  } catch (error) {
    console.error('Error updating balance:', error);
    return { success: false, newBalance: 0, oldBalance: 0, error: error.message };
  }
}

/**
 * Record a transaction in the database
 * @param {number} playerId - Player ID
 * @param {number} amount - Transaction amount (positive for credit, negative for debit)
 * @param {string} type - Transaction type (e.g., 'admin_add', 'admin_remove', 'shop_purchase', 'blackjack')
 * @returns {Promise<boolean>} - Success status
 */
async function recordTransaction(playerId, amount, type) {
  try {
    await pool.query(
      'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
      [playerId, amount, type]
    );
    return true;
  } catch (error) {
    console.error('Error recording transaction:', error);
    return false;
  }
}

/**
 * Get player balance for a specific server
 * @param {string} guildId - Discord guild ID
 * @param {string} serverNickname - Server nickname
 * @param {string} discordId - Discord user ID
 * @returns {Promise<object|null>} - { balance: number, playerId: number } or null
 */
async function getPlayerBalance(guildId, serverNickname, discordId) {
  try {
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
  } catch (error) {
    console.error('Error getting player balance:', error);
    return null;
  }
}

/**
 * Get all servers for a guild (for autocomplete)
 * @param {string} guildId - Discord guild ID
 * @param {string} searchTerm - Search term for filtering
 * @returns {Promise<Array>} - Array of server objects with { nickname, value }
 */
async function getServersForGuild(guildId, searchTerm = '') {
  try {
    const result = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 ORDER BY nickname LIMIT 25',
      [guildId, `%${searchTerm}%`]
    );
    
    return result.rows.map(row => ({
      name: row.nickname,
      value: row.nickname
    }));
  } catch (error) {
    console.error('Error getting servers for guild:', error);
    return [];
  }
}

module.exports = {
  getServerByNickname,
  getServerById,
  getPlayerByIGN,
  getLinkedPlayer,
  updateBalance,
  recordTransaction,
  getPlayerBalance,
  getServersForGuild
}; 