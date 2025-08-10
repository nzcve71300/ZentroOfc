const express = require('express');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: message });
    }
  });
};

// Global rate limiter: 100 requests per 15 minutes
const globalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100,
  'Too many requests from this IP, please try again later.'
);

// Specific endpoint rate limiter: 10 requests per minute
const verifyEndpointLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10,
  'Too many verification attempts, please try again later.'
);

app.use(globalLimiter);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Generate secret key endpoint (for testing/development)
app.post('/api/generate-secret', async (req, res) => {
  try {
    const { store_name, store_url, owner_email } = req.body;

    if (!store_name || !store_url || !owner_email) {
      return res.status(400).json({ 
        error: 'Missing required fields: store_name, store_url, owner_email' 
      });
    }

    // Generate a secure random secret key
    const secretKey = crypto.randomBytes(32).toString('hex');

    // Insert into pending_stores
    await pool.query(
      'INSERT INTO pending_stores (secret_key, store_name, store_url, owner_email) VALUES (?, ?, ?, ?)',
      [secretKey, store_name, store_url, owner_email]
    );

    res.json({ 
      success: true, 
      secret_key: secretKey,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
    });

  } catch (error) {
    console.error('Error generating secret key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Discord link endpoint
app.post('/api/verify-discord-link', verifyEndpointLimiter, async (req, res) => {
  try {
    const { secret_key, discord_guild_id, discord_guild_name, linked_by_user_id } = req.body;

    if (!secret_key || !discord_guild_id || !discord_guild_name || !linked_by_user_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: secret_key, discord_guild_id, discord_guild_name, linked_by_user_id' 
      });
    }

    // Check if this guild is already linked
    const [existingLinks] = await pool.query(
      'SELECT dl.*, s.store_name FROM discord_links dl JOIN stores s ON dl.store_id = s.id WHERE dl.discord_guild_id = ? AND dl.is_active = TRUE',
      [discord_guild_id]
    );

    if (existingLinks.length > 0) {
      return res.status(409).json({ 
        error: 'Discord server already linked',
        store_name: existingLinks[0].store_name
      });
    }

    // Verify the secret key
    const [pendingStores] = await pool.query(
      'SELECT * FROM pending_stores WHERE secret_key = ? AND is_used = FALSE AND expires_at > NOW()',
      [secret_key]
    );

    if (pendingStores.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid, expired, or already used secret key' 
      });
    }

    const pendingStore = pendingStores[0];

    // Begin transaction
    await pool.query('START TRANSACTION');

    try {
      // Create the store record
      const [storeResult] = await pool.query(
        'INSERT INTO stores (store_name, store_url, owner_email) VALUES (?, ?, ?)',
        [pendingStore.store_name, pendingStore.store_url, pendingStore.owner_email]
      );

      const storeId = storeResult.insertId;

      // Create the Discord link
      await pool.query(
        'INSERT INTO discord_links (store_id, discord_guild_id, discord_guild_name, linked_by_user_id) VALUES (?, ?, ?, ?)',
        [storeId, discord_guild_id, discord_guild_name, linked_by_user_id]
      );

      // Mark the pending store as used
      await pool.query(
        'UPDATE pending_stores SET is_used = TRUE WHERE id = ?',
        [pendingStore.id]
      );

      // Commit transaction
      await pool.query('COMMIT');

      res.json({ 
        success: true,
        store_name: pendingStore.store_name,
        store_url: pendingStore.store_url,
        linked_at: new Date().toISOString()
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error verifying Discord link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get store info endpoint
app.get('/api/store/:discord_guild_id', async (req, res) => {
  try {
    const { discord_guild_id } = req.params;

    const [links] = await pool.query(
      'SELECT dl.*, s.store_name, s.store_url, s.owner_email FROM discord_links dl JOIN stores s ON dl.store_id = s.id WHERE dl.discord_guild_id = ? AND dl.is_active = TRUE',
      [discord_guild_id]
    );

    if (links.length === 0) {
      return res.status(404).json({ error: 'Store not found for this Discord server' });
    }

    res.json({
      success: true,
      store: {
        name: links[0].store_name,
        url: links[0].store_url,
        linked_at: links[0].linked_at,
        linked_by: links[0].linked_by_user_id
      }
    });

  } catch (error) {
    console.error('Error getting store info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cleanup expired pending stores (run every hour)
setInterval(async () => {
  try {
    await pool.query('DELETE FROM pending_stores WHERE expires_at < NOW() AND is_used = FALSE');
    console.log('Cleaned up expired pending stores');
  } catch (error) {
    console.error('Error cleaning up expired pending stores:', error);
  }
}, 60 * 60 * 1000); // 1 hour

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Nivaro Store API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app; 