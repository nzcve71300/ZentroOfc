const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('authorize-server')
    .setDescription('Authorize a new server to use Zentro Bot (Owner only)')
    .addStringOption(option =>
      option.setName('guild_id')
        .setDescription('The Discord server ID to authorize')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('server_name')
        .setDescription('Name of the server (for reference)')
        .setRequired(false)),

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    // Only allow the bot owner to authorize servers
    if (interaction.user.id !== '1252993829007528086') {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'Only the bot owner can authorize new servers.')]
      });
    }

    const guildId = interaction.options.getString('guild_id');
    const serverName = interaction.options.getString('server_name') || 'Unknown Server';

    // Validate guild ID format
    if (!/^\d{17,19}$/.test(guildId)) {
      return interaction.editReply({
        embeds: [errorEmbed('Invalid Guild ID', 'Please provide a valid Discord server ID (17-19 digits).')]
      });
    }

    try {
      // Read current authorization config
      const configPath = path.join(__dirname, '../../config/authorization.js');
      let configContent = fs.readFileSync(configPath, 'utf8');

      // Check if guild ID is already authorized
      if (configContent.includes(guildId)) {
        return interaction.editReply({
          embeds: [errorEmbed('Already Authorized', `Server ID ${guildId} is already authorized.`)]
        });
      }

      // Add the new guild ID to the authorized list
      const newGuildEntry = `    '${guildId}', // ${serverName}`;
      
      // Find the authorizedGuildIds array and add the new entry
      const arrayStart = configContent.indexOf('authorizedGuildIds: [');
      const arrayEnd = configContent.indexOf('],', arrayStart);
      
      if (arrayStart === -1 || arrayEnd === -1) {
        return interaction.editReply({
          embeds: [errorEmbed('Config Error', 'Could not find authorizedGuildIds array in config file.')]
        });
      }

      // Insert the new guild ID
      const beforeArray = configContent.substring(0, arrayEnd);
      const afterArray = configContent.substring(arrayEnd);
      
      configContent = beforeArray + '\n' + newGuildEntry + afterArray;

      // Write the updated config back to file
      fs.writeFileSync(configPath, configContent);

      await interaction.editReply({
        embeds: [successEmbed(
          'Server Authorized',
          `✅ **${serverName}** (ID: ${guildId}) has been authorized!\n\n` +
          `The server can now add Zentro Bot and use all features.\n\n` +
          `**Note:** The bot will need to be restarted for this change to take effect.`
        )]
      });

    } catch (error) {
      console.error('Error authorizing server:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to authorize server. Please try again.')]
      });
    }
  },
}; 