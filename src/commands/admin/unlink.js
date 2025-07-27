const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
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
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'You need administrator permissions to use this command.')]
      });
    }

    const playerName = interaction.options.getString('name');
    const guildId = interaction.guildId;

    try {
      // Find player by Discord username or in-game name
      const playerResult = await pool.query(
        `SELECT p.id, p.discord_id, p.ign, rs.nickname as server_name
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE g.discord_id = $1 AND (p.ign ILIKE $2 OR p.discord_id = $2)
         ORDER BY p.ign`,
        [guildId, playerName]
      );

      if (playerResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Found', `No player found with name "${playerName}" in this guild.`)]
        });
      }

      if (playerResult.rows.length === 1) {
        // Unlink single player
        const player = playerResult.rows[0];
        await pool.query(
          'DELETE FROM players WHERE id = $1',
          [player.id]
        );

        await interaction.editReply({
          embeds: [successEmbed(
            'Account Unlinked',
            `**Player:** ${player.ign || 'Unknown'}\n**Server:** ${player.server_name}\n\nAccount has been unlinked successfully.`
          )]
        });
      } else {
        // Multiple players found - show options
        const embed = orangeEmbed(
          'Multiple Players Found',
          `Found ${playerResult.rows.length} players matching "${playerName}". Please be more specific:`
        );

        for (const player of playerResult.rows) {
          embed.addFields({
            name: `👤 ${player.ign || 'Unknown'}`,
            value: `**Server:** ${player.server_name}\n**Discord ID:** ${player.discord_id}`,
            inline: true
          });
        }

        await interaction.editReply({
          embeds: [embed]
        });
      }

    } catch (error) {
      console.error('Error unlinking player:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to unlink player. Please try again.')]
      });
    }
  },
}; 