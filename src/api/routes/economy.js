const express = require('express');
const router = express.Router();
const pool = require('../../db/index');
const AuditService = require('../services/audit');

const audit = new AuditService();

// GET /api/economy/balance/:playerId - Get player balance for a server
router.get('/balance/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { serverId } = req.query;

    if (!serverId) {
      return res.status(400).json({ error: 'serverId is required' });
    }

    const [balances] = await pool.query(`
      SELECT 
        pb.balance, pb.total_earned, pb.total_spent, pb.last_transaction_at,
        p.ign, s.display_name as server_name
      FROM player_balances pb
      JOIN players p ON pb.player_id = p.id
      JOIN servers s ON pb.server_id = s.id
      WHERE pb.player_id = ? AND pb.server_id = ?
    `, [playerId, serverId]);

    if (balances.length === 0) {
      return res.json({ balance: 0, total_earned: 0, total_spent: 0 });
    }

    res.json({ balance: balances[0] });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// POST /api/economy/add - Add currency to player
router.post('/add', async (req, res) => {
  try {
    const { playerId, serverId, amount, reason } = req.body;
    const userId = req.user.id;

    if (!playerId || !serverId || !amount) {
      return res.status(400).json({ error: 'playerId, serverId, and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    // Get current balance
    const [currentBalances] = await pool.query(`
      SELECT balance FROM player_balances 
      WHERE player_id = ? AND server_id = ?
    `, [playerId, serverId]);

    const currentBalance = currentBalances.length > 0 ? currentBalances[0].balance : 0;
    const newBalance = currentBalance + amount;

    // Update balance
    await pool.query(`
      INSERT INTO player_balances (player_id, server_id, balance, total_earned, last_transaction_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        balance = balance + ?,
        total_earned = total_earned + ?,
        last_transaction_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [playerId, serverId, newBalance, amount, amount, amount]);

    // Log transaction
    await pool.query(`
      INSERT INTO server_events (server_id, player_id, event_type, event_data)
      VALUES (?, ?, 'economy_transaction', ?)
    `, [serverId, playerId, JSON.stringify({
      type: 'add',
      amount: amount,
      reason: reason || 'Manual addition',
      old_balance: currentBalance,
      new_balance: newBalance,
      executed_by: userId
    })]);

    await audit.logEvent({
      userId,
      action: 'ADD_CURRENCY',
      resourceType: 'ECONOMY',
      resourceId: `${playerId}-${serverId}`,
      newValues: { amount, reason, old_balance: currentBalance, new_balance: newBalance },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      balance: newBalance,
      amount_added: amount,
      message: 'Currency added successfully'
    });

  } catch (error) {
    console.error('Error adding currency:', error);
    res.status(500).json({ error: 'Failed to add currency' });
  }
});

// POST /api/economy/remove - Remove currency from player
router.post('/remove', async (req, res) => {
  try {
    const { playerId, serverId, amount, reason } = req.body;
    const userId = req.user.id;

    if (!playerId || !serverId || !amount) {
      return res.status(400).json({ error: 'playerId, serverId, and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    // Get current balance
    const [currentBalances] = await pool.query(`
      SELECT balance FROM player_balances 
      WHERE player_id = ? AND server_id = ?
    `, [playerId, serverId]);

    const currentBalance = currentBalances.length > 0 ? currentBalances[0].balance : 0;
    const newBalance = Math.max(0, currentBalance - amount);

    // Update balance
    await pool.query(`
      INSERT INTO player_balances (player_id, server_id, balance, total_spent, last_transaction_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        balance = GREATEST(0, balance - ?),
        total_spent = total_spent + ?,
        last_transaction_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [playerId, serverId, newBalance, amount, amount, amount]);

    // Log transaction
    await pool.query(`
      INSERT INTO server_events (server_id, player_id, event_type, event_data)
      VALUES (?, ?, 'economy_transaction', ?)
    `, [serverId, playerId, JSON.stringify({
      type: 'remove',
      amount: amount,
      reason: reason || 'Manual removal',
      old_balance: currentBalance,
      new_balance: newBalance,
      executed_by: userId
    })]);

    await audit.logEvent({
      userId,
      action: 'REMOVE_CURRENCY',
      resourceType: 'ECONOMY',
      resourceId: `${playerId}-${serverId}`,
      newValues: { amount, reason, old_balance: currentBalance, new_balance: newBalance },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      balance: newBalance,
      amount_removed: amount,
      message: 'Currency removed successfully'
    });

  } catch (error) {
    console.error('Error removing currency:', error);
    res.status(500).json({ error: 'Failed to remove currency' });
  }
});

// POST /api/economy/set - Set player balance to specific amount
router.post('/set', async (req, res) => {
  try {
    const { playerId, serverId, amount, reason } = req.body;
    const userId = req.user.id;

    if (!playerId || !serverId || amount === undefined) {
      return res.status(400).json({ error: 'playerId, serverId, and amount are required' });
    }

    if (amount < 0) {
      return res.status(400).json({ error: 'Amount cannot be negative' });
    }

    // Get current balance
    const [currentBalances] = await pool.query(`
      SELECT balance FROM player_balances 
      WHERE player_id = ? AND server_id = ?
    `, [playerId, serverId]);

    const currentBalance = currentBalances.length > 0 ? currentBalances[0].balance : 0;

    // Update balance
    await pool.query(`
      INSERT INTO player_balances (player_id, server_id, balance, last_transaction_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        balance = ?,
        last_transaction_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [playerId, serverId, amount, amount]);

    // Log transaction
    await pool.query(`
      INSERT INTO server_events (server_id, player_id, event_type, event_data)
      VALUES (?, ?, 'economy_transaction', ?)
    `, [serverId, playerId, JSON.stringify({
      type: 'set',
      amount: amount,
      reason: reason || 'Manual set',
      old_balance: currentBalance,
      new_balance: amount,
      executed_by: userId
    })]);

    await audit.logEvent({
      userId,
      action: 'SET_CURRENCY',
      resourceType: 'ECONOMY',
      resourceId: `${playerId}-${serverId}`,
      newValues: { amount, reason, old_balance: currentBalance, new_balance: amount },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      balance: amount,
      old_balance: currentBalance,
      message: 'Balance set successfully'
    });

  } catch (error) {
    console.error('Error setting balance:', error);
    res.status(500).json({ error: 'Failed to set balance' });
  }
});

// POST /api/economy/transfer - Transfer currency between players
router.post('/transfer', async (req, res) => {
  try {
    const { fromPlayerId, toPlayerId, serverId, amount, reason } = req.body;
    const userId = req.user.id;

    if (!fromPlayerId || !toPlayerId || !serverId || !amount) {
      return res.status(400).json({ error: 'fromPlayerId, toPlayerId, serverId, and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    if (fromPlayerId === toPlayerId) {
      return res.status(400).json({ error: 'Cannot transfer to the same player' });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Check sender balance
      const [senderBalances] = await connection.query(`
        SELECT balance FROM player_balances 
        WHERE player_id = ? AND server_id = ?
      `, [fromPlayerId, serverId]);

      const senderBalance = senderBalances.length > 0 ? senderBalances[0].balance : 0;

      if (senderBalance < amount) {
        await connection.rollback();
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Update sender balance
      await connection.query(`
        INSERT INTO player_balances (player_id, server_id, balance, total_spent, last_transaction_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          balance = balance - ?,
          total_spent = total_spent + ?,
          last_transaction_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [fromPlayerId, serverId, senderBalance - amount, amount, amount, amount]);

      // Update receiver balance
      await connection.query(`
        INSERT INTO player_balances (player_id, server_id, balance, total_earned, last_transaction_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          balance = balance + ?,
          total_earned = total_earned + ?,
          last_transaction_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [toPlayerId, serverId, amount, amount, amount]);

      // Log transactions
      await connection.query(`
        INSERT INTO server_events (server_id, player_id, event_type, event_data)
        VALUES (?, ?, 'economy_transaction', ?)
      `, [serverId, fromPlayerId, JSON.stringify({
        type: 'transfer_out',
        amount: amount,
        reason: reason || 'Transfer to another player',
        to_player_id: toPlayerId,
        executed_by: userId
      })]);

      await connection.query(`
        INSERT INTO server_events (server_id, player_id, event_type, event_data)
        VALUES (?, ?, 'economy_transaction', ?)
      `, [serverId, toPlayerId, JSON.stringify({
        type: 'transfer_in',
        amount: amount,
        reason: reason || 'Transfer from another player',
        from_player_id: fromPlayerId,
        executed_by: userId
      })]);

      await connection.commit();

      await audit.logEvent({
        userId,
        action: 'TRANSFER_CURRENCY',
        resourceType: 'ECONOMY',
        resourceId: `${fromPlayerId}-${toPlayerId}-${serverId}`,
        newValues: { amount, reason, from_player_id: fromPlayerId, to_player_id: toPlayerId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        amount_transferred: amount,
        from_player_id: fromPlayerId,
        to_player_id: toPlayerId,
        message: 'Transfer completed successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error transferring currency:', error);
    res.status(500).json({ error: 'Failed to transfer currency' });
  }
});

// GET /api/economy/transactions - Get transaction history
router.get('/transactions', async (req, res) => {
  try {
    const { playerId, serverId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        se.id, se.player_id, se.event_type, se.event_data, se.created_at,
        p.ign, s.display_name as server_name
      FROM server_events se
      JOIN players p ON se.player_id = p.id
      JOIN servers s ON se.server_id = s.id
      WHERE se.event_type = 'economy_transaction'
    `;
    
    const params = [];

    if (playerId) {
      query += ' AND se.player_id = ?';
      params.push(playerId);
    }

    if (serverId) {
      query += ' AND se.server_id = ?';
      params.push(serverId);
    }

    query += ' ORDER BY se.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [transactions] = await pool.query(query, params);

    // Parse event_data JSON
    const parsedTransactions = transactions.map(t => ({
      ...t,
      event_data: JSON.parse(t.event_data)
    }));

    res.json({ transactions: parsedTransactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
