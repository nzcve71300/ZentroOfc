const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show top 12 players with the most kills on a server (Admin only)')
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

      // Get top 20 players with kills (including unlinked players)
      const [topPlayers] = await pool.query(
        `SELECT p.ign, p.discord_id, ps.kills, ps.deaths, ps.kill_streak, ps.highest_streak, p.linked_at,
                COALESCE(ppt.total_minutes, 0) as total_minutes
         FROM players p
         JOIN player_stats ps ON p.id = ps.player_id
         LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
         AND p.server_id = ?
         AND ps.kills > 0
         ORDER BY ps.kills DESC, ps.deaths ASC
         LIMIT 20`,
        [guildId, server.id]
      );

      if (topPlayers.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'No Players Found',
            `No players with kill statistics found on **${serverName}**.\n\nPlayers need to have kills to appear on the leaderboard.`
          )]
        });
      }

      // Create embed with enhanced design
      const embed = {
        color: 0xFFD700, // Gold color for leaderboard
        title: `🏆 Kill Leaderboard - ${serverName}`,
        description: `Here are the top ${topPlayers.length} players with kills:`,
        thumbnail: {
          url: 'https://cdn.discordapp.com/emojis/🏆.png'
        },
        fields: [],
        timestamp: new Date().toISOString(),
        footer: {
          text: `Last updated • ${new Date().toLocaleString()}`,
          icon_url: 'https://cdn.discordapp.com/emojis/📊.png'
        }
      };

      // Add each player to the embed
      for (let i = 0; i < topPlayers.length; i++) {
        const player = topPlayers[i];
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        
        // Calculate K/D ratio
        const kdRatio = player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills.toString();
        
        // Format playtime
        const hours = Math.floor(player.total_minutes / 60);
        const minutes = player.total_minutes % 60;
        const playtimeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        
        // Show link status
        const linkStatus = player.discord_id ? '🔗 Linked' : '🔓 Unlinked';
        
        // Add visual indicators based on performance
        const killEmoji = player.kills > 100 ? '💀' : player.kills > 50 ? '⚔️' : player.kills > 10 ? '🗡️' : '🔪';
        const deathEmoji = player.deaths > 100 ? '💀' : player.deaths > 50 ? '💔' : player.deaths > 10 ? '💥' : '💀';
        const kdEmoji = parseFloat(kdRatio) > 2 ? '🔥' : parseFloat(kdRatio) > 1 ? '⚡' : parseFloat(kdRatio) > 0.5 ? '⚖️' : '📉';
        const streakEmoji = player.highest_streak > 20 ? '🔥' : player.highest_streak > 10 ? '⚡' : player.highest_streak > 5 ? '💪' : '🎯';
        
        embed.fields.push({
          name: `${medal} ${player.ign} ${linkStatus}`,
          value: `\`\`\`\n${killEmoji} Kills: ${player.kills.toString().padStart(6)} | ${deathEmoji} Deaths: ${player.deaths.toString().padStart(6)}\n${kdEmoji} K/D: ${kdRatio.padStart(8)} | ⏰ Playtime: ${playtimeText.padStart(8)}\n${streakEmoji} Current: ${player.kill_streak.toString().padStart(3)} | Best: ${player.highest_streak.toString().padStart(3)}\`\`\``,
          inline: false
        });
      }

      // Add total players count and statistics (including unlinked players)
      const [totalStats] = await pool.query(
        `SELECT COUNT(*) as total_players,
                SUM(ps.kills) as total_kills,
                SUM(ps.deaths) as total_deaths
         FROM players p
         JOIN player_stats ps ON p.id = ps.player_id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
         AND p.server_id = ?
         AND ps.kills > 0`,
        [guildId, server.id]
      );

      const stats = totalStats[0];
      const serverKD = stats.total_deaths > 0 ? (stats.total_kills / stats.total_deaths).toFixed(2) : stats.total_kills.toString();

      embed.fields.push({
        name: '📊 Server Statistics',
        value: `\`\`\`\nTotal Players: ${stats.total_players.toLocaleString()}\nTotal Kills:  ${(stats.total_kills || 0).toLocaleString()}\nTotal Deaths: ${(stats.total_deaths || 0).toLocaleString()}\nServer K/D:   ${serverKD}\`\`\``,
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in leaderboard:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to fetch leaderboard. Please try again.')]
      });
    }
  }
};
