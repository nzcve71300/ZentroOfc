const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage, getPlayerByIGN, getLinkedPlayer } = require('../../utils/permissions');
const pool = require('../../db');

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
      const serverResult = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)',
        [guildId]
      );

      let player = null;
      for (const server of serverResult.rows) {
        player = /^\d{17,}$/.test(playerName)
          ? await getLinkedPlayer(guildId, server.id, playerName)
          : await getPlayerByIGN(guildId, server.id, playerName);
        if (player) break;
      }

      if (!player) {
        return interaction.editReply({
          embeds: [orangeEmbed('Player Not Found', `No player found with name "${playerName}".`)]
        });
      }

      await pool.query('UPDATE players SET discord_id = NULL WHERE id = $1', [player.id]);

      await interaction.editReply({
        embeds: [successEmbed('Unlinked', `**${player.ign || 'Unknown'}** has been unlinked.`)]
      });

    } catch (err) {
      console.error('Unlink error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to unlink player.')]
      });
    }
  }
};
