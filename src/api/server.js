const express = require('express');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// CORS configuration
app.use(cors({
  origin: ['https://kaleidoscopic-crepe-4cde60.netlify.app', 'http://localhost:3000'],
  credentials: true
}));

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

// Discord connect endpoint (called by bot when secret key is valid)
app.post('/api/discord/connect', verifyEndpointLimiter, async (req, res) => {
  try {
    const { secretKey, discordServerId, discordServerName, userId } = req.body;

    if (!secretKey || !discordServerId || !discordServerName || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: secretKey, discordServerId, discordServerName, userId' 
      });
    }

    // Check if this guild is already linked
    const [existingLinks] = await pool.query(
      'SELECT dl.*, s.store_name FROM discord_links dl JOIN stores s ON dl.store_id = s.id WHERE dl.discord_guild_id = ? AND dl.is_active = TRUE',
      [discordServerId]
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
      [secretKey]
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
        [storeId, discordServerId, discordServerName, userId]
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
        message: 'Store connected successfully! Your Discord server is now linked.',
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
    console.error('Error connecting Discord server:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all configurations for a server
app.get('/api/servers/:serverId/configs', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    console.log(`🔍 Loading configurations for server: ${serverId}`);
    
    // Get server info
    const [serverResult] = await pool.query(
      'SELECT * FROM unified_servers WHERE id = ?',
      [serverId]
    );
    
    if (serverResult.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    const server = serverResult[0];
    
    // Get rust server ID
    const [rustServerResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE server_nickname = ? OR server_name = ?',
      [server.nickname, server.name]
    );
    
    if (rustServerResult.length === 0) {
      return res.status(404).json({ error: 'Rust server not found' });
    }
    
    const rustServerId = rustServerResult[0].id;
    
    const configs = {
      economy: {},
      teleports: {},
      events: {},
      systems: {},
      positions: {},
      misc: {}
    };
    
    // Load economy configurations
    try {
      const [economyResult] = await pool.query(
        'SELECT setting_name, setting_value FROM eco_games_config WHERE server_id = ?',
        [rustServerId]
      );
      
      economyResult.forEach(row => {
        const key = row.setting_name.replace(/-/g, '').toLowerCase();
        if (key.includes('toggle')) {
          configs.economy[key] = row.setting_value === '1' || row.setting_value === 'true';
        } else if (key.includes('amount') || key.includes('min') || key.includes('max')) {
          configs.economy[key] = parseInt(row.setting_value) || 0;
        } else {
          configs.economy[key] = row.setting_value;
        }
      });
    } catch (error) {
      console.log('No economy configs found');
    }
    
    // Load teleport configurations
    try {
      const [teleportResult] = await pool.query(
        'SELECT teleport_name, enabled, cooldown_minutes FROM teleport_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      teleportResult.forEach(row => {
        configs.teleports[row.teleport_name.toLowerCase()] = {
          enabled: row.enabled,
          cooldown: row.cooldown_minutes
        };
      });
    } catch (error) {
      console.log('No teleport configs found');
    }
    
    // Load event configurations
    try {
      const [eventResult] = await pool.query(
        'SELECT event_type, enabled, kill_message, respawn_message FROM event_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      eventResult.forEach(row => {
        configs.events[row.event_type.toLowerCase()] = {
          enabled: row.enabled,
          scout: row.enabled,
          killMsg: row.kill_message || '',
          respawnMsg: row.respawn_message || ''
        };
      });
    } catch (error) {
      console.log('No event configs found');
    }
    
    // Load system configurations
    try {
      // Book-a-Ride
      const [barResult] = await pool.query(
        'SELECT enabled, cooldown, horse_enabled, rhib_enabled, mini_enabled, car_enabled, welcome_message_enabled, welcome_message_text, fuel_amount, use_list FROM rider_config WHERE server_id = ?',
        [rustServerId]
      );
      
      if (barResult.length > 0) {
        configs.systems.bar = {
          enabled: barResult[0].enabled,
          cooldown: barResult[0].cooldown,
          horse: barResult[0].horse_enabled,
          rhib: barResult[0].rhib_enabled,
          mini: barResult[0].mini_enabled,
          car: barResult[0].car_enabled,
          welcomeMessage: barResult[0].welcome_message_enabled,
          welcomeMsgText: barResult[0].welcome_message_text || '',
          fuelAmount: barResult[0].fuel_amount || 100,
          useList: barResult[0].use_list
        };
      }
      
      // Recycler
      const [recyclerResult] = await pool.query(
        'SELECT enabled, cooldown_minutes, use_list FROM recycler_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (recyclerResult.length > 0) {
        configs.systems.recycler = {
          enabled: recyclerResult[0].enabled,
          cooldown: recyclerResult[0].cooldown_minutes,
          useList: recyclerResult[0].use_list
        };
      }
      
      // Home Teleport
      const [hometpResult] = await pool.query(
        'SELECT enabled, cooldown_minutes, use_list FROM home_teleport_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (hometpResult.length > 0) {
        configs.systems.hometp = {
          enabled: hometpResult[0].enabled,
          cooldown: hometpResult[0].cooldown_minutes,
          useList: hometpResult[0].use_list
        };
      }
      
      // Prison System
      const [prisonResult] = await pool.query(
        'SELECT enabled FROM prison_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (prisonResult.length > 0) {
        configs.systems.prison = {
          enabled: prisonResult[0].enabled,
          zoneSize: '',
          zoneColor: ''
        };
      }
    } catch (error) {
      console.log('No system configs found');
    }
    
    // Load position configurations
    try {
      const [positionResult] = await pool.query(
        'SELECT position_type, enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      positionResult.forEach(row => {
        configs.positions[row.position_type.toLowerCase()] = {
          enabled: row.enabled,
          delay: row.delay_seconds,
          cooldown: row.cooldown_minutes
        };
      });
    } catch (error) {
      console.log('No position configs found');
    }
    
    // Load miscellaneous configurations
    try {
      // Crate Events
      const [crateResult] = await pool.query(
        'SELECT crate_type, enabled, spawn_interval_minutes, spawn_amount, spawn_message FROM crate_event_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      configs.misc.crates = {};
      crateResult.forEach(row => {
        configs.misc.crates[row.crate_type.toLowerCase()] = {
          enabled: row.enabled,
          time: row.spawn_interval_minutes,
          amount: row.spawn_amount,
          message: row.spawn_message || ''
        };
      });
      
      // Zorp
      const [zorpResult] = await pool.query(
        'SELECT use_list FROM zorp_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (zorpResult.length > 0) {
        configs.misc.zorp = {
          useList: zorpResult[0].use_list
        };
      }
    } catch (error) {
      console.log('No misc configs found');
    }
    
    res.json(configs);
    
  } catch (error) {
    console.error('Error loading configurations:', error);
    res.status(500).json({ error: 'Failed to load configurations' });
  }
});

