const { SlashCommandBuilder } = require('discord.js');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allow-link')
    .setDescription('Allow a player name to be linked (unblock from link_blocks)')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Player name to allow linking')
        .setRequired(true)),

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const playerName = interaction.options.getString('name');
    const guildId = interaction.guildId;

    try {
      // Get guild ID from database
      const [guildResult] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [guildId]
      );

      if (guildResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Guild Not Found', 'This guild is not registered in the database.')]
        });
      }

      const guildDbId = guildResult[0].id;

      // Check if player is blocked
      const [blockedResult] = await pool.query(
        'SELECT id, ign, blocked_by, reason FROM link_blocks WHERE guild_id = ? AND ign = ? AND is_active = TRUE',
        [guildDbId, playerName]
      );

      if (blockedResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Not Blocked', `**${playerName}** is not currently blocked from linking.`)]
        });
      }

      // Unblock the player
      await pool.query(
        'UPDATE link_blocks SET is_active = FALSE WHERE guild_id = ? AND ign = ? AND is_active = TRUE',
        [guildDbId, playerName]
      );

      const blockedBy = interaction.client.users.cache.get(blockedResult[0].blocked_by)?.username || 'Unknown';
      const reason = blockedResult[0].reason || 'No reason provided';

      await interaction.editReply({
        embeds: [successEmbed(
          'Player Unblocked',
          `**${playerName}** has been unblocked and can now be linked.\n\n**Previously blocked by:** ${blockedBy}\n**Reason:** ${reason}`
        )]
      });

    } catch (error) {
      console.error('Error allowing link:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to unblock player. Please try again.')]
      });
    }
  },
}; 