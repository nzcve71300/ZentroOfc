const express = require('express');
const router = express.Router();
const AuditService = require('../services/audit');

const audit = new AuditService();

// GET /api/audit/logs - Get audit logs
router.get('/logs', async (req, res) => {
  try {
    const { 
      guildId, 
      userId, 
      resourceType, 
      resourceId, 
      action,
      limit = 100, 
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        id, user_id, guild_id, action, resource_type, resource_id,
        old_values, new_values, ip_address, user_agent, created_at
      FROM audit_logs
      WHERE 1=1
    `;
    
    const params = [];

    if (guildId) {
      query += ' AND guild_id = ?';
      params.push(guildId);
    }

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (resourceType) {
      query += ' AND resource_type = ?';
      params.push(resourceType);
    }

    if (resourceId) {
      query += ' AND resource_id = ?';
      params.push(resourceId);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.query(query, params);

    // Parse JSON fields
    const parsedLogs = logs.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null
    }));

    res.json({ logs: parsedLogs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /api/audit/logs/resource/:type/:id - Get audit logs for specific resource
router.get('/logs/resource/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { limit = 50 } = req.query;

    const logs = await audit.getResourceLogs(type, id, parseInt(limit));

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching resource logs:', error);
    res.status(500).json({ error: 'Failed to fetch resource logs' });
  }
});

// GET /api/audit/logs/guild/:guildId - Get audit logs for guild
router.get('/logs/guild/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { limit = 100 } = req.query;

    const logs = await audit.getGuildLogs(guildId, parseInt(limit));

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching guild logs:', error);
    res.status(500).json({ error: 'Failed to fetch guild logs' });
  }
});

// GET /api/audit/logs/user/:userId - Get audit logs for user
router.get('/logs/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100 } = req.query;

    const logs = await audit.getUserLogs(userId, parseInt(limit));

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching user logs:', error);
    res.status(500).json({ error: 'Failed to fetch user logs' });
  }
});

// POST /api/audit/cleanup - Clean up old audit logs (admin only)
router.post('/cleanup', async (req, res) => {
  try {
    const { days = 90 } = req.body;

    if (days < 30) {
      return res.status(400).json({ error: 'Cannot delete logs newer than 30 days' });
    }

    const deletedCount = await audit.cleanupOldLogs(days);

    res.json({ 
      message: `Cleaned up ${deletedCount} old audit logs`,
      deleted_count: deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    res.status(500).json({ error: 'Failed to cleanup audit logs' });
  }
});

module.exports = router;
