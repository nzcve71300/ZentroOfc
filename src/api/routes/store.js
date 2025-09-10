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

    // Verify server exists and get the corresponding rust_servers entry
    const [servers] = await pool.query(`
      SELECT s.*, rs.id as rust_server_id
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = servers[0];
    const rustServerId = server.rust_server_id;

    if (!rustServerId) {
      return res.json([]); // No rust_servers entry, so no categories
    }

    // Get shop categories for this server using rust_servers id
    const [categories] = await pool.query(`
      SELECT sc.id, sc.name, sc.type, sc.role
      FROM shop_categories sc
      WHERE sc.server_id = ?
      ORDER BY sc.name
    `, [rustServerId]);

    res.json(categories);
  } catch (error) {
    console.error('Error fetching store categories:', error);
    res.status(500).json({ error: 'Failed to fetch store categories' });
  }
});

// GET /api/servers/:serverId/store/categories/:categoryId/items - Get items/kits/vehicles in a category
router.get('/servers/:serverId/store/categories/:categoryId/items', async (req, res) => {
  try {
    const { serverId, categoryId } = req.params;
    const userId = req.user?.id; // Handle case where user might not be authenticated

    // Verify server exists and get the corresponding rust_servers entry
    const [servers] = await pool.query(`
      SELECT s.*, rs.id as rust_server_id
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = servers[0];
    const rustServerId = server.rust_server_id;

    if (!rustServerId) {
      return res.json([]); // No rust_servers entry, so no items
    }

    // Get category info to determine type
    const [categories] = await pool.query(
      'SELECT * FROM shop_categories WHERE id = ? AND server_id = ?',
      [categoryId, rustServerId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = categories[0];
    let items = [];

    // Get items based on category type
    if (category.type === 'item') {
      const [itemResults] = await pool.query(`
        SELECT 
          si.id, si.name as display_name, si.short_name, si.price, 
          si.description, si.command, si.icon_url, si.cooldown_minutes,
          si.category_id as categoryId
        FROM shop_items si
        WHERE si.category_id = ?
        ORDER BY si.name
      `, [categoryId]);
      items = itemResults;
    } else if (category.type === 'kit') {
      const [kitResults] = await pool.query(`
        SELECT 
          sk.id, sk.display_name, sk.kit_name as short_name, sk.price, 
          sk.quantity, sk.timer as cooldown_minutes,
          sk.category_id as categoryId
        FROM shop_kits sk
        WHERE sk.category_id = ?
        ORDER BY sk.display_name
      `, [categoryId]);
      items = kitResults;
    } else if (category.type === 'vehicle') {
      const [vehicleResults] = await pool.query(`
        SELECT 
          sv.id, sv.display_name, sv.short_name, sv.price, 
          sv.timer as cooldown_minutes,
          sv.category_id as categoryId
        FROM shop_vehicles sv
        WHERE sv.category_id = ?
        ORDER BY sv.display_name
      `, [categoryId]);
      items = vehicleResults;
    }

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
    const { itemId, quantity = 1, ign } = req.body;
    const userId = req.user?.id; // Handle case where user might not be authenticated

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    if (!ign) {
      return res.status(400).json({ error: 'IGN (In-Game Name) is required' });
    }

    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    // Get server info
    const [servers] = await pool.query(`
      SELECT s.*, rs.nickname, rs.ip, rs.port, rs.rcon_password
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = servers[0];

    // Get item/kit/vehicle details - need to check all three tables
    let item = null;
    let itemType = null;

    // Check shop_items first
    const [items] = await pool.query(`
      SELECT si.*, sc.name as category_name, sc.type as category_type
      FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      WHERE si.id = ? AND sc.server_id = ?
    `, [itemId, serverId]);

    if (items.length > 0) {
      item = items[0];
      itemType = 'item';
    } else {
      // Check shop_kits
      const [kits] = await pool.query(`
        SELECT sk.*, sc.name as category_name, sc.type as category_type
        FROM shop_kits sk
        JOIN shop_categories sc ON sk.category_id = sc.id
        WHERE sk.id = ? AND sc.server_id = ?
      `, [itemId, serverId]);

      if (kits.length > 0) {
        item = kits[0];
        itemType = 'kit';
      } else {
        // Check shop_vehicles
        const [vehicles] = await pool.query(`
          SELECT sv.*, sc.name as category_name, sc.type as category_type
          FROM shop_vehicles sv
          JOIN shop_categories sc ON sv.category_id = sc.id
          WHERE sv.id = ? AND sc.server_id = ?
        `, [itemId, serverId]);

        if (vehicles.length > 0) {
          item = vehicles[0];
          itemType = 'vehicle';
        }
      }
    }

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const totalCost = item.price * quantity;

    // Get the bot's server key for this guild
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

    // Get player info by IGN and server key (same as balance endpoint)
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
    const playerIgn = player.ign;

    // Get player balance from economy table
    const [balances] = await pool.query(`
      SELECT balance FROM economy 
      WHERE player_id = ? AND guild_id = ?
    `, [player.id, servers[0].guild_id]);

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
      // Deduct balance from economy table
      await connection.query(`
        UPDATE economy 
        SET balance = balance - ?
        WHERE player_id = ? AND guild_id = ?
      `, [totalCost, player.id, servers[0].guild_id]);

      // Execute RCON command to deliver item/kit/vehicle
      let command;
      let displayName;
      
      if (itemType === 'item') {
        // For items: inventory.giveto "player" "item" "quantity"
        command = `inventory.giveto "${playerIgn}" "${item.short_name}" "${quantity}"`;
        displayName = item.name;
      } else if (itemType === 'kit') {
        // For kits: kit "player" "kit_name"
        command = `kit "${playerIgn}" "${item.kit_name}"`;
        displayName = item.display_name;
      } else if (itemType === 'vehicle') {
        // For vehicles: spawn "player" "vehicle_short_name"
        command = `spawn "${playerIgn}" "${item.short_name}"`;
        displayName = item.display_name;
      }
      
      console.log(`🔧 RCON Debug - ${itemType.toUpperCase()} command: ${command}`);
      
      console.log(`🔧 RCON Debug - ${itemType.toUpperCase()} details:`, {
        display_name: displayName,
        short_name: item.short_name || item.kit_name,
        price: item.price,
        quantity: item.quantity || quantity
      });

      // Execute the command via the bot's RCON system
      const { sendRconCommand } = require('../../rcon');
      
      console.log(`🔧 RCON Debug - Server: ${servers[0].ip}:${servers[0].port}, Command: ${command}`);
      console.log(`🔧 RCON Debug - Password length: ${servers[0].rcon_password ? servers[0].rcon_password.length : 'undefined'}`);
      
      const rconResult = await sendRconCommand(servers[0].ip, servers[0].port, servers[0].rcon_password, command);
      
      console.log(`✅ RCON command sent via bot: ${command}`);
      
      // Send confirmation message to player in-game
      const confirmMessage = `say <color=#00FF00>[WEB SHOP]</color> <color=#FFD700>${ign}</color> <color=#00FF00>Successfully delivered</color> <color=#FFD700>${displayName} x${quantity}</color>`;
      await sendRconCommand(servers[0].ip, servers[0].port, servers[0].rcon_password, confirmMessage);

      // Log the purchase
      await connection.query(`
        INSERT INTO server_events (server_id, player_id, event_type, event_data)
        VALUES (?, ?, 'economy_transaction', ?)
      `, [serverId, player.id, JSON.stringify({
        type: 'purchase',
        item_id: itemId,
        item_type: itemType,
        item_name: displayName,
        quantity: quantity,
        total_cost: totalCost,
        command: command,
        rcon_result: rconResult,
        executed_by: userId
      })]);

      await connection.commit();

      // Log audit event (skip if audit service fails)
      try {
        await audit.logEvent({
          userId,
          guildId: servers[0].guild_id,
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
      } catch (auditError) {
        console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
      }

      res.json({
        success: true,
        message: `Successfully purchased ${quantity}x ${displayName} for ${totalCost} coins!`,
        item: {
          name: displayName,
          type: itemType,
          quantity: quantity,
          totalCost: totalCost
        },
        balance: {
          before: currentBalance,
          after: currentBalance - totalCost
        }
      });

      // Emit real-time event (skip if not available)
      try {
        if (req.app && req.app.emitToGuild) {
          req.app.emitToGuild(servers[0].guild_id, 'store.purchase', {
            playerId: player.id,
            itemName: displayName,
            itemType: itemType,
            quantity: quantity,
            totalCost: totalCost
          });
        }
      } catch (emitError) {
        console.log('⚠️ Socket.IO emit failed (non-critical):', emitError.message);
      }

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

    // Get balance from economy table (bot's actual economy system)
    const [balances] = await pool.query(`
      SELECT balance FROM economy 
      WHERE player_id = ? AND guild_id = ?
    `, [player.id, servers[0].guild_id]);

    const balance = balances.length > 0 ? balances[0].balance : 0;

    // Get currency name
    const [currencyData] = await pool.query(`
      SELECT rs.currency_name
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    const currencyName = currencyData.length > 0 ? currencyData[0].currency_name : 'coins';

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

// ==============================================
// CATEGORY CRUD OPERATIONS
// ==============================================

// POST /api/servers/:serverId/store/categories - Create a new category
router.post('/servers/:serverId/store/categories', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, type, role } = req.body;
    const userId = req.user?.id;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (!['item', 'kit', 'vehicle'].includes(type)) {
      return res.status(400).json({ error: 'Type must be item, kit, or vehicle' });
    }

    // Verify server exists and get the corresponding rust_servers entry
    const [servers] = await pool.query(`
      SELECT s.*, rs.id as rust_server_id
      FROM servers s
      LEFT JOIN rust_servers rs ON s.guild_id = rs.guild_id AND s.name = rs.nickname
      WHERE s.id = ?
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = servers[0];
    const rustServerId = server.rust_server_id;

    console.log(`🔍 Debug - Server ID: ${serverId}, Rust Server ID: ${rustServerId}`);
    console.log(`🔍 Debug - Server data:`, server);

    if (!rustServerId) {
      return res.status(400).json({ 
        error: 'Server not properly configured in bot database. Please ensure the server exists in both the unified servers table and the rust_servers table.' 
      });
    }

    // Check if category name already exists for this server
    const [existing] = await pool.query(
      'SELECT id FROM shop_categories WHERE server_id = ? AND name = ?',
      [rustServerId, name]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Category name already exists' });
    }

    // Create category using rust_servers id
    const [result] = await pool.query(
      'INSERT INTO shop_categories (server_id, name, type, role) VALUES (?, ?, ?, ?)',
      [rustServerId, name, type, role || null]
    );

    const categoryId = result.insertId;

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'CREATE_CATEGORY',
        resourceType: 'STORE',
        resourceId: categoryId,
        newValues: { name, type, role },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.status(201).json({
      success: true,
      category: {
        id: categoryId,
        name,
        type,
        role,
        serverId: parseInt(serverId)
      }
    });

  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/servers/:serverId/store/categories/:categoryId - Update a category
router.put('/servers/:serverId/store/categories/:categoryId', async (req, res) => {
  try {
    const { serverId, categoryId } = req.params;
    const { name, type, role } = req.body;
    const userId = req.user?.id;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (!['item', 'kit', 'vehicle'].includes(type)) {
      return res.status(400).json({ error: 'Type must be item, kit, or vehicle' });
    }

    // Verify category exists and belongs to server
    const [categories] = await pool.query(
      'SELECT * FROM shop_categories WHERE id = ? AND server_id = ?',
      [categoryId, serverId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const oldCategory = categories[0];

    // Check if new name conflicts with existing categories
    const [existing] = await pool.query(
      'SELECT id FROM shop_categories WHERE server_id = ? AND name = ? AND id != ?',
      [serverId, name, categoryId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Category name already exists' });
    }

    // Update category
    await pool.query(
      'UPDATE shop_categories SET name = ?, type = ?, role = ? WHERE id = ?',
      [name, type, role || null, categoryId]
    );

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'UPDATE_CATEGORY',
        resourceType: 'STORE',
        resourceId: categoryId,
        oldValues: oldCategory,
        newValues: { name, type, role },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.json({
      success: true,
      category: {
        id: parseInt(categoryId),
        name,
        type,
        role,
        serverId: parseInt(serverId)
      }
    });

  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/servers/:serverId/store/categories/:categoryId - Delete a category
router.delete('/servers/:serverId/store/categories/:categoryId', async (req, res) => {
  try {
    const { serverId, categoryId } = req.params;
    const userId = req.user?.id;

    // Verify category exists and belongs to server
    const [categories] = await pool.query(
      'SELECT * FROM shop_categories WHERE id = ? AND server_id = ?',
      [categoryId, serverId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = categories[0];

    // Check if category has items
    const [items] = await pool.query(
      'SELECT COUNT(*) as count FROM shop_items WHERE category_id = ?',
      [categoryId]
    );

    if (items[0].count > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete category with items. Delete all items first.' 
      });
    }

    // Delete category
    await pool.query('DELETE FROM shop_categories WHERE id = ?', [categoryId]);

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'DELETE_CATEGORY',
        resourceType: 'STORE',
        resourceId: categoryId,
        oldValues: category,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.json({ success: true, message: 'Category deleted successfully' });

  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ==============================================
// ITEM CRUD OPERATIONS
// ==============================================

// POST /api/servers/:serverId/store/categories/:categoryId/items - Create a new item
router.post('/servers/:serverId/store/categories/:categoryId/items', async (req, res) => {
  try {
    const { serverId, categoryId } = req.params;
    const { name, shortName, price, description, command, iconUrl, cooldownMinutes } = req.body;
    const userId = req.user?.id;

    if (!name || !shortName || !price || !command) {
      return res.status(400).json({ error: 'Name, shortName, price, and command are required' });
    }

    // Verify category exists and belongs to server
    const [categories] = await pool.query(
      'SELECT * FROM shop_categories WHERE id = ? AND server_id = ?',
      [categoryId, serverId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = categories[0];

    // Validate item type matches category type
    if (category.type !== 'item') {
      return res.status(400).json({ 
        error: `Cannot add item to ${category.type} category. Use the correct category type.` 
      });
    }

    // Check if item name already exists in this category
    const [existing] = await pool.query(
      'SELECT id FROM shop_items WHERE category_id = ? AND (name = ? OR short_name = ?)',
      [categoryId, name, shortName]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Item name or short name already exists in this category' });
    }

    // Create item
    const [result] = await pool.query(
      'INSERT INTO shop_items (category_id, name, short_name, price, description, command, icon_url, cooldown_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [categoryId, name, shortName, price, description || null, command, iconUrl || null, cooldownMinutes || 0]
    );

    const itemId = result.insertId;

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'CREATE_ITEM',
        resourceType: 'STORE',
        resourceId: itemId,
        newValues: { name, shortName, price, command, categoryId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.status(201).json({
      success: true,
      item: {
        id: itemId,
        name,
        shortName,
        price,
        description,
        command,
        iconUrl,
        cooldownMinutes: cooldownMinutes || 0,
        categoryId: parseInt(categoryId)
      }
    });

  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/servers/:serverId/store/categories/:categoryId/items/:itemId - Update an item
router.put('/servers/:serverId/store/categories/:categoryId/items/:itemId', async (req, res) => {
  try {
    const { serverId, categoryId, itemId } = req.params;
    const { name, shortName, price, description, command, iconUrl, cooldownMinutes } = req.body;
    const userId = req.user?.id;

    if (!name || !shortName || !price || !command) {
      return res.status(400).json({ error: 'Name, shortName, price, and command are required' });
    }

    // Verify item exists and belongs to category/server
    const [items] = await pool.query(`
      SELECT si.* FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      WHERE si.id = ? AND si.category_id = ? AND sc.server_id = ?
    `, [itemId, categoryId, serverId]);

    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const oldItem = items[0];

    // Check if new name conflicts with existing items
    const [existing] = await pool.query(
      'SELECT id FROM shop_items WHERE category_id = ? AND (name = ? OR short_name = ?) AND id != ?',
      [categoryId, name, shortName, itemId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Item name or short name already exists in this category' });
    }

    // Update item
    await pool.query(
      'UPDATE shop_items SET name = ?, short_name = ?, price = ?, description = ?, command = ?, icon_url = ?, cooldown_minutes = ? WHERE id = ?',
      [name, shortName, price, description || null, command, iconUrl || null, cooldownMinutes || 0, itemId]
    );

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'UPDATE_ITEM',
        resourceType: 'STORE',
        resourceId: itemId,
        oldValues: oldItem,
        newValues: { name, shortName, price, command, categoryId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.json({
      success: true,
      item: {
        id: parseInt(itemId),
        name,
        shortName,
        price,
        description,
        command,
        iconUrl,
        cooldownMinutes: cooldownMinutes || 0,
        categoryId: parseInt(categoryId)
      }
    });

  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/servers/:serverId/store/categories/:categoryId/items/:itemId - Delete an item
router.delete('/servers/:serverId/store/categories/:categoryId/items/:itemId', async (req, res) => {
  try {
    const { serverId, categoryId, itemId } = req.params;
    const userId = req.user?.id;

    // Verify item exists and belongs to category/server
    const [items] = await pool.query(`
      SELECT si.* FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      WHERE si.id = ? AND si.category_id = ? AND sc.server_id = ?
    `, [itemId, categoryId, serverId]);

    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = items[0];

    // Delete item
    await pool.query('DELETE FROM shop_items WHERE id = ?', [itemId]);

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'DELETE_ITEM',
        resourceType: 'STORE',
        resourceId: itemId,
        oldValues: item,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.json({ success: true, message: 'Item deleted successfully' });

  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ==============================================
// KIT CRUD OPERATIONS
// ==============================================

// POST /api/servers/:serverId/store/categories/:categoryId/kits - Create a new kit
router.post('/servers/:serverId/store/categories/:categoryId/kits', async (req, res) => {
  try {
    const { serverId, categoryId } = req.params;
    const { displayName, kitName, price, quantity, timer } = req.body;
    const userId = req.user?.id;

    if (!displayName || !kitName || !price || !quantity) {
      return res.status(400).json({ error: 'Display name, kit name, price, and quantity are required' });
    }

    // Verify category exists and belongs to server
    const [categories] = await pool.query(
      'SELECT * FROM shop_categories WHERE id = ? AND server_id = ?',
      [categoryId, serverId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = categories[0];

    // Validate kit type matches category type
    if (category.type !== 'kit') {
      return res.status(400).json({ 
        error: `Cannot add kit to ${category.type} category. Use the correct category type.` 
      });
    }

    // Check if kit name already exists in this category
    const [existing] = await pool.query(
      'SELECT id FROM shop_kits WHERE category_id = ? AND kit_name = ?',
      [categoryId, kitName]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Kit name already exists in this category' });
    }

    // Create kit
    const [result] = await pool.query(
      'INSERT INTO shop_kits (category_id, display_name, kit_name, price, quantity, timer) VALUES (?, ?, ?, ?, ?, ?)',
      [categoryId, displayName, kitName, price, quantity, timer || null]
    );

    const kitId = result.insertId;

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'CREATE_KIT',
        resourceType: 'STORE',
        resourceId: kitId,
        newValues: { displayName, kitName, price, quantity, timer, categoryId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.status(201).json({
      success: true,
      kit: {
        id: kitId,
        displayName,
        kitName,
        price,
        quantity,
        timer: timer || null,
        categoryId: parseInt(categoryId)
      }
    });

  } catch (error) {
    console.error('Error creating kit:', error);
    res.status(500).json({ error: 'Failed to create kit' });
  }
});

// PUT /api/servers/:serverId/store/categories/:categoryId/kits/:kitId - Update a kit
router.put('/servers/:serverId/store/categories/:categoryId/kits/:kitId', async (req, res) => {
  try {
    const { serverId, categoryId, kitId } = req.params;
    const { displayName, kitName, price, quantity, timer } = req.body;
    const userId = req.user?.id;

    if (!displayName || !kitName || !price || !quantity) {
      return res.status(400).json({ error: 'Display name, kit name, price, and quantity are required' });
    }

    // Verify kit exists and belongs to category/server
    const [kits] = await pool.query(`
      SELECT sk.* FROM shop_kits sk
      JOIN shop_categories sc ON sk.category_id = sc.id
      WHERE sk.id = ? AND sk.category_id = ? AND sc.server_id = ?
    `, [kitId, categoryId, serverId]);

    if (kits.length === 0) {
      return res.status(404).json({ error: 'Kit not found' });
    }

    const oldKit = kits[0];

    // Check if new kit name conflicts with existing kits
    const [existing] = await pool.query(
      'SELECT id FROM shop_kits WHERE category_id = ? AND kit_name = ? AND id != ?',
      [categoryId, kitName, kitId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Kit name already exists in this category' });
    }

    // Update kit
    await pool.query(
      'UPDATE shop_kits SET display_name = ?, kit_name = ?, price = ?, quantity = ?, timer = ? WHERE id = ?',
      [displayName, kitName, price, quantity, timer || null, kitId]
    );

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'UPDATE_KIT',
        resourceType: 'STORE',
        resourceId: kitId,
        oldValues: oldKit,
        newValues: { displayName, kitName, price, quantity, timer, categoryId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.json({
      success: true,
      kit: {
        id: parseInt(kitId),
        displayName,
        kitName,
        price,
        quantity,
        timer: timer || null,
        categoryId: parseInt(categoryId)
      }
    });

  } catch (error) {
    console.error('Error updating kit:', error);
    res.status(500).json({ error: 'Failed to update kit' });
  }
});

// DELETE /api/servers/:serverId/store/categories/:categoryId/kits/:kitId - Delete a kit
router.delete('/servers/:serverId/store/categories/:categoryId/kits/:kitId', async (req, res) => {
  try {
    const { serverId, categoryId, kitId } = req.params;
    const userId = req.user?.id;

    // Verify kit exists and belongs to category/server
    const [kits] = await pool.query(`
      SELECT sk.* FROM shop_kits sk
      JOIN shop_categories sc ON sk.category_id = sc.id
      WHERE sk.id = ? AND sk.category_id = ? AND sc.server_id = ?
    `, [kitId, categoryId, serverId]);

    if (kits.length === 0) {
      return res.status(404).json({ error: 'Kit not found' });
    }

    const kit = kits[0];

    // Delete kit
    await pool.query('DELETE FROM shop_kits WHERE id = ?', [kitId]);

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'DELETE_KIT',
        resourceType: 'STORE',
        resourceId: kitId,
        oldValues: kit,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.json({ success: true, message: 'Kit deleted successfully' });

  } catch (error) {
    console.error('Error deleting kit:', error);
    res.status(500).json({ error: 'Failed to delete kit' });
  }
});

// ==============================================
// VEHICLE CRUD OPERATIONS
// ==============================================

// POST /api/servers/:serverId/store/categories/:categoryId/vehicles - Create a new vehicle
router.post('/servers/:serverId/store/categories/:categoryId/vehicles', async (req, res) => {
  try {
    const { serverId, categoryId } = req.params;
    const { displayName, shortName, price, timer } = req.body;
    const userId = req.user?.id;

    if (!displayName || !shortName || !price) {
      return res.status(400).json({ error: 'Display name, short name, and price are required' });
    }

    // Verify category exists and belongs to server
    const [categories] = await pool.query(
      'SELECT * FROM shop_categories WHERE id = ? AND server_id = ?',
      [categoryId, serverId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = categories[0];

    // Validate vehicle type matches category type
    if (category.type !== 'vehicle') {
      return res.status(400).json({ 
        error: `Cannot add vehicle to ${category.type} category. Use the correct category type.` 
      });
    }

    // Check if vehicle short name already exists in this category
    const [existing] = await pool.query(
      'SELECT id FROM shop_vehicles WHERE category_id = ? AND short_name = ?',
      [categoryId, shortName]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Vehicle short name already exists in this category' });
    }

    // Create vehicle
    const [result] = await pool.query(
      'INSERT INTO shop_vehicles (category_id, display_name, short_name, price, timer) VALUES (?, ?, ?, ?, ?)',
      [categoryId, displayName, shortName, price, timer || null]
    );

    const vehicleId = result.insertId;

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'CREATE_VEHICLE',
        resourceType: 'STORE',
        resourceId: vehicleId,
        newValues: { displayName, shortName, price, timer, categoryId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.status(201).json({
      success: true,
      vehicle: {
        id: vehicleId,
        displayName,
        shortName,
        price,
        timer: timer || null,
        categoryId: parseInt(categoryId)
      }
    });

  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

// PUT /api/servers/:serverId/store/categories/:categoryId/vehicles/:vehicleId - Update a vehicle
router.put('/servers/:serverId/store/categories/:categoryId/vehicles/:vehicleId', async (req, res) => {
  try {
    const { serverId, categoryId, vehicleId } = req.params;
    const { displayName, shortName, price, timer } = req.body;
    const userId = req.user?.id;

    if (!displayName || !shortName || !price) {
      return res.status(400).json({ error: 'Display name, short name, and price are required' });
    }

    // Verify vehicle exists and belongs to category/server
    const [vehicles] = await pool.query(`
      SELECT sv.* FROM shop_vehicles sv
      JOIN shop_categories sc ON sv.category_id = sc.id
      WHERE sv.id = ? AND sv.category_id = ? AND sc.server_id = ?
    `, [vehicleId, categoryId, serverId]);

    if (vehicles.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const oldVehicle = vehicles[0];

    // Check if new short name conflicts with existing vehicles
    const [existing] = await pool.query(
      'SELECT id FROM shop_vehicles WHERE category_id = ? AND short_name = ? AND id != ?',
      [categoryId, shortName, vehicleId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Vehicle short name already exists in this category' });
    }

    // Update vehicle
    await pool.query(
      'UPDATE shop_vehicles SET display_name = ?, short_name = ?, price = ?, timer = ? WHERE id = ?',
      [displayName, shortName, price, timer || null, vehicleId]
    );

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'UPDATE_VEHICLE',
        resourceType: 'STORE',
        resourceId: vehicleId,
        oldValues: oldVehicle,
        newValues: { displayName, shortName, price, timer, categoryId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.json({
      success: true,
      vehicle: {
        id: parseInt(vehicleId),
        displayName,
        shortName,
        price,
        timer: timer || null,
        categoryId: parseInt(categoryId)
      }
    });

  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// DELETE /api/servers/:serverId/store/categories/:categoryId/vehicles/:vehicleId - Delete a vehicle
router.delete('/servers/:serverId/store/categories/:categoryId/vehicles/:vehicleId', async (req, res) => {
  try {
    const { serverId, categoryId, vehicleId } = req.params;
    const userId = req.user?.id;

    // Verify vehicle exists and belongs to category/server
    const [vehicles] = await pool.query(`
      SELECT sv.* FROM shop_vehicles sv
      JOIN shop_categories sc ON sv.category_id = sc.id
      WHERE sv.id = ? AND sv.category_id = ? AND sc.server_id = ?
    `, [vehicleId, categoryId, serverId]);

    if (vehicles.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const vehicle = vehicles[0];

    // Delete vehicle
    await pool.query('DELETE FROM shop_vehicles WHERE id = ?', [vehicleId]);

    // Log audit event
    try {
      await audit.logEvent({
        userId,
        action: 'DELETE_VEHICLE',
        resourceType: 'STORE',
        resourceId: vehicleId,
        oldValues: vehicle,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.log('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    res.json({ success: true, message: 'Vehicle deleted successfully' });

  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

module.exports = router;
