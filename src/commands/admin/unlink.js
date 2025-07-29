const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { unlinkAllPlayersByIdentifier } = require('../../utils/unifiedPlayerSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player from all servers')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Discord ID or in-game name of the player to unlink')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const identifier = interaction.options.getString('name');

    try {
      // Unlink all players for this identifier
      const result = await unlinkAllPlayersByIdentifier(guildId, identifier);

      if (result.rowCount === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Players Found', `❌ No matching player found to unlink for **${identifier}**.\n\nMake sure you're using the correct Discord ID or in-game name.`)]
        });
      }

      const embed = successEmbed(
        'Players Unlinked', 
        `✅ Successfully unlinked **${result.rowCount} player(s)** for **${identifier}**.`
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in unlink:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to unlink player. Please try again.')] });
    }
  }
};
