const pool = require('../../db/index');

class AuditService {
  constructor() {
    this.ensureAuditTable();
  }

  async ensureAuditTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(32) NULL,
          guild_id VARCHAR(32) NULL,
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50) NOT NULL,
          resource_id VARCHAR(32) NULL,
          old_values JSON NULL,
          new_values JSON NULL,
          ip_address VARCHAR(45) NULL,
          user_agent TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          INDEX idx_user_id (user_id),
          INDEX idx_guild_id (guild_id),
          INDEX idx_action (action),
          INDEX idx_resource (resource_type, resource_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (error) {
      console.error('Failed to create audit_logs table:', error);
    }
  }

  /**
   * Log an audit event
   * @param {object} params - Audit parameters
   */
  async logEvent({
    userId = null,
    guildId = null,
    action,
    resourceType,
    resourceId = null,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      await pool.query(`
        INSERT INTO audit_logs (
          user_id, guild_id, action, resource_type, resource_id,
          old_values, new_values, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        guildId,
        action,
        resourceType,
        resourceId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]);
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Log an error event
   * @param {object} req - Express request object
   * @param {Error} error - Error object
   */
  async logError(req, error) {
    await this.logEvent({
      userId: req.user?.id || null,
      guildId: req.user?.guildId || null,
      action: 'ERROR',
      resourceType: 'SYSTEM',
      resourceId: null,
      newValues: {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * Get audit logs for a specific resource
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - ID of the resource
   * @param {number} limit - Number of logs to return
   * @returns {Array} - Audit logs
   */
  async getResourceLogs(resourceType, resourceId, limit = 50) {
    try {
      const [rows] = await pool.query(`
        SELECT * FROM audit_logs 
        WHERE resource_type = ? AND resource_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `, [resourceType, resourceId, limit]);

      return rows.map(row => ({
        ...row,
        old_values: row.old_values ? JSON.parse(row.old_values) : null,
        new_values: row.new_values ? JSON.parse(row.new_values) : null
      }));
    } catch (error) {
      console.error('Failed to get resource logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for a guild
   * @param {string} guildId - Guild ID
   * @param {number} limit - Number of logs to return
   * @returns {Array} - Audit logs
   */
  async getGuildLogs(guildId, limit = 100) {
    try {
      const [rows] = await pool.query(`
        SELECT * FROM audit_logs 
        WHERE guild_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `, [guildId, limit]);

      return rows.map(row => ({
        ...row,
        old_values: row.old_values ? JSON.parse(row.old_values) : null,
        new_values: row.new_values ? JSON.parse(row.new_values) : null
      }));
    } catch (error) {
      console.error('Failed to get guild logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of logs to return
   * @returns {Array} - Audit logs
   */
  async getUserLogs(userId, limit = 100) {
    try {
      const [rows] = await pool.query(`
        SELECT * FROM audit_logs 
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `, [userId, limit]);

      return rows.map(row => ({
        ...row,
        old_values: row.old_values ? JSON.parse(row.old_values) : null,
        new_values: row.new_values ? JSON.parse(row.new_values) : null
      }));
    } catch (error) {
      console.error('Failed to get user logs:', error);
      return [];
    }
  }

  /**
   * Clean up old audit logs (older than specified days)
   * @param {number} days - Number of days to keep
   */
  async cleanupOldLogs(days = 90) {
    try {
      const [result] = await pool.query(`
        DELETE FROM audit_logs 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [days]);

      console.log(`Cleaned up ${result.affectedRows} old audit logs`);
      return result.affectedRows;
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
      return 0;
    }
  }
}

module.exports = AuditService;
