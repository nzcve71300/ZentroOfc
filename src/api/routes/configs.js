const express = require('express');
const router = express.Router();

// Import shared database connection
const pool = require('../../db/index');

// Get all configurations for a server
router.get('/:serverId/configs', async (req, res) => {
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
        'SELECT enabled, cooldown, horse_enabled, rhib_enabled, mini_enabled, car_enabled FROM rider_config WHERE server_id = ?',
        [rustServerId]
      );
      
      if (barResult.length > 0) {
        configs.systems.bar = {
          enabled: barResult[0].enabled,
          cooldown: barResult[0].cooldown,
          horse: barResult[0].horse_enabled,
          rhib: barResult[0].rhib_enabled,
          mini: barResult[0].mini_enabled,
          car: barResult[0].car_enabled
        };
      }
      
      // Recycler
      const [recyclerResult] = await pool.query(
        'SELECT enabled, cooldown_minutes FROM recycler_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (recyclerResult.length > 0) {
        configs.systems.recycler = {
          enabled: recyclerResult[0].enabled,
          cooldown: recyclerResult[0].cooldown_minutes
        };
      }
      
      // Home Teleport
      const [hometpResult] = await pool.query(
        'SELECT enabled, cooldown_minutes FROM home_teleport_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (hometpResult.length > 0) {
        configs.systems.hometp = {
          enabled: hometpResult[0].enabled,
          cooldown: hometpResult[0].cooldown_minutes
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
        'SELECT crate_type, enabled, spawn_interval_minutes FROM crate_event_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      configs.misc.crates = {};
      crateResult.forEach(row => {
        configs.misc.crates[row.crate_type.toLowerCase()] = {
          enabled: row.enabled,
          time: row.spawn_interval_minutes
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
router.post('/:serverId/configs', async (req, res) => {
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
    
    // For now, just log the configuration update request
    // TODO: Implement proper webhook communication with Discord bot
    try {
      console.log('Configuration update requested:', webhookData);
      
      res.json({ 
        success: true, 
        message: 'Configuration update request logged. Please use the /set command in Discord to apply changes.',
        data: webhookData
      });
      
    } catch (error) {
      console.error('Error processing configuration update:', error);
      res.status(500).json({ error: 'Failed to process configuration update request' });
    }
    
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

module.exports = router;
