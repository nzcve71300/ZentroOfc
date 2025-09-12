/**
 * Combat Tracker Utility
 * 
 * This utility tracks player kills and manages combat lock timers
 * to prevent players from teleporting after getting kills
 */

const mysql = require('mysql2/promise');

class CombatTracker {
  constructor() {
    this.killCache = new Map(); // Cache for recent kills to avoid database spam
  }

  /**
   * Record a player kill and set combat lock timer
   * @param {string} serverId - Server ID where the kill occurred
   * @param {string} killerName - Name of the player who got the kill
   * @param {string} victimName - Name of the player who was killed
   * @param {number} combatLockMinutes - How long the combat lock should last
   */
  async recordKill(serverId, killerName, victimName, combatLockMinutes = 5) {
    try {
      console.log(`[COMBAT TRACKER] Recording kill: ${killerName} killed ${victimName} on server ${serverId}`);
      
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      const combatLockUntil = new Date();
      combatLockUntil.setMinutes(combatLockUntil.getMinutes() + combatLockMinutes);

      // Insert kill record
      await connection.execute(`
        INSERT INTO combat_tracking (server_id, killer_name, victim_name, combat_lock_until)
        VALUES (?, ?, ?, ?)
      `, [serverId, killerName, victimName, combatLockUntil]);

      await connection.end();

      // Cache the kill for quick lookup
      const cacheKey = `${serverId}_${killerName}`;
      this.killCache.set(cacheKey, combatLockUntil);

      console.log(`[COMBAT TRACKER] Combat lock set until: ${combatLockUntil.toISOString()}`);
      
    } catch (error) {
      console.error('[COMBAT TRACKER] Error recording kill:', error);
    }
  }

  /**
   * Check if a player is in combat lock
   * @param {string} serverId - Server ID
   * @param {string} playerName - Player name to check
   * @returns {Object} - { isInCombatLock: boolean, timeRemaining: number }
   */
  async checkCombatLock(serverId, playerName) {
    try {
      // Check cache first
      const cacheKey = `${serverId}_${playerName}`;
      const cachedLockUntil = this.killCache.get(cacheKey);
      
      if (cachedLockUntil && cachedLockUntil > new Date()) {
        const timeRemaining = Math.ceil((cachedLockUntil - new Date()) / (1000 * 60));
        return {
          isInCombatLock: true,
          timeRemaining: timeRemaining
        };
      }

      // Check database
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      const [rows] = await connection.execute(`
        SELECT combat_lock_until 
        FROM combat_tracking 
        WHERE server_id = ? AND killer_name = ? AND combat_lock_until > NOW()
        ORDER BY combat_lock_until DESC 
        LIMIT 1
      `, [serverId, playerName]);

      await connection.end();

      if (rows.length > 0) {
        const combatLockUntil = new Date(rows[0].combat_lock_until);
        const timeRemaining = Math.ceil((combatLockUntil - new Date()) / (1000 * 60));
        
        // Update cache
        this.killCache.set(cacheKey, combatLockUntil);
        
        return {
          isInCombatLock: true,
          timeRemaining: timeRemaining
        };
      }

      // Clear from cache if not in combat lock
      this.killCache.delete(cacheKey);
      
      return {
        isInCombatLock: false,
        timeRemaining: 0
      };

    } catch (error) {
      console.error('[COMBAT TRACKER] Error checking combat lock:', error);
      return {
        isInCombatLock: false,
        timeRemaining: 0
      };
    }
  }

  /**
   * Get combat lock configuration for a teleport
   * @param {string} serverId - Server ID
   * @param {string} teleportName - Teleport name (for teleport_configs)
   * @param {string} positionType - Position type (for position_configs)
   * @returns {Object} - { enabled: boolean, timeMinutes: number }
   */
  async getCombatLockConfig(serverId, teleportName = null, positionType = null) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      let config;

      if (teleportName) {
        // Check teleport_configs
        const [rows] = await connection.execute(`
          SELECT combat_lock_enabled, combat_lock_time_minutes 
          FROM teleport_configs 
          WHERE server_id = ? AND teleport_name = ?
        `, [serverId, teleportName]);
        
        config = rows.length > 0 ? rows[0] : { combat_lock_enabled: true, combat_lock_time_minutes: 5 };
      } else if (positionType) {
        // Check position_configs
        const [rows] = await connection.execute(`
          SELECT combat_lock_enabled, combat_lock_time_minutes 
          FROM position_configs 
          WHERE server_id = ? AND position_type = ?
        `, [serverId, positionType]);
        
        config = rows.length > 0 ? rows[0] : { combat_lock_enabled: true, combat_lock_time_minutes: 5 };
      } else {
        // Default config
        config = { combat_lock_enabled: true, combat_lock_time_minutes: 5 };
      }

      await connection.end();

      return {
        enabled: Boolean(config.combat_lock_enabled),
        timeMinutes: parseInt(config.combat_lock_time_minutes) || 5
      };

    } catch (error) {
      console.error('[COMBAT TRACKER] Error getting combat lock config:', error);
      return {
        enabled: true,
        timeMinutes: 5
      };
    }
  }

  /**
   * Clean up old combat tracking records
   */
  async cleanupOldRecords() {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      // Delete records older than 24 hours
      const [result] = await connection.execute(`
        DELETE FROM combat_tracking 
        WHERE kill_timestamp < DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      await connection.end();

      console.log(`[COMBAT TRACKER] Cleaned up ${result.affectedRows} old records`);
      
    } catch (error) {
      console.error('[COMBAT TRACKER] Error cleaning up old records:', error);
    }
  }

  /**
   * Clear cache for a specific player
   * @param {string} serverId - Server ID
   * @param {string} playerName - Player name
   */
  clearPlayerCache(serverId, playerName) {
    const cacheKey = `${serverId}_${playerName}`;
    this.killCache.delete(cacheKey);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.killCache.clear();
  }
}

module.exports = new CombatTracker();
