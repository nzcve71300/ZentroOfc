const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const {
  getActivePlayerLinks,
  getActivePlayerLinksByIgn,
  unlinkAllPlayers,
  unlinkAllPlayersByIgn
} = require('../../utils/linking');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player\'s Discord account')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Discord ID or in-game name')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const playerName = interaction.options.getString('name');
    const guildId = interaction.guildId;

    try {
      // Check if input is a Discord ID
      const isDiscordId = /^\d{17,}$/.test(playerName);
      
      let unlinkedLinks = [];
      let playerNames = [];

      if (isDiscordId) {
        // Unlink by Discord ID
        unlinkedLinks = await unlinkAllPlayers(guildId, playerName);
        playerNames = unlinkedLinks.map(link => link.ign);
      } else {
        // Unlink by IGN
        unlinkedLinks = await unlinkAllPlayersByIgn(guildId, playerName);
        playerNames = unlinkedLinks.map(link => link.ign);
      }

      if (unlinkedLinks.length === 0) {
        // Check if any active links exist
        let existingLinks = [];
        if (isDiscordId) {
          existingLinks = await getActivePlayerLinks(guildId, playerName);
        } else {
          existingLinks = await getActivePlayerLinksByIgn(guildId, playerName);
        }

        if (existingLinks.length === 0) {
          return interaction.editReply({
            embeds: [orangeEmbed('Player Not Found', `No player found with name "${playerName}".`)]
          });
        } else {
          const existingNames = existingLinks.map(link => link.ign);
          return interaction.editReply({
            embeds: [orangeEmbed('Already Unlinked', `**${existingLinks.length} player(s)** found but they are not currently linked: **${existingNames.join(', ')}**`)]
          });
        }
      }

      const uniqueNames = [...new Set(playerNames)];
      const message = `**${unlinkedLinks.length} account(s)** unlinked: **${uniqueNames.join(', ')}**`;

      await interaction.editReply({
        embeds: [successEmbed('Unlink Complete', message)]
      });

    } catch (err) {
      console.error('Unlink error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to unlink player.')]
      });
    }
  }
};
