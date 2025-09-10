const express = require('express');
const router = express.Router();
const pool = require('../../db/index');
const AuditService = require('../services/audit');
const RconService = require('../services/rcon');

const audit = new AuditService();
const rcon = new RconService();

// GET /api/servers/:serverId/store/categories - Get store categories for a server
router.get('/servers/:serverId/store/categories', async (req, res) => {
  try {
    const { serverId } = req.params;
    const userId = req.user?.id; // Handle case where user might not be authenticated

    // Verify server exists and user has access
    const [servers] = await pool.query(`
      SELECT s.*, rs.nickname 
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Get shop categories from the existing bot database
    // First, get the bot's server key for this guild
    const [serverKeys] = await pool.query(`
      SELECT DISTINCT sc.server_id
      FROM shop_categories sc
      JOIN servers s ON s.guild_id = ?
      WHERE s.id = ?
    `, [servers[0].guild_id, serverId]);

    if (serverKeys.length === 0) {
      return res.json([]); // No categories found for this server
    }

    const botServerKey = serverKeys[0].server_id;

    const [categories] = await pool.query(`
      SELECT sc.id, sc.name, sc.type, sc.role
      FROM shop_categories sc
      WHERE sc.server_id = ?
      ORDER BY sc.name
    `, [botServerKey]);

    res.json(categories);
  } catch (error) {
    console.error('Error fetching store categories:', error);
    res.status(500).json({ error: 'Failed to fetch store categories' });
  }
});

// GET /api/servers/:serverId/store/categories/:categoryId/items - Get items in a category
router.get('/servers/:serverId/store/categories/:categoryId/items', async (req, res) => {
  try {
    const { serverId, categoryId } = req.params;
    const userId = req.user?.id; // Handle case where user might not be authenticated

    // Verify server exists and user has access
    const [servers] = await pool.query(`
      SELECT s.*, rs.nickname 
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Get items from the existing bot database
    // First, get the bot's server key for this guild
    const [serverKeys] = await pool.query(`
      SELECT DISTINCT sc.server_id
      FROM shop_categories sc
      JOIN servers s ON s.guild_id = ?
      WHERE s.id = ?
    `, [servers[0].guild_id, serverId]);

    if (serverKeys.length === 0) {
      return res.json([]); // No items found for this server
    }

    const botServerKey = serverKeys[0].server_id;

    const [items] = await pool.query(`
      SELECT 
        si.id, si.name, si.short_name as shortName, si.price, si.icon_url as iconUrl,
        si.category_id as categoryId, si.description, si.command, si.cooldown_minutes
      FROM shop_items si
      WHERE si.category_id = ? AND si.server_id = ?
      ORDER BY si.name
    `, [categoryId, botServerKey]);

    res.json(items);
  } catch (error) {
    console.error('Error fetching store items:', error);
    res.status(500).json({ error: 'Failed to fetch store items' });
  }
});

// POST /api/servers/:serverId/store/purchase - Purchase an item
router.post('/servers/:serverId/store/purchase', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { itemId, quantity = 1 } = req.body;
    const userId = req.user?.id; // Handle case where user might not be authenticated

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    // Get server info
    const [servers] = await pool.query(`
      SELECT s.*, rs.nickname, rs.ip, rs.port, rs.password
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = servers[0];

    // Get item details
    const [items] = await pool.query(`
      SELECT si.*, sc.name as category_name
      FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      WHERE si.id = ? AND si.server_id = ?
    `, [itemId, serverId]);

    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = items[0];
    const totalCost = item.price * quantity;

    // Get player info (temporarily simplified without app_users join)
    const [players] = await pool.query(`
      SELECT p.*
      FROM players p
      WHERE p.server_id = ?
      LIMIT 1
    `, [serverId]);

    if (players.length === 0) {
      return res.status(404).json({ 
        error: 'Player not found. Make sure your Discord account is linked to your in-game character.' 
      });
    }

    const player = players[0];
    const playerIgn = player.ign;

    // Get player balance
    const [balances] = await pool.query(`
      SELECT balance FROM player_balances 
      WHERE player_id = ? AND server_id = ?
    `, [player.id, serverId]);

    const currentBalance = balances.length > 0 ? balances[0].balance : 0;

    if (currentBalance < totalCost) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        currentBalance,
        requiredAmount: totalCost,
        shortfall: totalCost - currentBalance
      });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Deduct balance
      await connection.query(`
        INSERT INTO player_balances (player_id, server_id, balance, total_spent, last_transaction_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          balance = balance - ?,
          total_spent = total_spent + ?,
          last_transaction_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [player.id, serverId, currentBalance - totalCost, totalCost, totalCost, totalCost]);

      // Execute RCON command to deliver item
      let command = item.command;
      
      // Replace placeholders in command
      command = command.replace(/{player}/g, playerIgn);
      command = command.replace(/{quantity}/g, quantity);
      command = command.replace(/{item}/g, item.short_name);

      // Execute the command
      const rconResult = await rcon.sendCommand(serverId, command);

      // Log the purchase
      await connection.query(`
        INSERT INTO server_events (server_id, player_id, event_type, event_data)
        VALUES (?, ?, 'economy_transaction', ?)
      `, [serverId, player.id, JSON.stringify({
        type: 'purchase',
        item_id: itemId,
        item_name: item.name,
        quantity: quantity,
        total_cost: totalCost,
        command: command,
        rcon_result: rconResult,
        executed_by: userId
      })]);

      await connection.commit();

      // Log audit event
      await audit.logEvent({
        userId,
        action: 'PURCHASE_ITEM',
        resourceType: 'STORE',
        resourceId: itemId,
        newValues: {
          item_name: item.name,
          quantity: quantity,
          total_cost: totalCost,
          player_ign: playerIgn,
          command: command
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: `Successfully purchased ${quantity}x ${item.name} for ${totalCost} coins!`,
        item: {
          name: item.name,
          quantity: quantity,
          totalCost: totalCost
        },
        balance: {
          before: currentBalance,
          after: currentBalance - totalCost
        }
      });

      // Emit real-time event
      req.app.emitToGuild(server.guild_id, 'store.purchase', {
        playerId: player.id,
        itemName: item.name,
        quantity: quantity,
        totalCost: totalCost
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(500).json({ error: 'Failed to purchase item' });
  }
});

// GET /api/servers/:serverId/store/balance - Get player balance for store
router.get('/servers/:serverId/store/balance', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { ign } = req.query; // Get IGN from query parameter

    if (!ign) {
      return res.status(400).json({ error: 'IGN (In-Game Name) is required' });
    }

    // Get the bot's server key for this guild
    const [servers] = await pool.query(`
      SELECT s.*, rs.nickname 
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Get the bot's server key
    const [serverKeys] = await pool.query(`
      SELECT DISTINCT sc.server_id
      FROM shop_categories sc
      JOIN servers s ON s.guild_id = ?
      WHERE s.id = ?
    `, [servers[0].guild_id, serverId]);

    if (serverKeys.length === 0) {
      return res.status(404).json({ error: 'Server not found in bot database' });
    }

    const botServerKey = serverKeys[0].server_id;

    // Get player info by IGN and server key
    const [players] = await pool.query(`
      SELECT p.*
      FROM players p
      WHERE p.ign = ? AND p.server_id = ?
      LIMIT 1
    `, [ign, botServerKey]);

    if (players.length === 0) {
      return res.status(404).json({ 
        error: 'Player not found. Make sure your Discord account is linked to your in-game character.' 
      });
    }

    const player = players[0];

    // Get balance
    const [balances] = await pool.query(`
      SELECT balance FROM player_balances 
      WHERE player_id = ? AND server_id = ?
    `, [player.id, botServerKey]);

    const balance = balances.length > 0 ? balances[0].balance : 0;

    // Get currency name
    const [servers] = await pool.query(`
      SELECT rs.currency_name
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    const currencyName = servers.length > 0 ? servers[0].currency_name : 'coins';

    res.json({
      balance: balance,
      currency: currencyName,
      player: {
        id: player.id,
        ign: player.ign
      }
    });

  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// POST /api/servers/:serverId/store/categories - Create new category (admin only)
router.post('/servers/:serverId/store/categories', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, type, role } = req.body;
    const userId = req.user?.id; // Handle case where user might not be authenticated

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Verify server exists and user has access
    const [servers] = await pool.query(`
      SELECT s.* FROM servers s
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Create category
    const [result] = await pool.query(`
      INSERT INTO shop_categories (server_id, name, type, role)
      VALUES (?, ?, ?, ?)
    `, [serverId, name, type, role || null]);

    const categoryId = result.insertId;

    // Get created category
    const [categories] = await pool.query(`
      SELECT id, name, type, role
      FROM shop_categories
      WHERE id = ?
    `, [categoryId]);

    await audit.logEvent({
      userId,
      action: 'CREATE_CATEGORY',
      resourceType: 'STORE',
      resourceId: categoryId,
      newValues: { name, type, role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      category: categories[0],
      message: 'Category created successfully'
    });

  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// POST /api/servers/:serverId/store/items - Create new item (admin only)
router.post('/servers/:serverId/store/items', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { categoryId, name, shortName, price, description, command, iconUrl } = req.body;
    const userId = req.user?.id; // Handle case where user might not be authenticated

    if (!categoryId || !name || !shortName || !price || !command) {
      return res.status(400).json({ 
        error: 'Category ID, name, short name, price, and command are required' 
      });
    }

    // Verify server exists and user has access
    const [servers] = await pool.query(`
      SELECT s.* FROM servers s
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Create item
    const [result] = await pool.query(`
      INSERT INTO shop_items (server_id, category_id, name, short_name, price, description, command, icon_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [serverId, categoryId, name, shortName, price, description || null, command, iconUrl || null]);

    const itemId = result.insertId;

    // Get created item
    const [items] = await pool.query(`
      SELECT id, name, short_name as shortName, price, description, command, icon_url as iconUrl
      FROM shop_items
      WHERE id = ?
    `, [itemId]);

    await audit.logEvent({
      userId,
      action: 'CREATE_ITEM',
      resourceType: 'STORE',
      resourceId: itemId,
      newValues: { name, shortName, price, command },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      item: items[0],
      message: 'Item created successfully'
    });

  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

module.exports = router;
