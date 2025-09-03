const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your player profile and statistics')
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
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
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

      // Get player info with stats and playtime
      const [playerResult] = await pool.query(
        `SELECT p.*, rs.nickname as server_name,
                COALESCE(ps.kills, 0) as kills,
                COALESCE(ps.deaths, 0) as deaths,
                COALESCE(ps.kill_streak, 0) as kill_streak,
                COALESCE(ps.highest_streak, 0) as highest_streak,
                COALESCE(ppt.total_minutes, 0) as total_minutes
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         LEFT JOIN player_stats ps ON p.id = ps.player_id
         LEFT JOIN player_playtime ppt ON p.id = ppt.player_id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
         AND p.discord_id = ?
         AND p.server_id = ?
         AND p.is_active = true`,
        [guildId, discordId, server.id]
      );

      if (playerResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Not Linked', `You are not linked to **${serverName}**.\n\nUse \`/link <in-game-name>\` to link your account first.`)]
        });
      }

      const player = playerResult[0];

      // Format the linked date with relative time
      const linkedDate = new Date(player.linked_at);
      const now = new Date();
      const diffTime = Math.abs(now - linkedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      let relativeTime;
      if (diffDays > 0) {
        relativeTime = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        relativeTime = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else {
        relativeTime = 'Less than an hour ago';
      }

      // Create main profile embed with enhanced design
      const embed = {
        color: 0xFF6B35, // Rust orange color
        title: `🎮 ${player.ign}'s Profile`,
        description: `**Server:** ${serverName}`,
        thumbnail: {
          url: interaction.user.displayAvatarURL({ dynamic: true, size: 256 })
        },
        fields: [],
        timestamp: new Date().toISOString(),
        footer: {
          text: `Requested by ${interaction.user.username}`,
          icon_url: interaction.user.displayAvatarURL({ dynamic: true })
        }
      };

      // Add identity section
      embed.fields.push({
        name: '🆔 **Identity Information**',
        value: `\`\`\`\nDiscord: ${interaction.user.username}#${interaction.user.discriminator}\nIGN: ${player.ign}\nLinked: ${relativeTime}\`\`\``,
        inline: false
      });

      // Add player statistics with enhanced formatting
      const kdRatio = player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills.toString();
      const hours = Math.floor(player.total_minutes / 60);
      const minutes = player.total_minutes % 60;
      const playtimeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      // Combat stats with visual indicators
      const killEmoji = player.kills > 100 ? '💀' : player.kills > 50 ? '⚔️' : player.kills > 10 ? '🗡️' : '🔪';
      const deathEmoji = player.deaths > 100 ? '💀' : player.deaths > 50 ? '☠️' : player.deaths > 10 ? '💔' : '💥';
      const kdEmoji = parseFloat(kdRatio) > 2 ? '🔥' : parseFloat(kdRatio) > 1 ? '⚡' : parseFloat(kdRatio) > 0.5 ? '⚖️' : '📉';

      embed.fields.push({
        name: `${killEmoji} **Combat Statistics**`,
        value: `\`\`\`\nKills:     ${player.kills.toString().padStart(8)}\nDeaths:    ${player.deaths.toString().padStart(8)}\nK/D Ratio: ${kdRatio.padStart(8)}\`\`\``,
        inline: true
      });

      // Kill streaks with visual indicators
      const streakEmoji = player.highest_streak > 20 ? '🔥' : player.highest_streak > 10 ? '⚡' : player.highest_streak > 5 ? '💪' : '🎯';

      embed.fields.push({
        name: `${streakEmoji} **Kill Streaks**`,
        value: `\`\`\`\nCurrent: ${player.kill_streak.toString().padStart(8)}\nBest:    ${player.highest_streak.toString().padStart(8)}\`\`\``,
        inline: true
      });

      // Playtime with visual indicator
      const playtimeEmoji = player.total_minutes > 10080 ? '🏆' : player.total_minutes > 5040 ? '🥇' : player.total_minutes > 2520 ? '🥈' : player.total_minutes > 1260 ? '🥉' : '⏰';

      embed.fields.push({
        name: `${playtimeEmoji} **Playtime**`,
        value: `\`\`\`\nTotal: ${playtimeText.padStart(8)}\nHours: ${hours.toString().padStart(8)}\nMins:  ${minutes.toString().padStart(8)}\`\`\``,
        inline: true
      });

      // Add detailed linked date
      embed.fields.push({
        name: '📅 **Account Details**',
        value: `\`\`\`\nLinked: ${linkedDate.toLocaleString('en-US', { 
          timeZone: 'UTC',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        })}\nStatus: Active ✅\nServer: ${serverName}\`\`\``,
        inline: false
      });

      // Add performance summary
      let performanceRating = '🆕 New Player';
      let performanceColor = 0x00FF00;
      
      if (player.total_minutes > 10080) { // > 1 week
        if (parseFloat(kdRatio) > 2) {
          performanceRating = '🏆 Elite Player';
          performanceColor = 0xFFD700;
        } else if (parseFloat(kdRatio) > 1) {
          performanceRating = '🥇 Veteran Player';
          performanceColor = 0xC0C0C0;
        } else {
          performanceRating = '🥉 Experienced Player';
          performanceColor = 0xCD7F32;
        }
      } else if (player.total_minutes > 2520) { // > 1.75 days
        if (parseFloat(kdRatio) > 1.5) {
          performanceRating = '💪 Skilled Player';
          performanceColor = 0x00FF00;
        } else {
          performanceRating = '📈 Improving Player';
          performanceColor = 0x00FFFF;
        }
      } else if (player.total_minutes > 1260) { // > 21 hours
        performanceRating = '🎯 Learning Player';
        performanceColor = 0xFFFF00;
      }

      embed.color = performanceColor;

      embed.fields.push({
        name: '🏅 **Performance Rating**',
        value: `\`\`\`\n${performanceRating}\`\`\``,
        inline: false
      });

      // Create Rust Info button with enhanced styling
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`rust_info_${guildId}_${discordId}_${server.id}`)
            .setLabel('🔧 Rust Info')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚙️')
        );

      await interaction.editReply({ 
        embeds: [embed], 
        components: [row] 
      });

    } catch (error) {
      console.error('Error in profile command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to fetch your profile. Please try again.')]
      });
    }
  }
};
