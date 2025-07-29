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
        .setRequired(TRUE)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, FALSE);

    const guildId = interaction.guildId;
    const identifier = interaction.options.getString('name');

    try {
      // Unlink all players for this identifier
      const result = await unlinkAllPlayersByIdentifier(guildId, identifier);

      if (result.affectedRows === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Players Found', `❌ No matching player found to unlink for **${identifier}**.\n\nMake sure you're using the correct Discord ID or in-game name.`)]
        });
      }

      const embed = successEmbed(
        'Players Unlinked', 
        `✅ Successfully unlinked **${result.affectedRows} player(s)** for **${identifier}**.`
      );

      // Show which servers were affected
      const serverNames = [...new Set(result.map(p => p.nickname))];
      if (serverNames.length > 0) {
        embed.addFields({ name: 'Servers Affected', value: serverNames.join(', ') });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in unlink:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to unlink player. Please try again.')] });
    }
  }
};
