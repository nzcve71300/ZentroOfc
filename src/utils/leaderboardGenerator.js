const pool = require('./database');

class LeaderboardGenerator {
  constructor() {
    this.pool = pool;
  }

  async generateServersLeaderboard(guildId) {
    try {
      // Get all servers for this guild
      const [serversResult] = await this.pool.query(
        `SELECT rs.id, rs.nickname, g.name as guild_name 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ?`,
        [guildId]
      );

      if (serversResult.length === 0) {
        return null;
      }

      const guildName = serversResult[0].guild_name;
      const serverIds = serversResult.map(server => server.id);

      // Aggregate kills across all servers for this guild
      const [leaderboardResult] = await this.pool.query(
        `SELECT 
           rs.nickname as server_name,
           SUM(ps.kills) as total_kills,
           SUM(ps.deaths) as total_deaths,
           COUNT(DISTINCT p.id) as unique_players
         FROM rust_servers rs
         LEFT JOIN players p ON rs.id = p.server_id
         LEFT JOIN player_stats ps ON p.id = ps.player_id
         WHERE rs.id IN (${serverIds.map(() => '?').join(',')})
         GROUP BY rs.id, rs.nickname
         ORDER BY total_kills DESC`,
        serverIds
      );

      // Calculate guild totals
      const guildTotals = {
        totalKills: 0,
        totalDeaths: 0,
        totalPlayers: 0,
        averageKills: 0
      };

      leaderboardResult.forEach(server => {
        guildTotals.totalKills += server.total_kills || 0;
        guildTotals.totalDeaths += server.total_deaths || 0;
        guildTotals.totalPlayers += server.unique_players || 0;
      });

      if (guildTotals.totalPlayers > 0) {
        guildTotals.averageKills = Math.round(guildTotals.totalKills / guildTotals.totalPlayers);
      }

      return {
        guildName,
        servers: leaderboardResult,
        totals: guildTotals,
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('Error generating servers leaderboard:', error);
      return null;
    }
  }

  async getAllGuildsLeaderboard() {
    try {
      // Get all guilds with their aggregated kill data
      const [guildsResult] = await this.pool.query(
        `SELECT 
           g.discord_id,
           g.name as guild_name,
           COUNT(DISTINCT rs.id) as server_count,
           SUM(ps.kills) as total_kills,
           SUM(ps.deaths) as total_deaths,
           COUNT(DISTINCT p.id) as unique_players
         FROM guilds g
         LEFT JOIN rust_servers rs ON g.id = rs.guild_id
         LEFT JOIN players p ON rs.id = p.server_id
         LEFT JOIN player_stats ps ON p.id = ps.player_id
         GROUP BY g.id, g.discord_id, g.name
         HAVING total_kills > 0
         ORDER BY total_kills DESC
         LIMIT 20`
      );

      // Calculate averages for each guild
      const leaderboard = guildsResult.map(guild => ({
        guildName: guild.guild_name,
        serverCount: guild.server_count,
        totalKills: guild.total_kills || 0,
        totalDeaths: guild.total_deaths || 0,
        uniquePlayers: guild.unique_players || 0,
        averageKills: guild.unique_players > 0 ? Math.round(guild.total_kills / guild.unique_players) : 0
      }));

      return {
        leaderboard,
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('Error generating all guilds leaderboard:', error);
      return null;
    }
  }

  formatLeaderboardEmbed(data, isGlobal = false) {
    const embed = {
      color: 0x00FF00,
      title: isGlobal ? '🌍 Global Servers Leaderboard' : `🏆 ${data.guildName} Servers Leaderboard`,
      description: isGlobal ? 'Top 20 Servers by Average Kills' : 'Server Performance Overview',
      fields: [],
      timestamp: data.generatedAt.toISOString(),
      footer: {
        text: isGlobal ? '[UPDATED: ' + data.generatedAt.toUTCString() + '] (Averaged Kills)' : 'Weekly Update'
      }
    };

    if (isGlobal) {
      // Global leaderboard format
      let leaderboardText = '```\n';
      leaderboardText += 'KAOS Leaderboard (Top 20 Servers by Average Kills)\n';
      leaderboardText += 'Top Servers by Average Kills\n';
      leaderboardText += '#  Server Name           Average Kills\n';

      data.leaderboard.forEach((guild, index) => {
        const rank = index + 1;
        const serverName = guild.guildName.padEnd(20);
        const averageKills = guild.averageKills.toLocaleString();
        leaderboardText += `${rank.toString().padStart(2)}  ${serverName} ${averageKills.padStart(10)}\n`;
      });

      leaderboardText += '```';
      embed.fields.push({
        name: '📊 Leaderboard',
        value: leaderboardText,
        inline: false
      });
    } else {
      // Guild-specific leaderboard
      if (data.servers.length > 0) {
        let serverList = '```\n';
        serverList += '#  Server Name           Total Kills    Players    Avg Kills\n';
        serverList += '─  ──────────────────────────────────────────────────────\n';

        data.servers.forEach((server, index) => {
          const rank = index + 1;
          const serverName = (server.server_name || 'Unknown').padEnd(20);
          const totalKills = (server.total_kills || 0).toString().padStart(12);
          const players = (server.unique_players || 0).toString().padStart(8);
          const avgKills = server.unique_players > 0 ? Math.round(server.total_kills / server.unique_players) : 0;
          const avgKillsStr = avgKills.toString().padStart(9);
          
          serverList += `${rank.toString().padStart(2)}  ${serverName} ${totalKills} ${players} ${avgKillsStr}\n`;
        });

        serverList += '```';
        embed.fields.push({
          name: '📊 Server Performance',
          value: serverList,
          inline: false
        });
      }

      // Guild totals
      embed.fields.push(
        {
          name: '🏆 Guild Totals',
          value: `**Total Kills:** ${data.totals.totalKills.toLocaleString()}\n**Total Players:** ${data.totals.totalPlayers}\n**Average Kills:** ${data.totals.averageKills.toLocaleString()}`,
          inline: true
        },
        {
          name: '📈 Statistics',
          value: `**Servers:** ${data.servers.length}\n**Total Deaths:** ${data.totals.totalDeaths.toLocaleString()}\n**K/D Ratio:** ${data.totals.totalDeaths > 0 ? (data.totals.totalKills / data.totals.totalDeaths).toFixed(2) : '∞'}`,
          inline: true
        }
      );
    }

    return embed;
  }
}

module.exports = LeaderboardGenerator; 