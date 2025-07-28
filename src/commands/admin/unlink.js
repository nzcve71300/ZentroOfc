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
      // Get all servers for this guild
      const serverResult = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)',
        [guildId]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed('No Servers Found', 'No Rust servers found for this Discord.')]
        });
      }

      let unlinkedCount = 0;
      let playerNames = [];

      // Check if input is a Discord ID
      const isDiscordId = /^\d{17,}$/.test(playerName);

      for (const server of serverResult.rows) {
        let player = null;
        
        if (isDiscordId) {
          // Search by Discord ID across all servers
          player = await getLinkedPlayer(guildId, server.id, playerName);
        } else {
          // Search by IGN across all servers
          player = await getPlayerByIGN(guildId, server.id, playerName);
        }

        if (player && player.discord_id) {
          await pool.query('UPDATE players SET discord_id = NULL WHERE id = $1', [player.id]);
          unlinkedCount++;
          playerNames.push(player.ign || 'Unknown');
        }
      }

      if (unlinkedCount === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed('Player Not Found', `No linked player found with name "${playerName}".`)]
        });
      }

      const playerList = playerNames.join(', ');
      await interaction.editReply({
        embeds: [successEmbed('Unlinked', `**${unlinkedCount} account(s)** unlinked: **${playerList}**`)]
      });

    } catch (err) {
      console.error('Unlink error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to unlink player.')]
      });
    }
  }
};
