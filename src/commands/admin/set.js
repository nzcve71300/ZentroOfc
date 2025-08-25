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
        .setDescription('Select the configuration option')
        .setRequired(true)
        .addChoices(
          { name: 'TPN-USE', value: 'TPN-USE' },
          { name: 'TPN-TIME', value: 'TPN-TIME' },
          { name: 'TPN-DELAYTIME', value: 'TPN-DELAYTIME' },
          { name: 'TPN-NAME', value: 'TPN-NAME' },
          { name: 'TPN-USELIST', value: 'TPN-USELIST' },
          { name: 'TPN-USE-DELAY', value: 'TPN-USE-DELAY' },
          { name: 'TPN-USE-KIT', value: 'TPN-USE-KIT' },
          { name: 'TPN-KITNAME', value: 'TPN-KITNAME' },
          { name: 'TPN-KILL', value: 'TPN-KILL' },
          { name: 'TPN-COORDINATES', value: 'TPN-COORDINATES' }
        ))
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
    const guildId = interaction.guildId;
    
    try {
      const servers = await getServersForGuild(guildId);
      const filtered = servers.filter(s => s.nickname.toLowerCase().includes(focusedValue.toLowerCase()));
      await interaction.respond(filtered.map(s => ({ name: s.nickname, value: s.nickname })));
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

      // Validate option based on config type
      let validatedOption = option;
      switch (config) {
        case 'TPN-USE':
        case 'TPN-USELIST':
        case 'TPN-USE-DELAY':
        case 'TPN-USE-KIT':
        case 'TPN-KILL':
          if (!['on', 'off'].includes(option.toLowerCase())) {
            await connection.end();
            return await interaction.reply({
              content: '❌ Option must be "on" or "off" for this configuration.',
              ephemeral: true
            });
          }
          validatedOption = option.toLowerCase();
          break;
        
        case 'TPN-TIME':
        case 'TPN-DELAYTIME':
          const timeValue = parseInt(option);
          if (isNaN(timeValue) || timeValue < 0) {
            await connection.end();
            return await interaction.reply({
              content: '❌ Time value must be a positive number.',
              ephemeral: true
            });
          }
          validatedOption = timeValue;
          break;
        
        case 'TPN-NAME':
        case 'TPN-KITNAME':
          if (option.length > 100) {
            await connection.end();
            return await interaction.reply({
              content: '❌ Name must be 100 characters or less.',
              ephemeral: true
            });
          }
          break;

        case 'TPN-COORDINATES':
          // Validate coordinate format: "x,y,z"
          const coordRegex = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
          if (!coordRegex.test(option)) {
            await connection.end();
            return await interaction.reply({
              content: '❌ Coordinates must be in format: "x,y,z" (e.g., "100.5,50.2,200.0")',
              ephemeral: true
            });
          }
          
          // Parse coordinates
          const coords = option.split(',').map(coord => parseFloat(coord.trim()));
          if (coords.length !== 3) {
            await connection.end();
            return await interaction.reply({
              content: '❌ Invalid coordinate format. Use: "x,y,z"',
              ephemeral: true
            });
          }
          
          validatedOption = option; // Keep as string for display
          break;
      }

      // Check if config exists
      const [existingConfigs] = await connection.execute(
        'SELECT * FROM teleport_configs WHERE server_id = ? AND teleport_name = "default"',
        [server.id.toString()]
      );

      if (existingConfigs.length === 0) {
        // Create default config
        await connection.execute(`
          INSERT INTO teleport_configs (
            server_id, teleport_name, position_x, position_y, position_z, 
            enabled, cooldown_minutes, delay_minutes, display_name, 
            use_list, use_delay, use_kit, kit_name, kill_before_teleport
          ) VALUES (?, 'default', 0, 0, 0, true, 60, 0, 'Teleport', false, false, false, NULL, false)
        `, [server.id.toString()]);
      }

      // Update the config
      let updateQuery = '';
      let updateParams = [];

      switch (config) {
        case 'TPN-USE':
          updateQuery = 'UPDATE teleport_configs SET enabled = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [validatedOption === 'on', server.id.toString()];
          break;
        case 'TPN-TIME':
          updateQuery = 'UPDATE teleport_configs SET cooldown_minutes = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [validatedOption, server.id.toString()];
          break;
        case 'TPN-DELAYTIME':
          updateQuery = 'UPDATE teleport_configs SET delay_minutes = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [validatedOption, server.id.toString()];
          break;
        case 'TPN-NAME':
          updateQuery = 'UPDATE teleport_configs SET display_name = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [validatedOption, server.id.toString()];
          break;
        case 'TPN-USELIST':
          updateQuery = 'UPDATE teleport_configs SET use_list = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [validatedOption === 'on', server.id.toString()];
          break;
        case 'TPN-USE-DELAY':
          updateQuery = 'UPDATE teleport_configs SET use_delay = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [validatedOption === 'on', server.id.toString()];
          break;
        case 'TPN-USE-KIT':
          updateQuery = 'UPDATE teleport_configs SET use_kit = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [validatedOption === 'on', server.id.toString()];
          break;
        case 'TPN-KITNAME':
          updateQuery = 'UPDATE teleport_configs SET kit_name = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [validatedOption, server.id.toString()];
          break;
        case 'TPN-KILL':
          updateQuery = 'UPDATE teleport_configs SET kill_before_teleport = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [validatedOption === 'on', server.id.toString()];
          break;
        case 'TPN-COORDINATES':
          const coords = option.split(',').map(coord => parseFloat(coord.trim()));
          updateQuery = 'UPDATE teleport_configs SET position_x = ?, position_y = ?, position_z = ? WHERE server_id = ? AND teleport_name = "default"';
          updateParams = [coords[0], coords[1], coords[2], server.id.toString()];
          break;
      }

      await connection.execute(updateQuery, updateParams);

      // Create success message
      let successMessage = `✅ **${config}** set to **${validatedOption}** for **${server.nickname}**`;
      
      if (config === 'TPN-COORDINATES') {
        const coords = option.split(',').map(coord => parseFloat(coord.trim()));
        successMessage = `✅ **${config}** set to **${coords[0]}, ${coords[1]}, ${coords[2]}** for **${server.nickname}**`;
      }

      await interaction.reply({
        content: successMessage,
        ephemeral: true
      });

      await connection.end();

    } catch (error) {
      console.error('Error in set command:', error);
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
