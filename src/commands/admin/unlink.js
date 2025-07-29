const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { unlinkAllPlayersByDiscordId, unlinkAllPlayersByIgn } = require('../../utils/unifiedPlayerSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a Discord account or in-game name')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Discord username or in-game name')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const name = interaction.options.getString('name');

    try {
      // Try to unlink by Discord ID first (if it's a Discord ID)
      let unlinkedPlayers = await unlinkAllPlayersByDiscordId(guildId, name);
      
      // If no players found by Discord ID, try by IGN
      if (unlinkedPlayers.length === 0) {
        unlinkedPlayers = await unlinkAllPlayersByIgn(guildId, name);
      }

      if (unlinkedPlayers.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Not Found', `No active links found for **${name}**.`)]
        });
      }

      const embed = successEmbed(
        'Account Unlinked', 
        `Successfully unlinked **${name}** from **${unlinkedPlayers.length} server(s)**.`
      );

      // Show which servers were unlinked
      const serverNames = [...new Set(unlinkedPlayers.map(p => p.nickname))];
      embed.addFields({ name: 'Servers Affected', value: serverNames.join(', ') });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in unlink:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to unlink account. Please try again.')] });
    }
  }
};
