const express = require('express');
const router = express.Router();
const pool = require('../../db/index');
const AuditService = require('../services/audit');
const RconService = require('../services/rcon');

const audit = new AuditService();
const rcon = new RconService();

// GET /api/players - List players for a server or guild
router.get('/', async (req, res) => {
  try {
    const { serverId, guildId, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT 
        p.id, p.steam_id, p.ign, p.discord_id, p.server_id,
        p.first_seen_at, p.last_seen_at,
        ps.kills, ps.deaths, ps.playtime_minutes, ps.last_activity_at,
        pb.balance, pb.total_earned, pb.total_spent,
        au.display_name as app_display_name, au.email as app_email
      FROM players p
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      LEFT JOIN app_users au ON p.app_user_id = au.id
      WHERE 1=1
    `;
    
    const params = [];

    if (serverId) {
      query += ' AND ps.server_id = ?';
      params.push(serverId);
    } else if (guildId) {
      query += ' AND p.server_id IN (SELECT id FROM servers WHERE guild_id = ?)';
      params.push(guildId);
    }

    query += ' ORDER BY p.last_seen_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [players] = await pool.query(query, params);

    res.json({ players });
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// GET /api/players/:id - Get specific player
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [players] = await pool.query(`
      SELECT 
        p.id, p.steam_id, p.ign, p.discord_id, p.server_id,
        p.first_seen_at, p.last_seen_at,
        ps.kills, ps.deaths, ps.playtime_minutes, ps.last_activity_at,
        pb.balance, pb.total_earned, pb.total_spent,
        au.display_name as app_display_name, au.email as app_email
      FROM players p
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      LEFT JOIN player_balances pb ON p.id = pb.player_id
      LEFT JOIN app_users au ON p.app_user_id = au.id
      WHERE p.id = ?
    `, [id]);

    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ player: players[0] });
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// POST /api/players - Create or update player
router.post('/', async (req, res) => {
  try {
    const {
      steamId,
      ign,
      discordId,
      serverId
    } = req.body;

    const userId = req.user.id;

    if (!ign || !serverId) {
      return res.status(400).json({ error: 'IGN and serverId are required' });
    }

    // Check if player already exists
    const [existingPlayers] = await pool.query(`
      SELECT id FROM players 
      WHERE (steam_id = ? OR (ign = ? AND server_id = ?))
    `, [steamId, ign, serverId]);

    let playerId;
    let isUpdate = false;

    if (existingPlayers.length > 0) {
      // Update existing player
      playerId = existingPlayers[0].id;
      isUpdate = true;

      await pool.query(`
        UPDATE players SET
          steam_id = COALESCE(?, steam_id),
          ign = ?,
          discord_id = COALESCE(?, discord_id),
          last_seen_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [steamId, ign, discordId, playerId]);

      await audit.logEvent({
        userId,
        action: 'UPDATE',
        resourceType: 'PLAYER',
        resourceId: playerId,
        newValues: { steamId, ign, discordId, serverId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } else {
      // Create new player
      const [result] = await pool.query(`
        INSERT INTO players (steam_id, ign, discord_id, server_id, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [steamId, ign, discordId, serverId]);

      playerId = result.insertId;

      await audit.logEvent({
        userId,
        action: 'CREATE',
        resourceType: 'PLAYER',
        resourceId: playerId,
        newValues: { steamId, ign, discordId, serverId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    // Get the created/updated player
    const [players] = await pool.query(`
      SELECT 
        p.id, p.steam_id, p.ign, p.discord_id, p.server_id,
        p.first_seen_at, p.last_seen_at
      FROM players p
      WHERE p.id = ?
    `, [playerId]);

    res.status(isUpdate ? 200 : 201).json({
      player: players[0],
      message: isUpdate ? 'Player updated successfully' : 'Player created successfully'
    });

  } catch (error) {
    console.error('Error creating/updating player:', error);
    res.status(500).json({ error: 'Failed to create/update player' });
  }
});

// POST /api/players/:id/link-app-user - Link player to app user
router.post('/:id/link-app-user', async (req, res) => {
  try {
    const { id } = req.params;
    const { appUserId } = req.body;
    const userId = req.user.id;

    if (!appUserId) {
      return res.status(400).json({ error: 'appUserId is required' });
    }

    // Verify app user exists
    const [appUsers] = await pool.query(
      'SELECT id FROM app_users WHERE id = ?',
      [appUserId]
    );

    if (appUsers.length === 0) {
      return res.status(404).json({ error: 'App user not found' });
    }

    // Update player with app user link
    await pool.query(
      'UPDATE players SET app_user_id = ? WHERE id = ?',
      [appUserId, id]
    );

    await audit.logEvent({
      userId,
      action: 'LINK_APP_USER',
      resourceType: 'PLAYER',
      resourceId: id,
      newValues: { appUserId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ message: 'Player linked to app user successfully' });

  } catch (error) {
    console.error('Error linking player to app user:', error);
    res.status(500).json({ error: 'Failed to link player to app user' });
  }
});

// POST /api/players/:id/execute-command - Execute RCON command for player
router.post('/:id/execute-command', async (req, res) => {
  try {
    const { id } = req.params;
    const { command, serverId } = req.body;
    const userId = req.user.id;

    if (!command || !serverId) {
      return res.status(400).json({ error: 'Command and serverId are required' });
    }

    // Get player info
    const [players] = await pool.query(
      'SELECT ign FROM players WHERE id = ?',
      [id]
    );

    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = players[0];

    // Get server info
    const [servers] = await pool.query(`
      SELECT s.*, ss.encrypted_password
      FROM servers s
      JOIN server_secrets ss ON s.secret_ref = ss.secret_ref
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = servers[0];

    // Replace {player} placeholder in command with actual player IGN
    const finalCommand = command.replace(/{player}/g, player.ign);

    // Execute RCON command
    const result = await rcon.sendCommand(serverId, finalCommand);

    // Log the command execution
    await pool.query(`
      INSERT INTO server_events (server_id, player_id, event_type, event_data)
      VALUES (?, ?, 'server_command', ?)
    `, [serverId, id, JSON.stringify({
      command: finalCommand,
      executed_by: userId,
      result: result
    })]);

    await audit.logEvent({
      userId,
      action: 'EXECUTE_COMMAND',
      resourceType: 'PLAYER',
      resourceId: id,
      newValues: { command: finalCommand, serverId, result },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      command: finalCommand,
      result: result,
      message: 'Command executed successfully'
    });

  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

// GET /api/players/:id/stats - Get player statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { serverId } = req.query;

    let query = `
      SELECT 
        ps.server_id, s.display_name as server_name,
        ps.kills, ps.deaths, ps.playtime_minutes, ps.last_activity_at,
        CASE 
          WHEN ps.deaths > 0 THEN ROUND(ps.kills / ps.deaths, 2)
          ELSE ps.kills
        END as kd_ratio
      FROM player_stats ps
      JOIN servers s ON ps.server_id = s.id
      WHERE ps.player_id = ?
    `;
    
    const params = [id];

    if (serverId) {
      query += ' AND ps.server_id = ?';
      params.push(serverId);
    }

    query += ' ORDER BY ps.last_activity_at DESC';

    const [stats] = await pool.query(query, params);

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// GET /api/players/:id/balance - Get player balance
router.get('/:id/balance', async (req, res) => {
  try {
    const { id } = req.params;
    const { serverId } = req.query;

    let query = `
      SELECT 
        pb.server_id, s.display_name as server_name,
        pb.balance, pb.total_earned, pb.total_spent, pb.last_transaction_at
      FROM player_balances pb
      JOIN servers s ON pb.server_id = s.id
      WHERE pb.player_id = ?
    `;
    
    const params = [id];

    if (serverId) {
      query += ' AND pb.server_id = ?';
      params.push(serverId);
    }

    query += ' ORDER BY pb.last_transaction_at DESC';

    const [balances] = await pool.query(query, params);

    res.json({ balances });
  } catch (error) {
    console.error('Error fetching player balance:', error);
    res.status(500).json({ error: 'Failed to fetch player balance' });
  }
});

module.exports = router;
