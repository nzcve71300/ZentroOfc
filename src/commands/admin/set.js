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
          { name: 'TPN-COORDINATES', value: 'TPN-COORDINATES' },
          { name: 'TPNE-USE', value: 'TPNE-USE' },
          { name: 'TPNE-TIME', value: 'TPNE-TIME' },
          { name: 'TPNE-DELAYTIME', value: 'TPNE-DELAYTIME' },
          { name: 'TPNE-NAME', value: 'TPNE-NAME' },
          { name: 'TPNE-USELIST', value: 'TPNE-USELIST' },
          { name: 'TPNE-USE-DELAY', value: 'TPNE-USE-DELAY' },
          { name: 'TPNE-USE-KIT', value: 'TPNE-USE-KIT' },
          { name: 'TPNE-KITNAME', value: 'TPNE-KITNAME' },
          { name: 'TPNE-KILL', value: 'TPNE-KILL' },
          { name: 'TPNE-COORDINATES', value: 'TPNE-COORDINATES' },
          { name: 'TPE-USE', value: 'TPE-USE' },
          { name: 'TPE-TIME', value: 'TPE-TIME' },
          { name: 'TPE-DELAYTIME', value: 'TPE-DELAYTIME' },
          { name: 'TPE-NAME', value: 'TPE-NAME' },
          { name: 'TPE-USELIST', value: 'TPE-USELIST' },
          { name: 'TPE-USE-DELAY', value: 'TPE-USE-DELAY' },
          { name: 'TPE-USE-KIT', value: 'TPE-USE-KIT' },
          { name: 'TPE-KITNAME', value: 'TPE-KITNAME' },
          { name: 'TPE-KILL', value: 'TPE-KILL' },
          { name: 'TPE-COORDINATES', value: 'TPE-COORDINATES' },
          { name: 'TPSE-USE', value: 'TPSE-USE' },
          { name: 'TPSE-TIME', value: 'TPSE-TIME' },
          { name: 'TPSE-DELAYTIME', value: 'TPSE-DELAYTIME' },
          { name: 'TPSE-NAME', value: 'TPSE-NAME' },
          { name: 'TPSE-USELIST', value: 'TPSE-USELIST' },
          { name: 'TPSE-USE-DELAY', value: 'TPSE-USE-DELAY' },
          { name: 'TPSE-USE-KIT', value: 'TPSE-USE-KIT' },
          { name: 'TPSE-KITNAME', value: 'TPSE-KITNAME' },
          { name: 'TPSE-KILL', value: 'TPSE-KILL' },
          { name: 'TPSE-COORDINATES', value: 'TPSE-COORDINATES' },
          { name: 'TPS-USE', value: 'TPS-USE' },
          { name: 'TPS-TIME', value: 'TPS-TIME' },
          { name: 'TPS-DELAYTIME', value: 'TPS-DELAYTIME' },
          { name: 'TPS-NAME', value: 'TPS-NAME' },
          { name: 'TPS-USELIST', value: 'TPS-USELIST' },
          { name: 'TPS-USE-DELAY', value: 'TPS-USE-DELAY' },
          { name: 'TPS-USE-KIT', value: 'TPS-USE-KIT' },
          { name: 'TPS-KITNAME', value: 'TPS-KITNAME' },
          { name: 'TPS-KILL', value: 'TPS-KILL' },
          { name: 'TPS-COORDINATES', value: 'TPS-COORDINATES' },
          { name: 'TPSW-USE', value: 'TPSW-USE' },
          { name: 'TPSW-TIME', value: 'TPSW-TIME' },
          { name: 'TPSW-DELAYTIME', value: 'TPSW-DELAYTIME' },
          { name: 'TPSW-NAME', value: 'TPSW-NAME' },
          { name: 'TPSW-USELIST', value: 'TPSW-USELIST' },
          { name: 'TPSW-USE-DELAY', value: 'TPSW-USE-DELAY' },
          { name: 'TPSW-USE-KIT', value: 'TPSW-USE-KIT' },
          { name: 'TPSW-KITNAME', value: 'TPSW-KITNAME' },
          { name: 'TPSW-KILL', value: 'TPSW-KILL' },
          { name: 'TPSW-COORDINATES', value: 'TPSW-COORDINATES' },
          { name: 'TPW-USE', value: 'TPW-USE' },
          { name: 'TPW-TIME', value: 'TPW-TIME' },
          { name: 'TPW-DELAYTIME', value: 'TPW-DELAYTIME' },
          { name: 'TPW-NAME', value: 'TPW-NAME' },
          { name: 'TPW-USELIST', value: 'TPW-USELIST' },
          { name: 'TPW-USE-DELAY', value: 'TPW-USE-DELAY' },
          { name: 'TPW-USE-KIT', value: 'TPW-USE-KIT' },
          { name: 'TPW-KITNAME', value: 'TPW-KITNAME' },
          { name: 'TPW-KILL', value: 'TPW-KILL' },
          { name: 'TPW-COORDINATES', value: 'TPW-COORDINATES' },
          { name: 'TPNW-USE', value: 'TPNW-USE' },
          { name: 'TPNW-TIME', value: 'TPNW-TIME' },
          { name: 'TPNW-DELAYTIME', value: 'TPNW-DELAYTIME' },
          { name: 'TPNW-NAME', value: 'TPNW-NAME' },
          { name: 'TPNW-USELIST', value: 'TPNW-USELIST' },
          { name: 'TPNW-USE-DELAY', value: 'TPNW-USE-DELAY' },
          { name: 'TPNW-USE-KIT', value: 'TPNW-USE-KIT' },
          { name: 'TPNW-KITNAME', value: 'TPNW-KITNAME' },
          { name: 'TPNW-KILL', value: 'TPNW-KILL' },
          { name: 'TPNW-COORDINATES', value: 'TPNW-COORDINATES' }
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

      // Extract teleport name from config (e.g., "TPNE-USE" -> "tpne")
      const teleportMatch = config.match(/^(TPN|TPNE|TPE|TPSE|TPS|TPSW|TPW|TPNW)-/);
      const teleport = teleportMatch ? teleportMatch[1].toLowerCase() : 'default';

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
       
       // Extract the config type (e.g., "TPNE-USE" -> "USE")
       const configType = config.split('-')[1];
       
       switch (configType) {
         case 'USE':
         case 'USELIST':
         case 'USE-DELAY':
         case 'USE-KIT':
         case 'KILL':
           if (!['on', 'off'].includes(option.toLowerCase())) {
             await connection.end();
             return await interaction.reply({
               content: '❌ Option must be "on" or "off" for this configuration.',
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
               content: '❌ Time value must be a positive number.',
               ephemeral: true
             });
           }
           validatedOption = timeValue;
           break;
         
         case 'NAME':
         case 'KITNAME':
           if (option.length > 100) {
             await connection.end();
             return await interaction.reply({
               content: '❌ Name must be 100 characters or less.',
               ephemeral: true
             });
           }
           break;

         case 'COORDINATES':
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
        'SELECT * FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
        [server.id.toString(), teleport]
      );

      if (existingConfigs.length === 0) {
        // Create default config
        await connection.execute(`
          INSERT INTO teleport_configs (
            server_id, teleport_name, position_x, position_y, position_z, 
            enabled, cooldown_minutes, delay_minutes, display_name, 
            use_list, use_delay, use_kit, kit_name, kill_before_teleport
          ) VALUES (?, ?, 0, 0, 0, true, 60, 0, ?, false, false, false, NULL, false)
        `, [server.id.toString(), teleport, `${teleport.toUpperCase()} Teleport`]);
      }

             // Update the config
       let updateQuery = '';
       let updateParams = [];

       switch (configType) {
         case 'USE':
           updateQuery = 'UPDATE teleport_configs SET enabled = ? WHERE server_id = ? AND teleport_name = ?';
           updateParams = [validatedOption === 'on', server.id.toString(), teleport];
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
           updateParams = [validatedOption === 'on', server.id.toString(), teleport];
           break;
         case 'USE-DELAY':
           updateQuery = 'UPDATE teleport_configs SET use_delay = ? WHERE server_id = ? AND teleport_name = ?';
           updateParams = [validatedOption === 'on', server.id.toString(), teleport];
           break;
         case 'USE-KIT':
           updateQuery = 'UPDATE teleport_configs SET use_kit = ? WHERE server_id = ? AND teleport_name = ?';
           updateParams = [validatedOption === 'on', server.id.toString(), teleport];
           break;
         case 'KITNAME':
           updateQuery = 'UPDATE teleport_configs SET kit_name = ? WHERE server_id = ? AND teleport_name = ?';
           updateParams = [validatedOption, server.id.toString(), teleport];
           break;
         case 'KILL':
           updateQuery = 'UPDATE teleport_configs SET kill_before_teleport = ? WHERE server_id = ? AND teleport_name = ?';
           updateParams = [validatedOption === 'on', server.id.toString(), teleport];
           break;
         case 'COORDINATES':
           const coords = option.split(',').map(coord => parseFloat(coord.trim()));
           updateQuery = 'UPDATE teleport_configs SET position_x = ?, position_y = ?, position_z = ? WHERE server_id = ? AND teleport_name = ?';
           updateParams = [coords[0], coords[1], coords[2], server.id.toString(), teleport];
           break;
       }

      await connection.execute(updateQuery, updateParams);

             // Create success message
       let successMessage = `✅ **${config}** set to **${validatedOption}** for **${teleport.toUpperCase()}** on **${server.nickname}**`;
       
       if (configType === 'COORDINATES') {
         const coords = option.split(',').map(coord => parseFloat(coord.trim()));
         successMessage = `✅ **${config}** set to **${coords[0]}, ${coords[1]}, ${coords[2]}** for **${teleport.toUpperCase()}** on **${server.nickname}**`;
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
