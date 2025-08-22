const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear-killfeed')
    .setDescription('Clear all kills and deaths for all players on a server (Admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');

    try {
      // Get server info
      const [serverResult] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, serverName]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const server = serverResult[0];

      // Get count of players that will be affected
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as player_count, 
                SUM(ps.kills) as total_kills, 
                SUM(ps.deaths) as total_deaths
         FROM players p
         JOIN player_stats ps ON p.id = ps.player_id
         WHERE p.server_id = ? AND p.is_active = true`,
        [server.id]
      );

      const stats = countResult[0];

      if (stats.player_count === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'No Data Found',
            `No player statistics found on **${serverName}**.\n\nThere's nothing to clear!`
          )]
        });
      }

      // Clear all kills, deaths, kill streaks, and highest streaks for all players on this server
      const [updateResult] = await pool.query(
        `UPDATE player_stats ps
         JOIN players p ON ps.player_id = p.id
         SET ps.kills = 0, ps.deaths = 0, ps.kill_streak = 0, ps.highest_streak = 0
         WHERE p.server_id = ? AND p.is_active = true`,
        [server.id]
      );

      // Create success embed
      const embed = successEmbed(
        `🧹 Killfeed Cleared - ${serverName}`,
        `Successfully cleared all kill/death statistics!\n\n**Statistics Reset:**\n` +
        `• **Players affected:** ${stats.player_count.toLocaleString()}\n` +
        `• **Total kills cleared:** ${(stats.total_kills || 0).toLocaleString()}\n` +
        `• **Total deaths cleared:** ${(stats.total_deaths || 0).toLocaleString()}\n\n` +
        `All players now have a fresh start with 0 kills and 0 deaths.`
      );

      embed.setFooter({ 
        text: `Cleared by ${interaction.user.username} • ${new Date().toLocaleString()}` 
      });

      await interaction.editReply({ embeds: [embed] });

      console.log(`[ADMIN] ${interaction.user.username} cleared killfeed for ${serverName} - ${stats.player_count} players affected`);

    } catch (error) {
      console.error('Error in clear-killfeed:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to clear killfeed. Please try again.')]
      });
    }
  }
};