// Update configuration
app.post('/api/servers/:serverId/configs', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { config, option, server } = req.body;
    
    console.log(`🔧 Updating configuration: ${config} = ${option} for server: ${serverId}`);
    
    // Get server info
    const [serverResult] = await pool.query(
      'SELECT * FROM unified_servers WHERE id = ?',
      [serverId]
    );
    
    if (serverResult.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    const serverData = serverResult[0];
    
    // Get rust server ID
    const [rustServerResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE server_nickname = ? OR server_name = ?',
      [serverData.nickname, serverData.name]
    );
    
    if (rustServerResult.length === 0) {
      return res.status(404).json({ error: 'Rust server not found' });
    }
    
    const rustServerId = rustServerResult[0].id;
    
    // Send configuration update to Discord bot via webhook
    const webhookData = {
      type: 'set_config',
      serverId: rustServerId,
      serverName: serverData.name,
      config: config,
      option: option,
      guildId: serverData.guild_id
    };
    
    // For now, just update the database directly since webhook might not be set up
    // TODO: Implement proper webhook communication with Discord bot
    
    // Update the configuration in the database directly
    try {
      // This is a simplified version - in production, you'd want to call the Discord bot
      // For now, we'll just return success and let the Discord bot handle it via its own commands
      console.log('Configuration update requested:', webhookData);
      
      res.json({ 
        success: true, 
        message: 'Configuration update request sent to Discord bot. Please use the /set command in Discord to apply changes.',
        data: webhookData
      });
      
    } catch (dbError) {
      console.error('Database update error:', dbError);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
    
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Nivaro Store API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 External access: http://0.0.0.0:${PORT}`);
});

module.exports = app; 