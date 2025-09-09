const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');
const { getServerByNickname, getServersForGuild } = require('../../utils/unifiedPlayerSystem');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set')
    .setDescription('Configure teleport system settings')
    .addStringOption(option =>
      option.setName('config')
        .setDescription('Select the configuration option (type to search)')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Value for the configuration')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Server to configure')
        .setRequired(true)
        .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      if (focusedOption.name === 'server') {
        const guildId = interaction.guildId;
        const servers = await getServersForGuild(guildId);
        const filtered = servers.filter(s => s.nickname.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.map(s => ({ name: s.nickname, value: s.nickname })));
      } else if (focusedOption.name === 'config') {
        // Generate all teleport configuration options
        const teleports = ['TPN', 'TPNE', 'TPE', 'TPSE', 'TPS', 'TPSW', 'TPW', 'TPNW'];
        const configTypes = [
          { name: 'USE (Enable/Disable)', value: 'USE' },
          { name: 'TIME (Cooldown)', value: 'TIME' },
          { name: 'DELAYTIME (Delay)', value: 'DELAYTIME' },
          { name: 'NAME (Display Name)', value: 'NAME' },
          { name: 'USELIST (Use List)', value: 'USELIST' },
          { name: 'USE-DELAY (Use Delay)', value: 'USE-DELAY' },
          { name: 'USE-KIT (ON/OFF)', value: 'USE-KIT' },
          { name: 'KITNAME (Kit Name)', value: 'KITNAME' },
          { name: 'COORDINATES (Teleport Location)', value: 'COORDINATES' }
        ];
        
        // Generate event configuration options
        const events = ['BRADLEY', 'HELICOPTER'];
        const eventConfigTypes = [
          { name: 'SCOUT (On/Off)', value: 'SCOUT' },
          { name: 'KILLMSG (Kill Message)', value: 'KILLMSG' },
          { name: 'RESPAWNMSG (Respawn Message)', value: 'RESPAWNMSG' }
        ];
        
        // Generate BAR (Book-a-Ride) configuration options
        const barConfigTypes = [
          { name: 'USE (On/Off)', value: 'USE' },
          { name: 'USELIST (On/Off)', value: 'USELIST' },
          { name: 'COOLDOWN (Value in minutes)', value: 'COOLDOWN' },
          { name: 'HORSE (On/Off)', value: 'HORSE' },
          { name: 'RHIB (On/Off)', value: 'RHIB' },
          { name: 'MINI (On/Off)', value: 'MINI' },
          { name: 'CAR (On/Off)', value: 'CAR' },
          { name: 'FUEL-AMOUNT (Value)', value: 'FUEL-AMOUNT' }
        ];
        
        // Generate Position configuration options
        const positions = ['OUTPOST', 'BANDIT'];
        const positionConfigTypes = [
          { name: 'ENABLE (On/Off)', value: '' },
          { name: 'DELAY (Value in seconds)', value: 'DELAY' },
          { name: 'COOLDOWN (Value in minutes)', value: 'COOLDOWN' }
        ];
        
        // Generate Crate Event configuration options
        const crateEvents = ['CRATE-1', 'CRATE-2', 'CRATE-3', 'CRATE-4'];
        const crateConfigTypes = [
          { name: 'ON/OFF (Enable/Disable)', value: '' },
          { name: 'TIME (Spawn interval in minutes)', value: 'TIME' },
          { name: 'AMOUNT (Number of crates to spawn, max 2)', value: 'AMOUNT' },
          { name: 'MSG (Custom spawn message)', value: 'MSG' }
        ];
        
        const allOptions = [];
        
        // Add Economy configuration options FIRST (most important)
        const economyConfigTypes = [
          { name: 'BLACKJACK-TOGGLE (On/Off)', value: 'BLACKJACK-TOGGLE' },
          { name: 'COINFLIP-TOGGLE (On/Off)', value: 'COINFLIP-TOGGLE' },
          { name: 'DAILY-AMOUNT (Reward Amount)', value: 'DAILY-AMOUNT' },
          { name: 'STARTING-BALANCE (Amount)', value: 'STARTING-BALANCE' },
          { name: 'PLAYERKILLS-AMOUNT (Reward)', value: 'PLAYERKILLS-AMOUNT' },
          { name: 'MISCKILLS-AMOUNT (Reward)', value: 'MISCKILLS-AMOUNT' },
          { name: 'BOUNTY-TOGGLE (On/Off)', value: 'BOUNTY-TOGGLE' },
          { name: 'BOUNTY-REWARDS (Amount)', value: 'BOUNTY-REWARDS' },
          { name: 'BLACKJACK-MIN (Min Bet)', value: 'BLACKJACK-MIN' },
          { name: 'BLACKJACK-MAX (Max Bet)', value: 'BLACKJACK-MAX' },
          { name: 'COINFLIP-MIN (Min Bet)', value: 'COINFLIP-MIN' },
          { name: 'COINFLIP-MAX (Max Bet)', value: 'COINFLIP-MAX' }
        ];
        
        // Add Killfeed configuration options SECOND
        const killfeedConfigTypes = [
          { name: 'KILLFEEDGAME (On/Off)', value: 'KILLFEEDGAME' },
          { name: 'KILLFEED-SETUP (Format String)', value: 'KILLFEED-SETUP' },
          { name: 'KILLFEED-RANDOMIZER (On/Off)', value: 'KILLFEED-RANDOMIZER' }
        ];
        
        economyConfigTypes.forEach(configType => {
          allOptions.push({
            name: configType.name,
            value: configType.value
          });
        });
        
        // Add Killfeed options SECOND
        killfeedConfigTypes.forEach(configType => {
          allOptions.push({
            name: configType.name,
            value: configType.value
          });
        });
        
        // Add event options THIRD (Bradley/Helicopter)
        events.forEach(event => {
          eventConfigTypes.forEach(configType => {
            allOptions.push({
              name: `${event}-${configType.value}`,
              value: `${event}-${configType.value}`
            });
          });
        });
        
        // Add BAR options THIRD
        barConfigTypes.forEach(configType => {
          allOptions.push({
            name: `BAR-${configType.value}`,
            value: `BAR-${configType.value}`
          });
        });
        
        // Add Position options FOURTH
        positions.forEach(position => {
          positionConfigTypes.forEach(configType => {
            if (configType.value === '') {
              // For enable/disable, just use the position name
              allOptions.push({
                name: `${position} (ON/OFF)`,
                value: `${position}`
              });
            } else {
              allOptions.push({
                name: `${position}-${configType.value}`,
                value: `${position}-${configType.value}`
              });
            }
          });
        });
        
        // Add Crate Event options FIFTH
        crateEvents.forEach(crate => {
          crateConfigTypes.forEach(configType => {
            if (configType.value === '') {
              // For enable/disable, just use the crate name
              allOptions.push({
                name: `${crate} (ON/OFF)`,
                value: `${crate}`
              });
            } else {
              allOptions.push({
                name: `${crate}-${configType.value}`,
                value: `${crate}-${configType.value}`
              });
            }
          });
        });
        
        // Add Recycler configuration options SIXTH
        const recyclerConfigTypes = [
          { name: 'RECYCLER-USE (ON/OFF)', value: 'RECYCLER-USE' },
          { name: 'RECYCLER-USELIST (ON/OFF)', value: 'RECYCLER-USELIST' },
          { name: 'RECYCLER-TIME (Minutes)', value: 'RECYCLER-TIME' }
        ];
        
        recyclerConfigTypes.forEach(configType => {
          allOptions.push({
            name: configType.name,
            value: configType.value
          });
        });
        
        // Add ZORP configuration options SEVENTH
        const zorpConfigTypes = [
          { name: 'ZORP-USELIST (ON/OFF)', value: 'ZORP-USELIST' }
        ];
        
        zorpConfigTypes.forEach(configType => {
          allOptions.push({
            name: configType.name,
            value: configType.value
          });
        });
        
        // Add Prison System configuration options EIGHTH
        const prisonConfigTypes = [
          { name: 'Prison-System (ON/OFF)', value: 'Prison-System' },
          { name: 'Prison-Z-Size (Zone Size)', value: 'Prison-Z-Size' },
          { name: 'Prison-Z-Color (Zone Color)', value: 'Prison-Z-Color' }
        ];
        
        prisonConfigTypes.forEach(configType => {
          allOptions.push({
            name: configType.name,
            value: configType.value
          });
        });
        
        // Add HOMETP configuration options NINTH
        const hometpConfigTypes = [
          { name: 'HOMETP-USE (ON/OFF)', value: 'HOMETP-USE' },
          { name: 'HOMETP-USELIST (ON/OFF)', value: 'HOMETP-USELIST' },
          { name: 'HOMETP-TIME (Cooldown in minutes)', value: 'HOMETP-TIME' }
        ];
        
        hometpConfigTypes.forEach(configType => {
          allOptions.push({
            name: configType.name,
            value: configType.value
          });
        });
        
        // Add teleport options LAST (least important for economy configs)
        teleports.forEach(teleport => {
          configTypes.forEach(configType => {
            allOptions.push({
              name: `${teleport}-${configType.value}`,
              value: `${teleport}-${configType.value}`
            });
          });
        });
        
        // Filter based on user input
        const filtered = allOptions.filter(option => 
          option.name.toLowerCase().includes(focusedValue.toLowerCase())
        );
        
        // Return first 25 results (Discord limit)
        await interaction.respond(filtered.slice(0, 25));
      }
    } catch (err) {
      console.error('Autocomplete error:', err);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    try {
      console.log(`[SET COMMAND DEBUG] Command executed with options:`, {
        config: interaction.options.getString('config'),
        option: interaction.options.getString('option'),
        server: interaction.options.getString('server'),
        guildId: interaction.guildId
      });
      
      const config = interaction.options.getString('config');
      const option = interaction.options.getString('option');
      const serverOption = interaction.options.getString('server');
      const guildId = interaction.guildId;

      // Extract teleport name from config (e.g., "TPNE-USE" -> "tpne")
      const teleportMatch = config.match(/^(TPN|TPNE|TPE|TPSE|TPS|TPSW|TPW|TPNW)-/);
      const teleport = teleportMatch ? teleportMatch[1].toLowerCase() : 'default';
      
      // Extract event name from config (e.g., "BRADLEY-SCOUT" -> "bradley")
      const eventMatch = config.match(/^(BRADLEY|HELICOPTER)-/);
      const eventType = eventMatch ? eventMatch[1].toLowerCase() : null;
      
      // Extract BAR config from config (e.g., "BAR-USE" -> "bar")
      const barMatch = config.match(/^BAR-/);
      const isBarConfig = barMatch !== null;
      
      // Extract Economy config from config (e.g., "BLACKJACK-TOGGLE" -> "blackjack_toggle")
      const economyMatch = config.match(/^(BLACKJACK|COINFLIP|DAILY|STARTING|PLAYERKILLS|MISCKILLS|BOUNTY)-/);
      const isEconomyConfig = economyMatch !== null;
      
      // Extract Killfeed config from config (e.g., "KILLFEEDGAME" -> "killfeed")
      const killfeedMatch = config.match(/^(KILLFEEDGAME|KILLFEED-SETUP|KILLFEED-RANDOMIZER)$/);
      const isKillfeedConfig = killfeedMatch !== null;
      
      // Extract Position config from config (e.g., "OUTPOST" -> "outpost" or "OUTPOST-DELAY" -> "outpost")
      const positionMatch = config.match(/^(OUTPOST|BANDIT)(?:-|$)/);
      const positionType = positionMatch ? positionMatch[1].toLowerCase() : null;
      const isPositionConfig = positionMatch !== null;
      
      // Check if this is a position enable/disable command (no suffix)
      const isPositionEnableConfig = isPositionConfig && !config.includes('-');
      
      // Extract Crate Event config from config (e.g., "CRATE-1" -> "crate-1" or "CRATE-1-TIME" -> "crate-1")
      const crateMatch = config.match(/^(CRATE-[1-4])(?:-|$)/);
      const crateType = crateMatch ? crateMatch[1].toLowerCase() : null;
      const isCrateConfig = crateMatch !== null;
      
      // Extract ZORP config from config (e.g., "ZORP-USELIST" -> "zorp")
      const zorpMatch = config.match(/^ZORP-/);
      const isZorpConfig = zorpMatch !== null;
      
      // Extract Prison System config from config (e.g., "Prison-System", "Prison-Z-Size", "Prison-Z-Color" -> "prison")
      const prisonMatch = config.match(/^Prison-/);
      const isPrisonConfig = prisonMatch !== null;
      
      // Extract Recycler config from config (e.g., "RECYCLER-USE" -> "recycler")
      const recyclerMatch = config.match(/^RECYCLER-/);
      const isRecyclerConfig = recyclerMatch !== null;
      
      // Extract HOMETP config from config (e.g., "HOMETP-USE" -> "hometp")
      const hometpMatch = config.match(/^HOMETP-/);
      const isHometpConfig = hometpMatch !== null;
      
      // Extract config type, handling crate events properly
      let configType = '';
      if (isCrateConfig) {
        // For crate events, check if there's a suffix after the crate number
        const crateParts = config.split('-');
        if (crateParts.length >= 3) {
          // e.g., "CRATE-1-TIME" -> "TIME"
          configType = crateParts[2];
        } else {
          // e.g., "CRATE-1" -> "" (empty for enable/disable)
          configType = '';
        }
      } else if (isPrisonConfig) {
        // For Prison configs, set configType to the full config name
        configType = config;
      } else {
        // For other configs, use the original logic
        const parts = config.split('-');
        if (parts.length >= 3) {
          // e.g., "BAR-FUEL-AMOUNT" -> "FUEL-AMOUNT"
          configType = parts.slice(1).join('-');
        } else {
          // e.g., "BAR-USE" -> "USE"
          configType = parts[1] || '';
        }
      }

      // Get server using shared helper
      const server = await getServerByNickname(guildId, serverOption);
      console.log(`[SET COMMAND DEBUG] Server lookup result:`, server);
      console.log(`[SET COMMAND DEBUG] Config analysis:`, {
        config,
        configType,
        isCrateConfig,
        teleportMatch: !!teleportMatch,
        eventMatch: !!eventMatch,
        isBarConfig,
        isPositionConfig,
        isEconomyConfig,
        isZorpConfig,
        isRecyclerConfig,
        isHometpConfig
      });
      
      if (!server) {
        return await interaction.reply({
          content: `❌ Server not found: ${serverOption}`,
          ephemeral: true
        });
      }

      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      // Handle teleport configurations
      if (teleportMatch) {
        // Check if config exists, create if not
        const [existingConfig] = await connection.execute(
          'SELECT * FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
          [server.id.toString(), teleport]
        );

        if (existingConfig.length === 0) {
          await connection.execute(`
            INSERT INTO teleport_configs (server_id, teleport_name, enabled, cooldown_minutes, delay_minutes, display_name, use_list, use_delay, use_kit, kit_name, position_x, position_y, position_z)
            VALUES (?, ?, false, 60, 0, ?, false, false, false, '', 0, 0, 0)
          `, [server.id.toString(), teleport, teleport.toUpperCase()]);
        }
      }
      
      // Handle event configurations
      if (eventMatch) {
        // Check if event config exists, create if not
        const [existingEventConfig] = await connection.execute(
          'SELECT * FROM event_configs WHERE server_id = ? AND event_type = ?',
          [server.id.toString(), eventType]
        );

        if (existingEventConfig.length === 0) {
          await connection.execute(`
            INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
            VALUES (?, ?, false, ?, ?)
          `, [
            server.id.toString(),
            eventType,
            eventType === 'bradley' ? '<color=#00ffff>Brad got taken</color>' : '<color=#00ffff>Heli got taken</color>',
            eventType === 'bradley' ? '<color=#00ffff>Bradley APC has respawned</color>' : '<color=#00ffff>Patrol Helicopter has respawned</color>'
          ]);
        }
      }
      
      // Handle BAR configurations
      if (isBarConfig) {
        // Check if BAR config exists, create if not
        const [existingBarConfig] = await connection.execute(
          'SELECT * FROM rider_config WHERE server_id = ?',
          [server.id.toString()]
        );

        if (existingBarConfig.length === 0) {
          await connection.execute(`
            INSERT INTO rider_config (server_id, enabled, cooldown, horse_enabled, rhib_enabled, mini_enabled, car_enabled, fuel_amount, use_list) 
            VALUES (?, 1, 300, 1, 1, 0, 0, 100, 0)
          `, [server.id.toString()]);
        }
      }
      
      // Handle Position configurations
      if (isPositionConfig) {
        // Check if position config exists, create if not
        const [existingPositionConfig] = await connection.execute(
          'SELECT * FROM position_configs WHERE server_id = ? AND position_type = ?',
          [server.id.toString(), positionType]
        );

        if (existingPositionConfig.length === 0) {
          await connection.execute(`
            INSERT INTO position_configs (server_id, position_type, enabled, delay_seconds, cooldown_minutes, created_at, updated_at) 
            VALUES (?, ?, true, 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [server.id.toString(), positionType]);
        }
      }
      
      // Handle Crate Event configurations
      if (isCrateConfig) {
        // Check if crate event config exists, create if not
        const [existingCrateConfig] = await connection.execute(
          'SELECT * FROM crate_event_configs WHERE server_id = ? AND crate_type = ?',
          [server.id.toString(), crateType]
        );

        if (existingCrateConfig.length === 0) {
          await connection.execute(`
            INSERT INTO crate_event_configs (server_id, crate_type, enabled, spawn_interval_minutes, spawn_amount, spawn_message, created_at, updated_at) 
            VALUES (?, ?, false, 60, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [server.id.toString(), crateType, `<b><size=45><color=#00FF00>CRATE EVENT SPAWNED</color></size></b>`]);
        }
      }
      
      // Handle Recycler configurations
      if (isRecyclerConfig) {
        // Check if recycler config exists, create if not
        const [existingRecyclerConfig] = await connection.execute(
          'SELECT * FROM recycler_configs WHERE server_id = ?',
          [server.id.toString()]
        );

        if (existingRecyclerConfig.length === 0) {
          await connection.execute(`
            INSERT INTO recycler_configs (server_id, enabled, use_list, cooldown_minutes, created_at, updated_at) 
            VALUES (?, false, false, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [server.id.toString()]);
        }
      }
      
      // Handle ZORP configurations
      if (isZorpConfig) {
        // Check if ZORP config exists, create if not
        const [existingZorpConfig] = await connection.execute(
          'SELECT * FROM zorp_configs WHERE server_id = ?',
          [server.id.toString()]
        );

        if (existingZorpConfig.length === 0) {
          await connection.execute(`
            INSERT INTO zorp_configs (server_id, use_list) 
            VALUES (?, false)
          `, [server.id.toString()]);
        }
      }
      
      // Handle Prison System configurations
      if (isPrisonConfig) {
        // Check if prison config exists, create if not
        const [existingPrisonConfig] = await connection.execute(
          'SELECT * FROM prison_configs WHERE server_id = ?',
          [server.id.toString()]
        );

        if (existingPrisonConfig.length === 0) {
          await connection.execute(`
            INSERT INTO prison_configs (server_id, enabled) 
            VALUES (?, false)
          `, [server.id.toString()]);
        }
      }
      
      // Handle HOMETP configurations
      if (isHometpConfig) {
        // Check if home teleport config exists, create if not
        const [existingHometpConfig] = await connection.execute(
          'SELECT * FROM home_teleport_configs WHERE server_id = ?',
          [server.id.toString()]
        );

        if (existingHometpConfig.length === 0) {
          await connection.execute(`
            INSERT INTO home_teleport_configs (server_id, enabled, use_list, cooldown_minutes, created_at, updated_at) 
            VALUES (?, false, false, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [server.id.toString()]);
        }
      }
      
      // Handle Economy configurations
      if (isEconomyConfig) {
        // Get currency name for this server
        const { getCurrencyName } = require('../../utils/economy');
        const currencyName = await getCurrencyName(server.id.toString());
        
        // Convert config name to database format
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
        
        // Validate and process the option value
        let settingValue = '';
        let message = '';
        
        if (config.includes('TOGGLE')) {
          const enabled = option.toLowerCase() === 'on' || option.toLowerCase() === 'true' || option === '1';
          settingValue = enabled ? 'true' : 'false';
          const gameType = config.includes('BLACKJACK') ? 'Blackjack' : config.includes('COINFLIP') ? 'Coinflip' : 'Bounty system';
          message = `${gameType} has been ${enabled ? 'enabled' : 'disabled'} on ${server.nickname}.`;
          
          // Handle bounty toggle specifically
          if (config === 'BOUNTY-TOGGLE') {
            await connection.execute(
              `INSERT INTO bounty_configs (server_id, enabled) 
               VALUES (?, ?) 
               ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
              [server.id.toString(), enabled]
            );
          }
        } else if (config.includes('AMOUNT') || config.includes('BALANCE') || config.includes('REWARDS') || config.includes('MIN') || config.includes('MAX')) {
          const amount = parseInt(option);
          if (isNaN(amount) || amount < 0) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid amount. Must be a positive number.`,
              ephemeral: true
            });
          }
          settingValue = amount.toString();
          
          if (config === 'DAILY-AMOUNT') {
            message = `Daily reward amount has been set to ${amount} ${currencyName} on ${server.nickname}.`;
          } else if (config === 'STARTING-BALANCE') {
            message = `Starting balance has been set to ${amount} ${currencyName} on ${server.nickname}.`;
          } else if (config === 'PLAYERKILLS-AMOUNT') {
            message = `Player kills reward has been set to ${amount} ${currencyName} on ${server.nickname}.`;
          } else if (config === 'MISCKILLS-AMOUNT') {
            message = `Scientist kills reward has been set to ${amount} ${currencyName} on ${server.nickname}.`;
          } else if (config === 'BOUNTY-REWARDS') {
            message = `Bounty reward has been set to ${amount} ${currencyName} on ${server.nickname}.`;
            
            // Handle bounty rewards specifically
            await connection.execute(
              `INSERT INTO bounty_configs (server_id, reward_amount) 
               VALUES (?, ?) 
               ON DUPLICATE KEY UPDATE reward_amount = VALUES(reward_amount)`,
              [server.id.toString(), amount]
            );
          } else if (config.includes('BLACKJACK')) {
            const limitType = config.includes('MIN') ? 'minimum' : 'maximum';
            message = `Blackjack ${limitType} bet has been set to ${amount} ${currencyName} on ${server.nickname}.`;
          } else if (config.includes('COINFLIP')) {
            const limitType = config.includes('MIN') ? 'minimum' : 'maximum';
            message = `Coinflip ${limitType} bet has been set to ${amount} ${currencyName} on ${server.nickname}.`;
          }
        }
        
        // Insert or update the configuration
        await connection.execute(
          `INSERT INTO eco_games_config (server_id, setting_name, setting_value) 
           VALUES (?, ?, ?) 
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [server.id.toString(), settingName, settingValue]
        );
        
        await connection.end();
        
        return await interaction.reply({
          content: `✅ ${message}`,
          ephemeral: true
        });
      }

      // Handle Killfeed configurations
      if (isKillfeedConfig) {
        // Check if killfeed config exists, create if not
        let [killfeedResult] = await connection.execute(
          'SELECT id, enabled, format_string, randomizer_enabled FROM killfeed_configs WHERE server_id = ?',
          [server.id.toString()]
        );

        if (killfeedResult.length === 0) {
          // Create new killfeed config with default format
          const defaultFormat = '{Killer} ☠️ {Victim}';
          await connection.execute(
            'INSERT INTO killfeed_configs (server_id, enabled, format_string, randomizer_enabled) VALUES (?, false, ?, false)',
            [server.id.toString(), defaultFormat]
          );
          [killfeedResult] = await connection.execute(
            'SELECT id, enabled, format_string, randomizer_enabled FROM killfeed_configs WHERE server_id = ?',
            [server.id.toString()]
          );
        }

        const killfeed = killfeedResult[0];

        if (config === 'KILLFEEDGAME') {
          // Handle killfeed on/off
          const enabled = option.toLowerCase() === 'on' || option.toLowerCase() === 'true' || option === '1';
          
          await connection.execute(
            'UPDATE killfeed_configs SET enabled = ? WHERE id = ?',
            [enabled, killfeed.id]
          );

          // Get server connection info for RCON
          const [serverInfo] = await connection.execute(
            'SELECT ip, port, password FROM rust_servers WHERE id = ?',
            [server.id.toString()]
          );

          if (serverInfo.length > 0) {
            const { ip, port, password } = serverInfo[0];
            const { sendRconCommand } = require('../../rcon');
            
            if (enabled) {
              // Enable custom killfeed - disable game's default killfeed
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Hide"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Off"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Stop"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "false"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
              console.log(`✅ Disabled game's default killfeed for ${server.nickname}`);
            } else {
              // Disable custom killfeed - enable game's default killfeed
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Show"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "On"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Start"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "true"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
              sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
              console.log(`✅ Enabled game's default killfeed for ${server.nickname}`);
            }
          }

          await connection.end();
          
          return await interaction.reply({
            content: `✅ **${server.nickname}** killfeed has been **${enabled ? 'enabled' : 'disabled'}**.`,
            ephemeral: true
          });
        } else if (config === 'KILLFEED-SETUP') {
          // Handle killfeed format string
          if (option.trim().length === 0) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Format string cannot be empty.`,
              ephemeral: true
            });
          }

          await connection.execute(
            'UPDATE killfeed_configs SET format_string = ? WHERE id = ?',
            [option.trim(), killfeed.id]
          );

          // Create preview of the format
          const preview = option.trim()
            .replace(/{Killer}/g, 'Player1')
            .replace(/{Victim}/g, 'Player2')
            .replace(/{KillerKD}/g, '5.2')
            .replace(/{VictimKD}/g, '2.1')
            .replace(/{KillerStreak}/g, '3')
            .replace(/{VictimStreak}/g, '1')
            .replace(/{KillerHighest}/g, '8')
            .replace(/{VictimHighest}/g, '4');

          await connection.end();
          
          return await interaction.reply({
            content: `✅ **${server.nickname}** killfeed format updated to: \`${option.trim()}\`\n\n**Preview:** ${preview}\n\n**Available placeholders:** {Killer}, {Victim}, {KillerKD}, {VictimKD}, {KillerStreak}, {VictimStreak}, {KillerHighest}, {VictimHighest}`,
            ephemeral: true
          });
        } else if (config === 'KILLFEED-RANDOMIZER') {
          // Handle killfeed randomizer on/off
          const randomizerEnabled = option.toLowerCase() === 'on' || option.toLowerCase() === 'true' || option === '1';
          
          await connection.execute(
            'UPDATE killfeed_configs SET randomizer_enabled = ? WHERE id = ?',
            [randomizerEnabled, killfeed.id]
          );

          await connection.end();
          
          return await interaction.reply({
            content: `✅ **${server.nickname}** killfeed randomizer has been **${randomizerEnabled ? 'enabled' : 'disabled'}**.`,
            ephemeral: true
          });
        }
      }

      // Validate option based on config type
      let validatedOption = option;
      let coords = null; // Declare coords variable outside switch
      
      switch (configType) {
        case 'FUEL-AMOUNT':
          const fuelAmountValue = parseInt(option);
          if (isNaN(fuelAmountValue) || fuelAmountValue < 0) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for FUEL-AMOUNT. Use a positive number`,
              ephemeral: true
            });
          }
          validatedOption = fuelAmountValue;
          break;
        case 'RECYCLER-TIME':
          const recyclerTimeValue = parseInt(option);
          if (isNaN(recyclerTimeValue) || recyclerTimeValue < 0) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for RECYCLER-TIME. Use a positive number (minutes)`,
              ephemeral: true
            });
          }
          validatedOption = recyclerTimeValue;
          break;
        case 'USE':
        case 'USELIST':
        case 'USE-DELAY':
        case 'USE-KIT':
        case 'SCOUT':
        case 'ENABLE':
        case 'ON':
        case 'OUTPOST':
        case 'BANDIT':
        case 'HORSE':
        case 'RHIB':
        case 'MINI':
        case 'CAR':
        case 'RECYCLER-USE':
        case 'RECYCLER-USELIST':
        case 'ZORP-USELIST':
        case 'HOMETP-USE':
        case 'HOMETP-USELIST':
        case 'Prison-System':
        case '':
          if (!['on', 'off', 'true', 'false'].includes(option.toLowerCase())) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for ${configType || 'enable/disable'}. Use: on/off or true/false`,
              ephemeral: true
            });
          }
          validatedOption = option.toLowerCase();
          break;
        case 'Prison-Z-Size':
          const sizeValue = parseInt(option);
          if (isNaN(sizeValue) || sizeValue < 10 || sizeValue > 200) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for Prison-Z-Size. Use a number between 10 and 200`,
              ephemeral: true
            });
          }
          validatedOption = sizeValue;
          break;
        case 'Prison-Z-Color':
          // Validate color format (R,G,B) where each value is 0-255
          const colorMatch = option.match(/^\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/);
          if (!colorMatch) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid color format for Prison-Z-Color. Use: (R,G,B) (e.g., (255,0,0) for red)`,
              ephemeral: true
            });
          }
          const r = parseInt(colorMatch[1]);
          const g = parseInt(colorMatch[2]);
          const b = parseInt(colorMatch[3]);
          if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid color values. Each RGB value must be between 0 and 255`,
              ephemeral: true
            });
          }
          validatedOption = option;
          break;
        case 'TIME':
        case 'DELAYTIME':
        case 'COOLDOWN':
        case 'HOMETP-TIME':
          const timeValue = parseInt(option);
          if (isNaN(timeValue) || timeValue < 0) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for ${configType}. Use a positive number (minutes)`,
              ephemeral: true
            });
          }
          validatedOption = timeValue;
          break;
        case 'AMOUNT':
          const amountValue = parseInt(option);
          if (isNaN(amountValue) || amountValue < 1 || amountValue > 2) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for AMOUNT. Use a number between 1 and 2`,
              ephemeral: true
            });
          }
          validatedOption = amountValue;
          break;
        case 'DELAY':
          const delayValue = parseInt(option);
          if (isNaN(delayValue) || delayValue < 0) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for DELAY. Use a positive number (seconds)`,
              ephemeral: true
            });
          }
          validatedOption = delayValue;
          break;
        case 'NAME':
        case 'KITNAME':
        case 'KILLMSG':
        case 'RESPAWNMSG':
        case 'MSG':
          if (option.trim().length === 0) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for ${configType}. Message cannot be empty`,
              ephemeral: true
            });
          }
          validatedOption = option.trim();
          break;
        case 'COORDINATES':
          coords = option.split(',').map(coord => parseFloat(coord.trim()));
          if (coords.length !== 3 || coords.some(isNaN)) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid coordinates format. Use: x,y,z (e.g., 100,50,200)`,
              ephemeral: true
            });
          }
          break;
        default:
          await connection.end();
          return await interaction.reply({
            content: `❌ Unknown config type: ${configType}`,
            ephemeral: true
          });
      }

      // Update the config
      let updateQuery = '';
      let updateParams = [];

      console.log(`[SET COMMAND DEBUG] About to switch on configType: "${configType}"`);
      
      switch (configType) {
        case 'USE':
          if (isBarConfig) {
            updateQuery = 'UPDATE rider_config SET enabled = ? WHERE server_id = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          } else if (isRecyclerConfig) {
            updateQuery = 'UPDATE recycler_configs SET enabled = ? WHERE server_id = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
            console.log(`[SET COMMAND DEBUG] RECYCLER-USE: validatedOption=${validatedOption}, boolean=${validatedOption === 'on' || validatedOption === 'true'}`);
          } else {
            updateQuery = 'UPDATE teleport_configs SET enabled = ? WHERE server_id = ? AND teleport_name = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), teleport];
          }
          break;
        case 'USELIST':
          if (isBarConfig) {
            updateQuery = 'UPDATE rider_config SET use_list = ? WHERE server_id = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          }
          break;
        case 'ENABLE':
        case '':
          if (isPositionConfig) {
            updateQuery = 'UPDATE position_configs SET enabled = ? WHERE server_id = ? AND position_type = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), positionType];
          } else if (isCrateConfig) {
            updateQuery = 'UPDATE crate_event_configs SET enabled = ? WHERE server_id = ? AND crate_type = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), crateType];
          }
          break;
        case 'OUTPOST':
        case 'BANDIT':
          if (isPositionEnableConfig) {
            updateQuery = 'UPDATE position_configs SET enabled = ? WHERE server_id = ? AND position_type = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), positionType];
          }
          break;
        case 'ON':
          if (isCrateConfig) {
            updateQuery = 'UPDATE crate_event_configs SET enabled = ? WHERE server_id = ? AND crate_type = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), crateType];
          }
          break;
        case 'TIME':
          if (isCrateConfig) {
            updateQuery = 'UPDATE crate_event_configs SET spawn_interval_minutes = ? WHERE server_id = ? AND crate_type = ?';
            updateParams = [validatedOption, server.id.toString(), crateType];
          } else if (isRecyclerConfig) {
            updateQuery = 'UPDATE recycler_configs SET cooldown_minutes = ? WHERE server_id = ?';
            updateParams = [validatedOption, server.id.toString()];
            console.log(`[SET COMMAND DEBUG] RECYCLER-TIME: validatedOption=${validatedOption}`);
          } else {
            updateQuery = 'UPDATE teleport_configs SET cooldown_minutes = ? WHERE server_id = ? AND teleport_name = ?';
            updateParams = [validatedOption, server.id.toString(), teleport];
          }
          break;
        case 'DELAYTIME':
          updateQuery = 'UPDATE teleport_configs SET delay_minutes = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, server.id.toString(), teleport];
          break;
        case 'DELAY':
          if (isPositionConfig) {
            updateQuery = 'UPDATE position_configs SET delay_seconds = ? WHERE server_id = ? AND position_type = ?';
            updateParams = [validatedOption, server.id.toString(), positionType];
          }
          break;
        case 'AMOUNT':
          if (isCrateConfig) {
            updateQuery = 'UPDATE crate_event_configs SET spawn_amount = ? WHERE server_id = ? AND crate_type = ?';
            updateParams = [validatedOption, server.id.toString(), crateType];
          }
          break;
        case 'MSG':
          if (isCrateConfig) {
            updateQuery = 'UPDATE crate_event_configs SET spawn_message = ? WHERE server_id = ? AND crate_type = ?';
            updateParams = [validatedOption, server.id.toString(), crateType];
          }
          break;
        case 'NAME':
          updateQuery = 'UPDATE teleport_configs SET display_name = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, server.id.toString(), teleport];
          break;
        case 'USELIST':
          if (isZorpConfig) {
            updateQuery = 'UPDATE zorp_configs SET use_list = ? WHERE server_id = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
            console.log(`[SET COMMAND DEBUG] ZORP-USELIST: validatedOption=${validatedOption}, boolean=${validatedOption === 'on' || validatedOption === 'true'}`);
          } else if (isRecyclerConfig) {
            updateQuery = 'UPDATE recycler_configs SET use_list = ? WHERE server_id = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
            console.log(`[SET COMMAND DEBUG] RECYCLER-USELIST: validatedOption=${validatedOption}, boolean=${validatedOption === 'on' || validatedOption === 'true'}`);
          } else {
            updateQuery = 'UPDATE teleport_configs SET use_list = ? WHERE server_id = ? AND teleport_name = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), teleport];
          }
          break;
        case 'USE-DELAY':
          updateQuery = 'UPDATE teleport_configs SET use_delay = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), teleport];
          break;
        case 'USE-KIT':
          updateQuery = 'UPDATE teleport_configs SET use_kit = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), teleport];
          break;
        case 'KITNAME':
          updateQuery = 'UPDATE teleport_configs SET kit_name = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, server.id.toString(), teleport];
          break;
        case 'COOLDOWN':
          if (isBarConfig) {
            updateQuery = 'UPDATE rider_config SET cooldown = ? WHERE server_id = ?';
            updateParams = [validatedOption, server.id.toString()];
          } else if (isPositionConfig) {
            updateQuery = 'UPDATE position_configs SET cooldown_minutes = ? WHERE server_id = ? AND position_type = ?';
            updateParams = [validatedOption, server.id.toString(), positionType];
          }
          break;
        case 'HORSE':
          if (isBarConfig) {
            updateQuery = 'UPDATE rider_config SET horse_enabled = ? WHERE server_id = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          }
          break;
        case 'RHIB':
          if (isBarConfig) {
            updateQuery = 'UPDATE rider_config SET rhib_enabled = ? WHERE server_id = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          }
          break;
        case 'MINI':
          if (isBarConfig) {
            updateQuery = 'UPDATE rider_config SET mini_enabled = ? WHERE server_id = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          }
          break;
        case 'CAR':
          if (isBarConfig) {
            updateQuery = 'UPDATE rider_config SET car_enabled = ? WHERE server_id = ?';
            updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          }
          break;

        case 'FUEL-AMOUNT':
          if (isBarConfig) {
            updateQuery = 'UPDATE rider_config SET fuel_amount = ? WHERE server_id = ?';
            updateParams = [validatedOption, server.id.toString()];
          }
          break;
        case 'COORDINATES':
          updateQuery = 'UPDATE teleport_configs SET position_x = ?, position_y = ?, position_z = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [coords[0], coords[1], coords[2], server.id.toString(), teleport];
          break;
          
        // Event configurations
        case 'SCOUT':
          updateQuery = 'UPDATE event_configs SET enabled = ? WHERE server_id = ? AND event_type = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), eventType];
          break;
        case 'KILLMSG':
          updateQuery = 'UPDATE event_configs SET kill_message = ? WHERE server_id = ? AND event_type = ?';
          updateParams = [validatedOption, server.id.toString(), eventType];
          break;
        case 'RESPAWNMSG':
          updateQuery = 'UPDATE event_configs SET respawn_message = ? WHERE server_id = ? AND event_type = ?';
          updateParams = [validatedOption, server.id.toString(), eventType];
          break;
          
        // Recycler configurations
        case 'RECYCLER-USE':
          updateQuery = 'UPDATE recycler_configs SET enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          break;
        case 'RECYCLER-USELIST':
          updateQuery = 'UPDATE recycler_configs SET use_list = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          console.log(`[SET COMMAND DEBUG] RECYCLER-USELIST: validatedOption=${validatedOption}, boolean=${validatedOption === 'on' || validatedOption === 'true'}`);
          break;
        case 'RECYCLER-TIME':
          updateQuery = 'UPDATE recycler_configs SET cooldown_minutes = ? WHERE server_id = ?';
          updateParams = [validatedOption, server.id.toString()];
          break;
          
        // ZORP configurations
        case 'ZORP-USELIST':
          updateQuery = 'UPDATE zorp_configs SET use_list = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          console.log(`[SET COMMAND DEBUG] ZORP-USELIST: validatedOption=${validatedOption}, boolean=${validatedOption === 'on' || validatedOption === 'true'}`);
          break;
          
        // Prison System configurations
        case 'Prison-System':
          updateQuery = 'UPDATE prison_configs SET enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          console.log(`[SET COMMAND DEBUG] Prison-System: validatedOption=${validatedOption}, boolean=${validatedOption === 'on' || validatedOption === 'true'}`);
          break;
        case 'Prison-Z-Size':
          const sizeValue = parseInt(option);
          if (isNaN(sizeValue) || sizeValue < 10 || sizeValue > 200) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for Prison-Z-Size. Use a number between 10 and 200`,
              ephemeral: true
            });
          }
          updateQuery = 'UPDATE prison_configs SET zone_size = ? WHERE server_id = ?';
          updateParams = [sizeValue, server.id.toString()];
          console.log(`[SET COMMAND DEBUG] Prison-Z-Size: sizeValue=${sizeValue}`);
          break;
        case 'Prison-Z-Color':
          // Validate color format (R,G,B) where each value is 0-255
          const colorMatch = option.match(/^\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/);
          if (!colorMatch) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid color format for Prison-Z-Color. Use: (R,G,B) (e.g., (255,0,0) for red)`,
              ephemeral: true
            });
          }
          const r = parseInt(colorMatch[1]);
          const g = parseInt(colorMatch[2]);
          const b = parseInt(colorMatch[3]);
          if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid color values. Each RGB value must be between 0 and 255`,
              ephemeral: true
            });
          }
          updateQuery = 'UPDATE prison_configs SET zone_color = ? WHERE server_id = ?';
          updateParams = [option, server.id.toString()];
          console.log(`[SET COMMAND DEBUG] Prison-Z-Color: color=${option}`);
          break;
          
        // HOMETP configurations
        case 'HOMETP-USE':
          updateQuery = 'UPDATE home_teleport_configs SET enabled = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          console.log(`[SET COMMAND DEBUG] HOMETP-USE: validatedOption=${validatedOption}, boolean=${validatedOption === 'on' || validatedOption === 'true'}`);
          break;
        case 'HOMETP-USELIST':
          updateQuery = 'UPDATE home_teleport_configs SET use_list = ? WHERE server_id = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString()];
          console.log(`[SET COMMAND DEBUG] HOMETP-USELIST: validatedOption=${validatedOption}, boolean=${validatedOption === 'on' || validatedOption === 'true'}`);
          break;
        case 'HOMETP-TIME':
          updateQuery = 'UPDATE home_teleport_configs SET cooldown_minutes = ? WHERE server_id = ?';
          updateParams = [validatedOption, server.id.toString()];
          console.log(`[SET COMMAND DEBUG] HOMETP-TIME: validatedOption=${validatedOption}`);
          break;
      }

      console.log(`[SET COMMAND DEBUG] Executing query: ${updateQuery}`);
      console.log(`[SET COMMAND DEBUG] Parameters:`, updateParams);
      console.log(`[SET COMMAND DEBUG] Server ID: ${server.id}, Server Name: ${server.nickname}`);
      
      try {
        await connection.execute(updateQuery, updateParams);
        console.log(`[SET COMMAND DEBUG] Query executed successfully`);
      } catch (error) {
        console.error(`[SET COMMAND DEBUG] Query failed:`, error.message);
        throw error;
      }
      
      // Verify the update worked
      let verifyField = 'enabled';
      let verifyTable = 'teleport_configs';
      let verifyId = teleport;
      let verifyIdField = 'teleport_name';
      
      if (teleportMatch) {
        // Teleport configuration verification
        if (configType === 'USE-KIT') verifyField = 'use_kit';
        else if (configType === 'USELIST') verifyField = 'use_list';
        else if (configType === 'USE-DELAY') verifyField = 'use_delay';
        else if (configType === 'TIME') verifyField = 'cooldown_minutes';
        else if (configType === 'DELAYTIME') verifyField = 'delay_minutes';
        else if (configType === 'NAME') verifyField = 'display_name';
        else if (configType === 'KITNAME') verifyField = 'kit_name';
      } else if (eventMatch) {
        // Event configuration verification
        verifyTable = 'event_configs';
        verifyId = eventType;
        verifyIdField = 'event_type';
        
        if (configType === 'KILLMSG') verifyField = 'kill_message';
        else if (configType === 'RESPAWNMSG') verifyField = 'respawn_message';
      } else if (isBarConfig) {
        // BAR configuration verification
        verifyTable = 'rider_config';
        verifyId = server.id.toString();
        verifyIdField = 'server_id';
        
        if (configType === 'COOLDOWN') verifyField = 'cooldown';
      } else if (isPositionConfig) {
        // Position configuration verification
        verifyTable = 'position_configs';
        verifyId = positionType;
        verifyIdField = 'position_type';
        
        if (configType === 'ENABLE' || configType === '' || configType === 'OUTPOST' || configType === 'BANDIT') verifyField = 'enabled';
        else if (configType === 'DELAY') verifyField = 'delay_seconds';
        else if (configType === 'COOLDOWN') verifyField = 'cooldown_minutes';
      } else if (isCrateConfig) {
        // Crate Event configuration verification
        verifyTable = 'crate_event_configs';
        verifyId = crateType;
        verifyIdField = 'crate_type';
        
        if (configType === 'ON' || configType === '') verifyField = 'enabled';
        else if (configType === 'TIME') verifyField = 'spawn_interval_minutes';
        else if (configType === 'AMOUNT') verifyField = 'spawn_amount';
        else if (configType === 'MSG') verifyField = 'spawn_message';
      } else if (configType === 'RECYCLER-USE' || configType === 'RECYCLER-USELIST' || configType === 'RECYCLER-TIME') {
        // Recycler configuration verification
        verifyTable = 'recycler_configs';
        verifyId = server.id.toString();
        verifyIdField = 'server_id';
        
        if (configType === 'RECYCLER-USE') verifyField = 'enabled';
        else if (configType === 'RECYCLER-USELIST') verifyField = 'use_list';
        else if (configType === 'RECYCLER-TIME') verifyField = 'cooldown_minutes';
      } else if (configType === 'ZORP-USELIST') {
        // ZORP configuration verification
        verifyTable = 'zorp_configs';
        verifyId = server.id.toString();
        verifyIdField = 'server_id';
        verifyField = 'use_list';
      } else if (configType === 'HOMETP-USE') {
        // HOMETP configuration verification
        verifyTable = 'home_teleport_configs';
        verifyId = server.id.toString();
        verifyIdField = 'server_id';
        verifyField = 'enabled';
      } else if (configType === 'HOMETP-USELIST') {
        // HOMETP configuration verification
        verifyTable = 'home_teleport_configs';
        verifyId = server.id.toString();
        verifyIdField = 'server_id';
        verifyField = 'use_list';
      } else if (configType === 'HOMETP-TIME') {
        // HOMETP configuration verification
        verifyTable = 'home_teleport_configs';
        verifyId = server.id.toString();
        verifyIdField = 'server_id';
        verifyField = 'cooldown_minutes';
      } else if (configType === 'Prison-System') {
        // Prison System configuration verification
        verifyTable = 'prison_configs';
        verifyId = server.id.toString();
        verifyIdField = 'server_id';
        verifyField = 'enabled';
        
        // Handle prison zone creation/deletion
        const prisonSystem = require('../../utils/prisonSystem');
        const { sendRconCommand } = require('../../rcon');
        
        if (validatedOption === 'on' || validatedOption === 'true') {
          // Prison system enabled - create zone
          console.log(`[SET COMMAND DEBUG] Prison system enabled, creating zone for server ${server.id}`);
          await prisonSystem.createPrisonZone(server.id.toString(), server.ip, server.port, server.password, sendRconCommand);
        } else {
          // Prison system disabled - delete zone
          console.log(`[SET COMMAND DEBUG] Prison system disabled, deleting zone for server ${server.id}`);
          await prisonSystem.deletePrisonZone(server.id.toString(), server.ip, server.port, server.password, sendRconCommand);
        }
      }
      
      const [verifyResult] = await connection.execute(
        `SELECT ${verifyField} FROM ${verifyTable} WHERE ${verifyIdField} = ?`,
        [verifyId]
      );
      
      if (verifyResult.length > 0) {
        console.log(`[SET COMMAND DEBUG] Verification - ${verifyField} after update: ${verifyResult[0][verifyField]}`);
      }
      
      await connection.end();

      // Create success message
      let successMessage = `✅ **${config}** set to **${validatedOption}** on **${server.nickname}**`;
      if (configType === 'COORDINATES') {
        successMessage = `✅ **${config}** set to **${coords[0]}, ${coords[1]}, ${coords[2]}** on **${server.nickname}**`;
      } else if (eventMatch) {
        successMessage = `✅ **${config}** set to **${validatedOption}** on **${server.nickname}**`;
      } else if (isBarConfig) {
        successMessage = `✅ **${config}** set to **${validatedOption}** on **${server.nickname}**`;
      } else if (isPositionConfig) {
        successMessage = `✅ **${config}** set to **${validatedOption}** on **${server.nickname}**`;
      } else if (isCrateConfig) {
        successMessage = `✅ **${config}** set to **${validatedOption}** on **${server.nickname}**`;
      } else if (isPrisonConfig) {
        successMessage = `✅ **${config}** set to **${validatedOption}** on **${server.nickname}**`;
      }

      await interaction.reply({
        content: successMessage,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in set command:', error);
      await interaction.reply({
        content: `❌ An error occurred while setting the configuration: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
