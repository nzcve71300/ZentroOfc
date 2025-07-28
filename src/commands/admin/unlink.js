const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage, getLinkedPlayer, getPlayerByIGN } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player\'s Discord account')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Player name (Discord username or in-game name)')
        .setRequired(true)
        .setMaxLength(50)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const playerName = interaction.options.getString('name');
    const guildId = interaction.guildId;

    try {
      // Find player by Discord username or in-game name
      // (Assume admin provides Discord ID for precision, or fallback to IGN)
      let player = null;
      if (/^\d{17,}$/.test(playerName)) { // Discord ID
        const pool = require('../../db');
        const serverResult = await pool.query(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) LIMIT 1',
          [guildId]
        );
        if (serverResult.rows.length > 0) {
          player = await getLinkedPlayer(guildId, serverResult.rows[0].id, playerName);
        }
      }
      if (!player) {
        // Fallback: find by IGN (old logic)
        const pool = require('../../db');
        const serverResult = await pool.query(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) LIMIT 1',
          [guildId]
        );
        if (serverResult.rows.length > 0) {
          player = await getPlayerByIGN(guildId, serverResult.rows[0].id, playerName);
        }
      }
      if (!player) {
        return interaction.editReply({
          embeds: [orangeEmbed('Player Not Found', `No player found with name "${playerName}" in this guild.`)]
        });
      }
      // Unlink player by clearing discord_id
      await pool.query('UPDATE players SET discord_id = NULL WHERE id = $1', [player.id]);
      // If player has no IGN and no Discord ID, delete the row
      const updatedPlayer = await pool.query('SELECT * FROM players WHERE id = $1', [player.id]);
      if (updatedPlayer.rows.length > 0) {
        const p = updatedPlayer.rows[0];
        if (!p.ign && !p.discord_id) {
          await pool.query('DELETE FROM players WHERE id = $1', [player.id]);
        }
      }
      await interaction.editReply({
        embeds: [successEmbed(
          'Account Unlinked',
          `**Player:** ${player.ign || 'Unknown'}\n**Server:** ${player.server_id || 'Unknown'}\n\nAccount has been unlinked successfully.`
        )]
      });

    } catch (error) {
      console.error('Error unlinking player:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to unlink player. Please try again.')]
      });
    }
  },
}; 