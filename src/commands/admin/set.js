const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');
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
          { name: 'TPN-KILL', value: 'TPN-KILL' }
        ))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Value for the configuration')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Server to configure (optional, uses current server if not specified)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const config = interaction.options.getString('config');
      const option = interaction.options.getString('option');
      const serverName = interaction.options.getString('server');

      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      // Get server ID
      let serverId;
      if (serverName) {
        const [servers] = await connection.execute(
          'SELECT id FROM rust_servers WHERE nickname = ?',
          [serverName]
        );
        if (servers.length === 0) {
          await connection.end();
          return await interaction.reply({
            content: `❌ Server "${serverName}" not found.`,
            ephemeral: true
          });
        }
        serverId = servers[0].id;
      } else {
        // Use current guild's server
        const [servers] = await connection.execute(
          'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ?',
          [interaction.guildId]
        );
        if (servers.length === 0) {
          await connection.end();
          return await interaction.reply({
            content: '❌ No server found for this Discord server.',
            ephemeral: true
          });
        }
        serverId = servers[0].id;
      }

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
      }

      // Update or insert the configuration
      await connection.execute(`
        INSERT INTO teleport_configs (server_id, teleport_name, ${config.toLowerCase()})
        VALUES (?, 'default', ?)
        ON DUPLICATE KEY UPDATE ${config.toLowerCase()} = VALUES(${config.toLowerCase()})
      `, [serverId.toString(), validatedOption]);

      await connection.end();

      const serverDisplay = serverName || 'current server';
      await interaction.reply({
        content: `✅ **${config}** set to **${validatedOption}** for **${serverDisplay}**`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in set command:', error);
      await interaction.reply({
        content: '❌ An error occurred while setting the configuration.',
        ephemeral: true
      });
    }
  },
};
