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
          { name: 'USE-KIT (Use Kit)', value: 'USE-KIT' },
          { name: 'KITNAME (Kit Name)', value: 'KITNAME' },
          { name: 'COORDINATES (Teleport Location)', value: 'COORDINATES' }
        ];
        
        const allOptions = [];
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
      const config = interaction.options.getString('config');
      const option = interaction.options.getString('option');
      const serverOption = interaction.options.getString('server');
      const guildId = interaction.guildId;

      // Extract teleport name from config (e.g., "TPNE-USE" -> "tpne")
      const teleportMatch = config.match(/^(TPN|TPNE|TPE|TPSE|TPS|TPSW|TPW|TPNW)-/);
      const teleport = teleportMatch ? teleportMatch[1].toLowerCase() : 'default';
      const configType = config.split('-')[1]; // e.g., "USE", "TIME"

      // Get server using shared helper
      const server = await getServerByNickname(guildId, serverOption);
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

      // Validate option based on config type
      let validatedOption = option;
      let coords = null; // Declare coords variable outside switch
      
      switch (configType) {
        case 'USE':
        case 'USELIST':
        case 'USE-DELAY':
        case 'USE-KIT':
          if (!['on', 'off', 'true', 'false'].includes(option.toLowerCase())) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for ${configType}. Use: on/off or true/false`,
              ephemeral: true
            });
          }
          validatedOption = option.toLowerCase();
          break;
        case 'TIME':
        case 'DELAYTIME':
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
        case 'NAME':
        case 'KITNAME':
          if (option.trim().length === 0) {
            await connection.end();
            return await interaction.reply({
              content: `❌ Invalid value for ${configType}. Name cannot be empty`,
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

      switch (configType) {
        case 'USE':
          updateQuery = 'UPDATE teleport_configs SET enabled = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), teleport];
          break;
        case 'TIME':
          updateQuery = 'UPDATE teleport_configs SET cooldown_minutes = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, server.id.toString(), teleport];
          break;
        case 'DELAYTIME':
          updateQuery = 'UPDATE teleport_configs SET delay_minutes = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, server.id.toString(), teleport];
          break;
        case 'NAME':
          updateQuery = 'UPDATE teleport_configs SET display_name = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption, server.id.toString(), teleport];
          break;
        case 'USELIST':
          updateQuery = 'UPDATE teleport_configs SET use_list = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), teleport];
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

        case 'COORDINATES':
          updateQuery = 'UPDATE teleport_configs SET position_x = ?, position_y = ?, position_z = ? WHERE server_id = ? AND teleport_name = ?';
          updateParams = [coords[0], coords[1], coords[2], server.id.toString(), teleport];
          break;
      }

      console.log(`[SET COMMAND DEBUG] Executing query: ${updateQuery}`);
      console.log(`[SET COMMAND DEBUG] Parameters:`, updateParams);
      
      await connection.execute(updateQuery, updateParams);
      
      // Verify the update worked
      let verifyField = 'enabled';
      if (configType === 'USE-KIT') verifyField = 'use_kit';
      else if (configType === 'USELIST') verifyField = 'use_list';
      else if (configType === 'USE-DELAY') verifyField = 'use_delay';
      else if (configType === 'TIME') verifyField = 'cooldown_minutes';
      else if (configType === 'DELAYTIME') verifyField = 'delay_minutes';
      else if (configType === 'NAME') verifyField = 'display_name';
      else if (configType === 'KITNAME') verifyField = 'kit_name';
      
      const [verifyResult] = await connection.execute(
        `SELECT ${verifyField} FROM teleport_configs WHERE server_id = ? AND teleport_name = ?`,
        [server.id.toString(), teleport]
      );
      
      if (verifyResult.length > 0) {
        console.log(`[SET COMMAND DEBUG] Verification - ${verifyField} after update: ${verifyResult[0][verifyField]}`);
      }
      
      await connection.end();

      // Create success message
      let successMessage = `✅ **${config}** set to **${validatedOption}** on **${server.nickname}**`;
      if (configType === 'COORDINATES') {
        successMessage = `✅ **${config}** set to **${coords[0]}, ${coords[1]}, ${coords[2]}** on **${server.nickname}**`;
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
