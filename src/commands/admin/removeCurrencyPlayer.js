const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getServerByNickname, getPlayerByIGN, updateBalance, recordTransaction } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-currency-player')
    .setDescription('Remove currency from a specific player')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('player_name')
        .setDescription('Player\'s in-game name')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of currency to remove')
        .setRequired(true)
        .setMinValue(1)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const { getServersForGuild } = require('../../utils/economy');
      const choices = await getServersForGuild(guildId, focusedValue);
      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply({ flags: 64 });

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const playerName = interaction.options.getString('player_name');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    try {
      // Get server info using shared helper
      const server = await getServerByNickname(guildId, serverNickname);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Find player by IGN using shared helper
      const player = await getPlayerByIGN(guildId, server.id, playerName);
      if (!player) {
        return interaction.editReply({
          embeds: [orangeEmbed('Player Not Found', `Player **${playerName}** not found on **${server.nickname}**.`)]
        });
      }

      // Update balance using shared helper (negative amount for removal)
      const balanceResult = await updateBalance(player.id, -amount);
      if (!balanceResult.success) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', `Failed to update balance: ${balanceResult.error}`)]
        });
      }

      // Record transaction using shared helper
      await recordTransaction(player.id, -amount, 'admin_remove');

      // Create success embed with structured format
      const embed = successEmbed(
        'Currency Removed',
        `**Server:** ${server.nickname}\n**Player:** ${playerName}\n**Amount Removed:** -${amount}\n**Previous Balance:** ${balanceResult.oldBalance}\n**New Balance:** ${balanceResult.newBalance}`
      );

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error removing currency from player:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to remove currency from player. Please try again.')]
      });
    }
  },
}; 