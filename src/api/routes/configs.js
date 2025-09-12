const express = require('express');
const router = express.Router();

// Import shared database connection
const pool = require('../../db/index');

// Get all configurations for a server
router.get('/:serverId/configs', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    console.log(`🔍 Loading configurations for server: ${serverId}`);
    
    // Test database connection first
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connection is working');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      return res.status(500).json({ error: 'Database connection failed', details: dbError.message });
    }
    
    // Get server info from servers table
    let serverResult;
    try {
      [serverResult] = await pool.query(
        'SELECT * FROM servers WHERE id = ?',
        [serverId]
      );
      console.log(`📊 Server query result:`, serverResult.length, 'rows found');
    } catch (queryError) {
      console.error('❌ Error querying servers:', queryError);
      return res.status(500).json({ error: 'Database query failed', details: queryError.message });
    }

    if (serverResult.length === 0) {
      console.log(`❌ No server found with ID: ${serverId}`);
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = serverResult[0];
    console.log(`📋 Found server:`, server.name);

    // Get rust server ID - use the server name to find the rust server
    let rustServerResult;
    try {
      [rustServerResult] = await pool.query(
        'SELECT id FROM rust_servers WHERE nickname = ? OR guild_id = ?',
        [server.name, server.guild_id]
      );
      console.log(`📊 Rust server query result:`, rustServerResult.length, 'rows found');
    } catch (queryError) {
      console.error('❌ Error querying rust_servers:', queryError);
      return res.status(500).json({ error: 'Rust server query failed', details: queryError.message });
    }

    if (rustServerResult.length === 0) {
      console.log(`❌ No rust server found for:`, server.name, server.guild_id);
      return res.status(404).json({ error: 'Rust server not found' });
    }

    const rustServerId = rustServerResult[0].id;
    console.log(`🎯 Using rust server ID: ${rustServerId}`);
    
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
      console.log(`📊 Loading economy configs for rust server ID: ${rustServerId}`);
      const [economyResult] = await pool.query(
        'SELECT setting_name, setting_value FROM eco_games_config WHERE server_id = ?',
        [rustServerId]
      );
      console.log(`📊 Economy configs found:`, economyResult.length);
      
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
      console.log('⚠️ No economy configs found or error loading:', error.message);
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

      // Bounty System
      const [bountyResult] = await pool.query(
        'SELECT enabled, reward_amount, cooldown_minutes FROM bounty_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (bountyResult.length > 0) {
        configs.systems.bounty = {
          enabled: bountyResult[0].enabled,
          rewardAmount: bountyResult[0].reward_amount,
          cooldown: bountyResult[0].cooldown_minutes
        };
      }

      // Killfeed System
      const [killfeedResult] = await pool.query(
        'SELECT enabled, format, randomizer FROM killfeed_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (killfeedResult.length > 0) {
        configs.systems.killfeed = {
          enabled: killfeedResult[0].enabled,
          format: killfeedResult[0].format,
          randomizer: killfeedResult[0].randomizer
        };
      }

      // Night Skip System
      const [nightSkipResult] = await pool.query(
        'SELECT enabled, skip_time FROM night_skip_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (nightSkipResult.length > 0) {
        configs.systems.nightSkip = {
          enabled: nightSkipResult[0].enabled,
          skipTime: nightSkipResult[0].skip_time
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
    
    console.log(`✅ Successfully loaded configurations for server ${serverId}`);
    console.log(`📊 Config summary:`, {
      economy: Object.keys(configs.economy).length,
      teleports: Object.keys(configs.teleports).length,
      events: Object.keys(configs.events).length,
      systems: Object.keys(configs.systems).length,
      positions: Object.keys(configs.positions).length,
      misc: Object.keys(configs.misc).length
    });
    
    res.json(configs);
    
  } catch (error) {
    console.error('❌ Error loading configurations:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to load configurations', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update configuration - Direct database update like Discord bot
router.post('/:serverId/configs', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { config, option, server } = req.body;
    
    console.log(`🔧 Updating configuration: ${config} = ${option} for server: ${serverId}`);
    
    // Get server info from servers table
    const [serverResult] = await pool.query(
      'SELECT * FROM servers WHERE id = ?',
      [serverId]
    );
    
    if (serverResult.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    const serverData = serverResult[0];
    
    // Get rust server ID
    const [rustServerResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE nickname = ? OR guild_id = ?',
      [serverData.name, serverData.guild_id]
    );
    
    if (rustServerResult.length === 0) {
      return res.status(404).json({ error: 'Rust server not found' });
    }
    
    const rustServerId = rustServerResult[0].id;
    
    // Parse the config to determine what type it is
    const teleportMatch = config.match(/^(TPN|TPNE|TPE|TPSE|TPS|TPSW|TPW|TPNW)-/);
    const eventMatch = config.match(/^(BRADLEY|HELICOPTER)-/);
    const barMatch = config.match(/^BAR-/);
    const economyMatch = config.match(/^(BLACKJACK|COINFLIP|DAILY|STARTING|PLAYERKILLS|MISCKILLS|BOUNTY)-/);
    const killfeedMatch = config.match(/^(KILLFEEDGAME|KILLFEED-SETUP|KILLFEED-RANDOMIZER)$/);
    const positionMatch = config.match(/^(OUTPOST|BANDIT)(?:-|$)/);
    const crateMatch = config.match(/^(CRATE-[1-4])(?:-|$)/);
    const zorpMatch = config.match(/^ZORP-/);
    const prisonMatch = config.match(/^Prison-/);
    const recyclerMatch = config.match(/^RECYCLER-/);
    const hometpMatch = config.match(/^HOMETP-/);
    
    // Extract config type
    let configType = '';
    if (crateMatch) {
      const crateParts = config.split('-');
      configType = crateParts.length >= 3 ? crateParts[2] : '';
    } else if (prisonMatch) {
      configType = config;
    } else {
      const parts = config.split('-');
      configType = parts.length >= 3 ? parts.slice(1).join('-') : (parts[1] || '');
    }
    
    // Validate and process the option value
    let validatedOption = option;
    
    // Handle boolean values
    if (['USE', 'USELIST', 'USE-DELAY', 'USE-KIT', 'CBL', 'SCOUT', 'ENABLE', 'ON', 'OUTPOST', 'BANDIT', 'HORSE', 'RHIB', 'MINI', 'CAR', 'WELCOME-MESSAGE', 'RECYCLER-USE', 'RECYCLER-USELIST', 'ZORP-USELIST', 'HOMETP-USE', 'HOMETP-USELIST', 'Prison-System', ''].includes(configType)) {
      if (!['on', 'off', 'true', 'false'].includes(option.toLowerCase())) {
        return res.status(400).json({ error: `Invalid value for ${configType || 'enable/disable'}. Use: on/off or true/false` });
      }
      validatedOption = option.toLowerCase();
    }
    
    // Handle numeric values
    if (['TIME', 'DELAYTIME', 'COOLDOWN', 'CBL-TIME', 'HOMETP-TIME', 'AMOUNT', 'DELAY', 'FUEL-AMOUNT', 'RECYCLER-TIME'].includes(configType)) {
      const numValue = parseInt(option);
      if (isNaN(numValue) || numValue < 0) {
        return res.status(400).json({ error: `Invalid value for ${configType}. Use a positive number` });
      }
      validatedOption = numValue;
    }
    
    // Now update the database based on config type
    let updateQuery = '';
    let updateParams = [];
    
    if (teleportMatch) {
      const teleport = teleportMatch[1].toLowerCase();
      
      // Ensure teleport config exists
      const [existingConfig] = await pool.query(
        'SELECT * FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
        [rustServerId, teleport]
      );
      
      if (existingConfig.length === 0) {
        await pool.query(`
          INSERT INTO teleport_configs (server_id, teleport_name, enabled, cooldown_minutes, delay_minutes, display_name, use_list, use_delay, use_kit, kit_name, position_x, position_y, position_z, combat_lock_enabled, combat_lock_time_minutes)
          VALUES (?, ?, false, 60, 0, ?, false, false, false, '', 0, 0, 0, false, 0)
        `, [rustServerId, teleport, teleport.toUpperCase()]);
      }
      
      // Update based on config type
      switch (configType) {
        case 'USE':
          updateQuery = 'UPDATE teleport_configs SET enabled = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId, teleport];
          break;
        case 'TIME':
          updateQuery = 'UPDATE teleport_configs SET cooldown_minutes = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, rustServerId, teleport];
          break;
        case 'DELAYTIME':
          updateQuery = 'UPDATE teleport_configs SET delay_minutes = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, rustServerId, teleport];
          break;
        case 'NAME':
          updateQuery = 'UPDATE teleport_configs SET display_name = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, rustServerId, teleport];
          break;
        case 'USELIST':
          updateQuery = 'UPDATE teleport_configs SET use_list = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId, teleport];
          break;
        case 'USE-DELAY':
          updateQuery = 'UPDATE teleport_configs SET use_delay = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId, teleport];
          break;
        case 'USE-KIT':
          updateQuery = 'UPDATE teleport_configs SET use_kit = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId, teleport];
          break;
        case 'KITNAME':
          updateQuery = 'UPDATE teleport_configs SET kit_name = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, rustServerId, teleport];
          break;
        case 'CBL':
          updateQuery = 'UPDATE teleport_configs SET combat_lock_enabled = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId, teleport];
          break;
        case 'CBL-TIME':
          updateQuery = 'UPDATE teleport_configs SET combat_lock_time_minutes = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, rustServerId, teleport];
          break;
        case 'COORDINATES':
          const coords = option.split(',').map(coord => parseFloat(coord.trim()));
          if (coords.length !== 3 || coords.some(isNaN)) {
            return res.status(400).json({ error: 'Invalid coordinates format. Use: x,y,z (e.g., 100,50,200)' });
          }
          updateQuery = 'UPDATE teleport_configs SET position_x = ?, position_y = ?, position_z = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [coords[0], coords[1], coords[2], rustServerId, teleport];
          break;
      }
    } else if (economyMatch) {
      // Handle economy configurations
      let settingName = '';
      switch (config) {
        case 'BLACKJACK-TOGGLE':
          settingName = 'blackjack_toggle';
          break;
        case 'COINFLIP-TOGGLE':
          settingName = 'coinflip_toggle';
          break;
        case 'DAILY-AMOUNT':
          settingName = 'daily_amount';
          break;
        case 'STARTING-BALANCE':
          settingName = 'starting_balance';
          break;
        case 'PLAYERKILLS-AMOUNT':
          settingName = 'playerkills_amount';
          break;
        case 'MISCKILLS-AMOUNT':
          settingName = 'misckills_amount';
          break;
        case 'BOUNTY-TOGGLE':
          settingName = 'bounty_toggle';
          break;
        case 'BOUNTY-REWARDS':
          settingName = 'bounty_rewards';
          break;
        case 'BLACKJACK-MIN':
          settingName = 'blackjack_min';
          break;
        case 'BLACKJACK-MAX':
          settingName = 'blackjack_max';
          break;
        case 'COINFLIP-MIN':
          settingName = 'coinflip_min';
          break;
        case 'COINFLIP-MAX':
          settingName = 'coinflip_max';
          break;
      }
      
      let settingValue = '';
      if (config.includes('TOGGLE')) {
        const enabled = validatedOption === 'on' || validatedOption === 'true';
        settingValue = enabled ? 'true' : 'false';
      } else {
        settingValue = validatedOption.toString();
      }
      
      updateQuery = `INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`;
      updateParams = [rustServerId, settingName, settingValue];
    } else if (eventMatch) {
      const eventType = eventMatch[1].toLowerCase();
      
      // Ensure event config exists
      const [existingEventConfig] = await pool.query(
        'SELECT * FROM event_configs WHERE server_id = ? AND event_type = ?',
        [rustServerId, eventType]
      );
      
      if (existingEventConfig.length === 0) {
        await pool.query(`
          INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
          VALUES (?, ?, false, ?, ?)
        `, [
          rustServerId,
          eventType,
          eventType === 'bradley' ? '<color=#00ffff>Brad got taken</color>' : '<color=#00ffff>Heli got taken</color>',
          eventType === 'bradley' ? '<color=#00ffff>Bradley APC has respawned</color>' : '<color=#00ffff>Patrol Helicopter has respawned</color>'
        ]);
      }
      
      switch (configType) {
        case 'SCOUT':
          updateQuery = 'UPDATE event_configs SET enabled = ? WHERE server_id = ? AND event_type = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId, eventType];
          break;
        case 'KILLMSG':
          updateQuery = 'UPDATE event_configs SET kill_message = ? WHERE server_id = ? AND event_type = ?';
          updateParams = [validatedOption, rustServerId, eventType];
          break;
        case 'RESPAWNMSG':
          updateQuery = 'UPDATE event_configs SET respawn_message = ? WHERE server_id = ? AND event_type = ?';
          updateParams = [validatedOption, rustServerId, eventType];
          break;
      }
    } else if (barMatch) {
      // Ensure BAR config exists
      const [existingBarConfig] = await pool.query(
        'SELECT * FROM rider_config WHERE server_id = ?',
        [rustServerId]
      );
      
      if (existingBarConfig.length === 0) {
        await pool.query(`
          INSERT INTO rider_config (server_id, enabled, cooldown, horse_enabled, rhib_enabled, mini_enabled, car_enabled, fuel_amount, use_list, welcome_message_enabled, welcome_message_text) 
          VALUES (?, 1, 300, 1, 1, 0, 0, 100, 0, 1, 'Welcome to Book-a-Ride!')
        `, [rustServerId]);
      }
      
      switch (configType) {
        case 'USE':
          updateQuery = 'UPDATE rider_config SET enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'USELIST':
          updateQuery = 'UPDATE rider_config SET use_list = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'COOLDOWN':
          updateQuery = 'UPDATE rider_config SET cooldown = ? WHERE server_id = ?';
          updateParams = [validatedOption, rustServerId];
          break;
        case 'HORSE':
          updateQuery = 'UPDATE rider_config SET horse_enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'RHIB':
          updateQuery = 'UPDATE rider_config SET rhib_enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'MINI':
          updateQuery = 'UPDATE rider_config SET mini_enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'CAR':
          updateQuery = 'UPDATE rider_config SET car_enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'WELCOME-MESSAGE':
          updateQuery = 'UPDATE rider_config SET welcome_message_enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'WELCOME-MSG-TEXT':
          updateQuery = 'UPDATE rider_config SET welcome_message_text = ? WHERE server_id = ?';
          updateParams = [validatedOption, rustServerId];
          break;
        case 'FUEL-AMOUNT':
          updateQuery = 'UPDATE rider_config SET fuel_amount = ? WHERE server_id = ?';
          updateParams = [validatedOption, rustServerId];
          break;
      }
    } else if (recyclerMatch) {
      // Ensure recycler config exists
      const [existingRecyclerConfig] = await pool.query(
        'SELECT * FROM recycler_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (existingRecyclerConfig.length === 0) {
        await pool.query(`
          INSERT INTO recycler_configs (server_id, enabled, use_list, cooldown_minutes) 
          VALUES (?, false, false, 5)
        `, [rustServerId]);
      }
      
      switch (configType) {
        case 'RECYCLER-USE':
          updateQuery = 'UPDATE recycler_configs SET enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'RECYCLER-USELIST':
          updateQuery = 'UPDATE recycler_configs SET use_list = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'RECYCLER-TIME':
          updateQuery = 'UPDATE recycler_configs SET cooldown_minutes = ? WHERE server_id = ?';
          updateParams = [validatedOption, rustServerId];
          break;
      }
    } else if (hometpMatch) {
      // Ensure home teleport config exists
      const [existingHometpConfig] = await pool.query(
        'SELECT * FROM home_teleport_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (existingHometpConfig.length === 0) {
        await pool.query(`
          INSERT INTO home_teleport_configs (server_id, enabled, use_list, cooldown_minutes) 
          VALUES (?, false, false, 5)
        `, [rustServerId]);
      }
      
      switch (configType) {
        case 'HOMETP-USE':
          updateQuery = 'UPDATE home_teleport_configs SET enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'HOMETP-USELIST':
          updateQuery = 'UPDATE home_teleport_configs SET use_list = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'HOMETP-TIME':
          updateQuery = 'UPDATE home_teleport_configs SET cooldown_minutes = ? WHERE server_id = ?';
          updateParams = [validatedOption, rustServerId];
          break;
      }
    } else if (prisonMatch) {
      // Ensure prison config exists
      const [existingPrisonConfig] = await pool.query(
        'SELECT * FROM prison_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (existingPrisonConfig.length === 0) {
        await pool.query(`
          INSERT INTO prison_configs (server_id, enabled, zone_size, zone_color) 
          VALUES (?, false, 50, '(255,0,0)')
        `, [rustServerId]);
      }
      
      switch (configType) {
        case 'Prison-System':
          updateQuery = 'UPDATE prison_configs SET enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
          break;
        case 'Prison-Z-Size':
          updateQuery = 'UPDATE prison_configs SET zone_size = ? WHERE server_id = ?';
          updateParams = [validatedOption, rustServerId];
          break;
        case 'Prison-Z-Color':
          updateQuery = 'UPDATE prison_configs SET zone_color = ? WHERE server_id = ?';
          updateParams = [validatedOption, rustServerId];
          break;
      }
    } else if (positionMatch) {
      const positionType = positionMatch[1].toLowerCase();
      
      // Ensure position config exists
      const [existingPositionConfig] = await pool.query(
        'SELECT * FROM position_configs WHERE server_id = ? AND position_type = ?',
        [rustServerId, positionType]
      );
      
      if (existingPositionConfig.length === 0) {
        await pool.query(`
          INSERT INTO position_configs (server_id, position_type, enabled, delay_seconds, cooldown_minutes, combat_lock_enabled, combat_lock_time_minutes) 
          VALUES (?, ?, true, 0, 5, false, 0)
        `, [rustServerId, positionType]);
      }
      
      switch (configType) {
        case 'ENABLE':
        case '':
        case 'OUTPOST':
        case 'BANDIT':
          updateQuery = 'UPDATE position_configs SET enabled = ? WHERE server_id = ? AND position_type = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId, positionType];
          break;
        case 'DELAY':
          updateQuery = 'UPDATE position_configs SET delay_seconds = ? WHERE server_id = ? AND position_type = ?';
          updateParams = [validatedOption, rustServerId, positionType];
          break;
        case 'COOLDOWN':
          updateQuery = 'UPDATE position_configs SET cooldown_minutes = ? WHERE server_id = ? AND position_type = ?';
          updateParams = [validatedOption, rustServerId, positionType];
          break;
        case 'CBL':
          updateQuery = 'UPDATE position_configs SET combat_lock_enabled = ? WHERE server_id = ? AND position_type = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId, positionType];
          break;
        case 'CBL-TIME':
          updateQuery = 'UPDATE position_configs SET combat_lock_time_minutes = ? WHERE server_id = ? AND position_type = ?';
          updateParams = [validatedOption, rustServerId, positionType];
          break;
      }
    } else if (crateMatch) {
      const crateType = crateMatch[1].toLowerCase();
      
      // Ensure crate config exists
      const [existingCrateConfig] = await pool.query(
        'SELECT * FROM crate_event_configs WHERE server_id = ? AND crate_type = ?',
        [rustServerId, crateType]
      );
      
      if (existingCrateConfig.length === 0) {
        await pool.query(`
          INSERT INTO crate_event_configs (server_id, crate_type, enabled, spawn_interval_minutes, spawn_amount, spawn_message) 
          VALUES (?, ?, false, 60, 1, ?)
        `, [rustServerId, crateType, '<b><size=45><color=#00FF00>CRATE EVENT SPAWNED</color></size></b>']);
      }
      
      switch (configType) {
        case 'ON':
        case '':
          updateQuery = 'UPDATE crate_event_configs SET enabled = ? WHERE server_id = ? AND crate_type = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId, crateType];
          break;
        case 'TIME':
          updateQuery = 'UPDATE crate_event_configs SET spawn_interval_minutes = ? WHERE server_id = ? AND crate_type = ?';
          updateParams = [validatedOption, rustServerId, crateType];
          break;
        case 'AMOUNT':
          updateQuery = 'UPDATE crate_event_configs SET spawn_amount = ? WHERE server_id = ? AND crate_type = ?';
          updateParams = [validatedOption, rustServerId, crateType];
          break;
        case 'MSG':
          updateQuery = 'UPDATE crate_event_configs SET spawn_message = ? WHERE server_id = ? AND crate_type = ?';
          updateParams = [validatedOption, rustServerId, crateType];
          break;
      }
    } else if (zorpMatch) {
      // Ensure ZORP config exists
      const [existingZorpConfig] = await pool.query(
        'SELECT * FROM zorp_configs WHERE server_id = ?',
        [rustServerId]
      );
      
      if (existingZorpConfig.length === 0) {
        await pool.query(`
          INSERT INTO zorp_configs (server_id, use_list) 
          VALUES (?, false)
        `, [rustServerId]);
      }
      
      if (configType === 'USELIST') {
        updateQuery = 'UPDATE zorp_configs SET use_list = ? WHERE server_id = ?';
        updateParams = [validatedOption === 'on' || validatedOption === 'true', rustServerId];
      }
    }
    
    // Execute the update query
    if (updateQuery) {
      await pool.query(updateQuery, updateParams);
      console.log(`✅ Successfully updated configuration: ${config} = ${validatedOption}`);
    } else {
      return res.status(400).json({ error: `Unknown config type: ${configType}` });
    }
    
    res.json({ 
      success: true, 
      message: `✅ **${config}** set to **${validatedOption}** on **${serverData.name}**`,
      data: { config, option: validatedOption, server: serverData.name }
    });
    
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration', details: error.message });
  }
});

module.exports = router;
