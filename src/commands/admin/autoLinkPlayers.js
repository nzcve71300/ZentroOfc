const { SlashCommandBuilder } = require('discord.js');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { autoLinkPlayersToNewServer } = require('../../utils/autoPlayerLinking');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auto-link-players')
    .setDescription('Automatically link all players from existing servers to a target server')
    .addStringOption(option =>
      option.setName('target_server')
        .setDescription('The server nickname to link players TO')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      // Get servers for this guild
      const [servers] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = servers.map(server => ({
        name: server.nickname,
        value: server.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply();

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const targetServerNickname = interaction.options.getString('target_server');
    const guildId = interaction.guildId;

    try {
      // Get the target server details
      const [targetServer] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, targetServerNickname]
      );

      if (targetServer.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', `Server **${targetServerNickname}** not found in this guild.`)]
        });
      }

      const targetServerId = targetServer[0].id;

      // Check if this server already has players
      const [existingPlayers] = await pool.query(
        'SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = true',
        [targetServerId]
      );

      if (existingPlayers[0].count > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Already Has Players', 
            `Server **${targetServerNickname}** already has ${existingPlayers[0].count} active players.\n\nThis command is designed to link players to NEW servers. If you want to re-run auto-linking, please remove existing player links first.`)]
        });
      }

      // Start the auto-linking process
      console.log(`🚀 Starting manual auto-linking for server: ${targetServerNickname}`);
      const autoLinkResult = await autoLinkPlayersToNewServer(guildId, targetServerId, targetServerNickname);

      // Build response message
      let responseMessage = `🔗 **Auto-linking completed for ${targetServerNickname}**\n\n`;
      
      if (autoLinkResult.success) {
        if (autoLinkResult.linkedCount > 0) {
          responseMessage += `✅ **Successfully linked ${autoLinkResult.linkedCount} players!**\n\n`;
          responseMessage += `All players from other servers in this guild are now linked to **${targetServerNickname}** and can access it immediately.`;
          
          if (autoLinkResult.errors.length > 0) {
            responseMessage += `\n\n⚠️ **Note:** ${autoLinkResult.errors.length} errors occurred during linking (some players may not have been linked).`;
          }
        } else {
          responseMessage += `ℹ️ **No players found to link**\n\n`;
          responseMessage += `This server is the first server in the guild, so there are no existing players to auto-link.`;
        }
      } else {
        responseMessage += `❌ **Auto-linking failed**\n\n`;
        responseMessage += `**Players linked:** ${autoLinkResult.linkedCount}\n`;
        responseMessage += `**Errors:** ${autoLinkResult.errors.length}\n\n`;
        responseMessage += `Please check the console logs for detailed error information.`;
      }

      const responseEmbed = autoLinkResult.success && autoLinkResult.linkedCount > 0 
        ? successEmbed('Auto-linking Completed', responseMessage)
        : errorEmbed('Auto-linking Results', responseMessage);

      await interaction.editReply({ embeds: [responseEmbed] });

    } catch (error) {
      console.error('Error during auto-linking:', error);
      
      await interaction.editReply({
        embeds: [errorEmbed('Auto-linking Error', 
          `Failed to complete auto-linking: ${error.message}\n\nPlease check the console logs for more details.`)]
      });
    }
  },
};
