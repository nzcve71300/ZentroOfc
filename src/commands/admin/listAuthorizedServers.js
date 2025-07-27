const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const authConfig = require('../../config/authorization');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-authorized-servers')
    .setDescription('List all servers authorized to use Zentro Bot (Owner only)'),

  async execute(interaction) {
    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, true);
    }

    // Only allow the bot owner to view authorized servers
    if (interaction.user.id !== '1252993829007528086') {
      return interaction.reply({
        embeds: [errorEmbed('Access Denied', 'Only the bot owner can view authorized servers.')],
        ephemeral: true
      });
    }

    try {
      let serverList = '';
      
      if (authConfig.allowAllGuilds) {
        serverList = '**All servers are currently allowed** (allowAllGuilds: true)\n\n' +
                   '⚠️ **Warning:** This means anyone can add your bot to their server.';
      } else if (authConfig.authorizedGuildIds.length === 0) {
        serverList = '**No servers are currently authorized**\n\n' +
                   'Use `/authorize-server` to add authorized servers.';
      } else {
        serverList = `**${authConfig.authorizedGuildIds.length} authorized server(s):**\n\n`;
        
        authConfig.authorizedGuildIds.forEach((guildId, index) => {
          // Extract server name from comment if available
          const commentMatch = guildId.match(/\/\/ (.+)$/);
          const serverName = commentMatch ? commentMatch[1] : 'Unknown Server';
          const cleanGuildId = guildId.replace(/\/\/ .+$/, '').replace(/['"]/g, '').trim();
          
          serverList += `**${index + 1}.** ${serverName}\n`;
          serverList += `   • **ID:** ${cleanGuildId}\n\n`;
        });
      }

      await interaction.reply({
        embeds: [orangeEmbed(
          '🔐 Authorized Servers',
          serverList
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error listing authorized servers:', error);
      await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to list authorized servers. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 