const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const {
  getActivePlayerLinks,
  getActivePlayerLinksByIgn,
  unlinkAllPlayers,
  unlinkAllPlayersByIgn,
  unblockDiscordId,
  unblockIgn
} = require('../../utils/linking');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allow-link')
    .setDescription('Allow a player to relink their Discord account')
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
    const adminId = interaction.user.id;

    try {
      // Check if input is a Discord ID
      const isDiscordId = /^\d{17,}$/.test(playerName);
      
      let unlinkedLinks = [];
      let unblockedResult = null;
      let playerNames = [];

      if (isDiscordId) {
        // Allow relink by Discord ID
        unlinkedLinks = await unlinkAllPlayers(guildId, playerName);
        unblockedResult = await unblockDiscordId(guildId, playerName);
        playerNames = unlinkedLinks.map(link => link.ign);
      } else {
        // Allow relink by IGN
        unlinkedLinks = await unlinkAllPlayersByIgn(guildId, playerName);
        unblockedResult = await unblockIgn(guildId, playerName);
        playerNames = unlinkedLinks.map(link => link.ign);
      }

      // Check if any active links exist
      let existingLinks = [];
      if (isDiscordId) {
        existingLinks = await getActivePlayerLinks(guildId, playerName);
      } else {
        existingLinks = await getActivePlayerLinksByIgn(guildId, playerName);
      }

      if (unlinkedLinks.length === 0 && existingLinks.length === 0 && !unblockedResult) {
        return interaction.editReply({
          embeds: [orangeEmbed('Player Not Found', `No player found with name "${playerName}".`)]
        });
      }

      // Build response message
      let message = '';
      const actions = [];

      if (unlinkedLinks.length > 0) {
        const uniqueNames = [...new Set(playerNames)];
        actions.push(`**${unlinkedLinks.length} account(s)** unlinked: **${uniqueNames.join(', ')}**`);
      }

      if (existingLinks.length > 0) {
        const existingNames = existingLinks.map(link => link.ign);
        actions.push(`**${existingLinks.length} player(s)** found but not linked: **${existingNames.join(', ')}**`);
      }

      if (unblockedResult) {
        actions.push(`**Block removed** for ${isDiscordId ? 'Discord ID' : 'IGN'}`);
      }

      message = actions.join('\n');

      await interaction.editReply({
        embeds: [successEmbed('Relink Enabled', message)]
      });

    } catch (err) {
      console.error('Allow-link error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to allow relink.')]
      });
    }
  }
};
