const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage, getLinkedPlayer } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allow-link')
    .setDescription('Allow a player to link their Discord account')
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
        // Fallback: find by IGN
        const pool = require('../../db');
        const playerResult = await pool.query(
          `SELECT p.id, p.discord_id, p.ign, rs.nickname as server_name, p.server_id
           FROM players p
           JOIN rust_servers rs ON p.server_id = rs.id
           JOIN guilds g ON rs.guild_id = g.id
           WHERE g.discord_id = $1 AND p.ign ILIKE $2
           ORDER BY p.ign`,
          [guildId, playerName]
        );
        if (playerResult.rows.length > 0) player = playerResult.rows[0];
      }
      if (!player) {
        return interaction.editReply({
          embeds: [orangeEmbed('Player Not Found', `No player found with name "${playerName}" in this guild.`)]
        });
      }
      // Clear discord_id to allow relinking
      await pool.query('UPDATE players SET discord_id = NULL WHERE id = $1', [player.id]);
      await interaction.editReply({
        embeds: [successEmbed(
          'Link Reset',
          `**Player:** ${player.ign || 'Unknown'}\n**Server:** ${player.server_name || 'Unknown'}\n\nThis player can now use \`/link <in-game-name>\` to link their Discord account to their in-game character.`
        )]
      });

    } catch (error) {
      console.error('Error allowing link:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to process link request. Please try again.')]
      });
    }
  },
}; 