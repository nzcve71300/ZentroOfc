const pool = require('../db');

/**
 * Initialize a guild's subscription when the bot joins
 * @param {string} guildId - Discord guild ID
 */
async function initializeGuildSubscription(guildId) {
  try {
    // Check if subscription already exists
    const [existing] = await pool.query(
      'SELECT guild_id FROM subscriptions WHERE guild_id = ?',
      [guildId]
    );

    if (existing.length === 0) {
      // Create new subscription with allowed_servers = 0
      await pool.query(
        'INSERT INTO subscriptions (guild_id, allowed_servers, active_servers) VALUES (?, 0, 0)',
        [guildId]
      );
      console.log(`✅ Initialized subscription for guild: ${guildId}`);
    }
  } catch (error) {
    console.error('Error initializing guild subscription:', error);
  }
}

/**
 * Check if a guild has an active subscription
 * @param {string} guildId - Discord guild ID
 * @returns {boolean} - True if subscription is active
 */
async function isSubscriptionActive(guildId) {
  try {
    const [result] = await pool.query(
      'SELECT allowed_servers FROM subscriptions WHERE guild_id = ?',
      [guildId]
    );

    if (result.length === 0) {
      // Guild doesn't exist in subscriptions, initialize it
      await initializeGuildSubscription(guildId);
      return false;
    }

    return result[0].allowed_servers > 0;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
}

/**
 * Get subscription info for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {Object|null} - Subscription info or null if not found
 */
async function getSubscriptionInfo(guildId) {
  try {
    const [result] = await pool.query(
      'SELECT allowed_servers, active_servers FROM subscriptions WHERE guild_id = ?',
      [guildId]
    );

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error getting subscription info:', error);
    return null;
  }
}

/**
 * Check if guild can add more servers
 * @param {string} guildId - Discord guild ID
 * @returns {Object} - {canAdd: boolean, allowed: number, active: number}
 */
async function canAddServer(guildId) {
  try {
    const subscription = await getSubscriptionInfo(guildId);
    
    if (!subscription) {
      await initializeGuildSubscription(guildId);
      return { canAdd: false, allowed: 0, active: 0 };
    }

    const { allowed_servers, active_servers } = subscription;
    return {
      canAdd: active_servers < allowed_servers,
      allowed: allowed_servers,
      active: active_servers
    };
  } catch (error) {
    console.error('Error checking if can add server:', error);
    return { canAdd: false, allowed: 0, active: 0 };
  }
}

/**
 * Increment active servers count for a guild
 * @param {string} guildId - Discord guild ID
 */
async function incrementActiveServers(guildId) {
  try {
    await pool.query(
      'UPDATE subscriptions SET active_servers = active_servers + 1 WHERE guild_id = ?',
      [guildId]
    );
  } catch (error) {
    console.error('Error incrementing active servers:', error);
  }
}

/**
 * Decrement active servers count for a guild
 * @param {string} guildId - Discord guild ID
 */
async function decrementActiveServers(guildId) {
  try {
    await pool.query(
      'UPDATE subscriptions SET active_servers = GREATEST(active_servers - 1, 0) WHERE guild_id = ?',
      [guildId]
    );
  } catch (error) {
    console.error('Error decrementing active servers:', error);
  }
}

/**
 * Update subscription for a guild (owner only)
 * @param {string} guildId - Discord guild ID
 * @param {number} allowedServers - Number of allowed servers
 */
async function updateSubscription(guildId, allowedServers) {
  try {
    // Get current subscription info
    const current = await getSubscriptionInfo(guildId);
    
    if (!current) {
      // Create new subscription
      await pool.query(
        'INSERT INTO subscriptions (guild_id, allowed_servers, active_servers) VALUES (?, ?, 0)',
        [guildId, allowedServers]
      );
    } else {
      // Update existing subscription
      await pool.query(
        'UPDATE subscriptions SET allowed_servers = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?',
        [allowedServers, guildId]
      );

      // If downgrading, deactivate extra servers
      if (allowedServers < current.active_servers) {
        const extraServers = current.active_servers - allowedServers;
        
        // Deactivate the most recently added servers
        await pool.query(
          `UPDATE servers SET is_active = 0 
           WHERE guild_id = ? AND is_active = 1 
           ORDER BY id DESC 
           LIMIT ?`,
          [guildId, extraServers]
        );

        // Update active count
        await pool.query(
          'UPDATE subscriptions SET active_servers = ? WHERE guild_id = ?',
          [allowedServers, guildId]
        );
      }
    }

    console.log(`✅ Updated subscription for guild ${guildId}: ${allowedServers} servers allowed`);
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

/**
 * Get all active servers for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {Array} - Array of active servers
 */
async function getActiveServers(guildId) {
  try {
    const [result] = await pool.query(
      'SELECT id, nickname, ip, port FROM servers WHERE guild_id = ? AND is_active = 1 ORDER BY nickname',
      [guildId]
    );
    return result;
  } catch (error) {
    console.error('Error getting active servers:', error);
    return [];
  }
}

module.exports = {
  initializeGuildSubscription,
  isSubscriptionActive,
  getSubscriptionInfo,
  canAddServer,
  incrementActiveServers,
  decrementActiveServers,
  updateSubscription,
  getActiveServers
}; 