const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

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

    try {
      const result = await pool.query(
        `UPDATE players 
         SET discord_id = NULL 
         WHERE id IN (
           SELECT p.id 
           FROM players p 
           JOIN rust_servers rs ON p.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = $1 AND (p.ign ILIKE $2 OR p.discord_id = $2)
         ) RETURNING ign`,
        [guildId, playerName]
      );

      if (result.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed('Player Not Found', `No player found with name "${playerName}".`)]
        });
      }

      await interaction.editReply({
        embeds: [successEmbed('Relink Enabled', `**${result.rows[0].ign || playerName}** can now relink.`)]
      });

    } catch (err) {
      console.error('Allow-link error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to allow relink.')]
      });
    }
  }
};
