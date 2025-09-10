const express = require('express');
const router = express.Router();
const pool = require('../../db/index');
const EncryptionService = require('../services/encryption');
const AuditService = require('../services/audit');

const encryption = new EncryptionService();
const audit = new AuditService();

// Normalize server key (trim + lowercase)
function normalizeServerKey(key) {
  return key.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
}

// GET /api/servers - List all servers
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id; // Handle case where user might not be authenticated

    const [servers] = await pool.query(`
      SELECT 
        id, guild_id, name as display_name, ip as web_rcon_host, port as web_rcon_port,
        password, created_at, updated_at
      FROM servers 
      ORDER BY created_at DESC
    `);

    // Add ownership info for each server and map to expected format
    const serversWithOwnership = servers.map(server => ({
      id: server.id.toString(),
      name: server.display_name,
      ip: '***.***.***.***', // Hide IP address
      rconPort: 0, // Hide port
      hasActiveSub: true, // Default to true for now
      connectionStatus: 'connected', // Default to connected
      canManage: false // No created_by column, so no one can manage for now
    }));

    res.json(serversWithOwnership);
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// GET /api/servers/:id - Get specific server with features
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // Handle case where user might not be authenticated

    // Get server details
    const [servers] = await pool.query(`
      SELECT 
        id, guild_id, name as display_name, ip as web_rcon_host, port as web_rcon_port,
        password, created_at, updated_at
      FROM servers 
      WHERE id = ?
    `, [id]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = servers[0];

    // Get server features from rust_servers table
    const [rustServers] = await pool.query(`
      SELECT 
        nickname, currency_name, ip, port, password, rcon_password, rcon_port
      FROM rust_servers 
      WHERE guild_id = ?
    `, [server.guild_id]);

    const rustServer = rustServers[0] || {};

    // Get store categories for this server
    const [categories] = await pool.query(`
      SELECT id, name, type
      FROM shop_categories 
      WHERE server_id = ?
    `, [id]);

    // Get player count (mock for now - you can implement real player count later)
    const playerCount = Math.floor(Math.random() * 50) + 10; // Random between 10-60

    // Build server details with features
    const serverDetails = {
      id: server.id.toString(),
      name: server.display_name,
      ip: '***.***.***.***', // Hide IP
      rconPort: 0, // Hide port
      hasActiveSub: true,
      connectionStatus: 'connected',
      canManage: false, // No created_by column
      
      // Server features
      features: {
        store: {
          enabled: true,
          categories: categories.length,
          currency: rustServer.currency_name || 'coins'
        },
        gamble: {
          enabled: true,
          description: 'Test your luck with various gambling games'
        },
        leaderboard: {
          enabled: true,
          description: 'View top players and statistics'
        },
        teleport: {
          enabled: true,
          description: 'Teleport to different locations'
        },
        economy: {
          enabled: true,
          description: 'Manage your in-game currency'
        }
      },
      
      // Server stats
      stats: {
        players: playerCount,
        maxPlayers: 100,
        uptime: '99.9%',
        lastWipe: '2 days ago'
      }
    };

    res.json(serverDetails);
  } catch (error) {
    console.error('Error fetching server:', error);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// POST /api/servers - Create/Update server (idempotent upsert)
router.post('/', async (req, res) => {
  try {
    const {
      guildId,
      serverKey,
      displayName,
      region,
      webRconHost,
      webRconPort,
      rconPassword
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!guildId || !serverKey || !displayName || !webRconHost || !webRconPort || !rconPassword) {
      return res.status(400).json({ 
        error: 'Missing required fields: guildId, serverKey, displayName, webRconHost, webRconPort, rconPassword' 
      });
    }

    const normalizedKey = normalizeServerKey(serverKey);
    const secretRef = encryption.generateSecretRef();
    const encryptedPassword = encryption.encrypt(rconPassword);

    // Check if server already exists
    const [existing] = await pool.query(`
      SELECT id FROM servers 
      WHERE guild_id = ? AND server_key = ?
    `, [guildId, normalizedKey]);

    let serverId;
    let isUpdate = false;

    if (existing.length > 0) {
      // Update existing server
      serverId = existing[0].id;
      isUpdate = true;

      await pool.query(`
        UPDATE servers SET
          display_name = ?, region = ?, web_rcon_host = ?,
          web_rcon_port = ?, secret_ref = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [displayName, region, webRconHost, webRconPort, secretRef, serverId]);

      // Update encrypted password in secrets table
      await pool.query(`
        INSERT INTO server_secrets (server_id, secret_ref, encrypted_password, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          encrypted_password = VALUES(encrypted_password),
          updated_at = CURRENT_TIMESTAMP
      `, [serverId, secretRef, encryptedPassword]);

      await audit.logEvent({
        userId,
        guildId,
        action: 'UPDATE',
        resourceType: 'SERVER',
        resourceId: serverId,
        newValues: { displayName, region, webRconHost, webRconPort },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } else {
      // Create new server
      const [result] = await pool.query(`
        INSERT INTO servers (
          guild_id, server_key, display_name, region,
          web_rcon_host, web_rcon_port, secret_ref, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [guildId, normalizedKey, displayName, region, webRconHost, webRconPort, secretRef, userId]);

      serverId = result.insertId;

      // Store encrypted password
      await pool.query(`
        INSERT INTO server_secrets (server_id, secret_ref, encrypted_password, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [serverId, secretRef, encryptedPassword]);

      await audit.logEvent({
        userId,
        guildId,
        action: 'CREATE',
        resourceType: 'SERVER',
        resourceId: serverId,
        newValues: { serverKey: normalizedKey, displayName, region, webRconHost, webRconPort },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    // Get the created/updated server
    const [servers] = await pool.query(`
      SELECT 
        id, guild_id, server_key, display_name, region,
        web_rcon_host, web_rcon_port, secret_ref,
        created_by, created_at, updated_at
      FROM servers 
      WHERE id = ?
    `, [serverId]);

    res.status(isUpdate ? 200 : 201).json({ 
      server: servers[0],
      message: isUpdate ? 'Server updated successfully' : 'Server created successfully'
    });

    // Emit real-time event
    req.app.emitToGuild(guildId, isUpdate ? 'server.updated' : 'server.created', {
      server: servers[0]
    });

  } catch (error) {
    console.error('Error creating/updating server:', error);
    res.status(500).json({ error: 'Failed to create/update server' });
  }
});

// PUT /api/servers/:id - Update server details
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      displayName,
      region,
      webRconHost,
      webRconPort,
      rconPassword
    } = req.body;

    const userId = req.user.id;

    // Get existing server
    const [existing] = await pool.query(`
      SELECT * FROM servers WHERE id = ? AND created_by = ?
    `, [id, userId]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const oldValues = { ...existing[0] };

    // Update server
    const updateFields = [];
    const updateValues = [];

    if (displayName !== undefined) {
      updateFields.push('display_name = ?');
      updateValues.push(displayName);
    }
    if (region !== undefined) {
      updateFields.push('region = ?');
      updateValues.push(region);
    }
    if (webRconHost !== undefined) {
      updateFields.push('web_rcon_host = ?');
      updateValues.push(webRconHost);
    }
    if (webRconPort !== undefined) {
      updateFields.push('web_rcon_port = ?');
      updateValues.push(webRconPort);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);

      await pool.query(`
        UPDATE servers SET ${updateFields.join(', ')}
        WHERE id = ?
      `, updateValues);
    }

    // Update password if provided
    if (rconPassword) {
      const secretRef = encryption.generateSecretRef();
      const encryptedPassword = encryption.encrypt(rconPassword);

      await pool.query(`
        UPDATE servers SET secret_ref = ? WHERE id = ?
      `, [secretRef, id]);

      await pool.query(`
        INSERT INTO server_secrets (server_id, secret_ref, encrypted_password, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          encrypted_password = VALUES(encrypted_password),
          updated_at = CURRENT_TIMESTAMP
      `, [id, secretRef, encryptedPassword]);
    }

    // Get updated server
    const [servers] = await pool.query(`
      SELECT 
        id, guild_id, server_key, display_name, region,
        web_rcon_host, web_rcon_port, secret_ref,
        created_by, created_at, updated_at
      FROM servers 
      WHERE id = ?
    `, [id]);

    await audit.logEvent({
      userId,
      guildId: existing[0].guild_id,
      action: 'UPDATE',
      resourceType: 'SERVER',
      resourceId: id,
      oldValues,
      newValues: servers[0],
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ 
      server: servers[0],
      message: 'Server updated successfully'
    });

    // Emit real-time event
    req.app.emitToGuild(existing[0].guild_id, 'server.updated', {
      server: servers[0]
    });

  } catch (error) {
    console.error('Error updating server:', error);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

// DELETE /api/servers/:id - Delete server
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get server details before deletion
    const [servers] = await pool.query(`
      SELECT * FROM servers WHERE id = ? AND created_by = ?
    `, [id, userId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = servers[0];

    // Delete server (cascade will handle related records)
    await pool.query('DELETE FROM servers WHERE id = ?', [id]);

    await audit.logEvent({
      userId,
      guildId: server.guild_id,
      action: 'DELETE',
      resourceType: 'SERVER',
      resourceId: id,
      oldValues: server,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ message: 'Server deleted successfully' });

    // Emit real-time event
    req.app.emitToGuild(server.guild_id, 'server.deleted', {
      serverId: id
    });

  } catch (error) {
    console.error('Error deleting server:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

module.exports = router;
