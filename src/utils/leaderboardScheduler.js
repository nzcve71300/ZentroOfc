const { EmbedBuilder } = require('discord.js');
const pool = require('./database');
const LeaderboardGenerator = require('./leaderboardGenerator');

class LeaderboardScheduler {
  constructor(client) {
    this.client = client;
    this.generator = new LeaderboardGenerator();
  }

  async sendWeeklyLeaderboards() {
    try {
      console.log('📊 Starting weekly leaderboard generation...');

      // Get all guilds with leaderboard settings
      const [settingsResult] = await pool.query(
        `SELECT ls.*, g.discord_id, g.name as guild_name 
         FROM leaderboard_settings ls
         JOIN guilds g ON ls.guild_id = g.id`
      );

      if (settingsResult.length === 0) {
        console.log('📊 No leaderboard settings found');
        return;
      }

      // Generate global leaderboard
      const globalData = await this.generator.getAllGuildsLeaderboard();
      
      if (!globalData) {
        console.log('❌ Failed to generate global leaderboard');
        return;
      }

      // Send to each configured channel
      for (const setting of settingsResult) {
        try {
          const channel = await this.client.channels.fetch(setting.channel_id);
          
          if (!channel) {
            console.log(`❌ Channel not found: ${setting.channel_id}`);
            continue;
          }

          // Generate guild-specific leaderboard
          const guildData = await this.generator.generateServersLeaderboard(setting.discord_id);
          
          if (guildData) {
            // Send guild-specific leaderboard
            const guildEmbed = new EmbedBuilder(this.generator.formatLeaderboardEmbed(guildData, false));
            await channel.send({ embeds: [guildEmbed] });
          }

          // Send global leaderboard
          const globalEmbed = new EmbedBuilder(this.generator.formatLeaderboardEmbed(globalData, true));
          await channel.send({ embeds: [globalEmbed] });

          console.log(`✅ Sent leaderboard to ${setting.guild_name} (${setting.channel_id})`);

        } catch (error) {
          console.error(`❌ Error sending leaderboard to guild ${setting.guild_name}:`, error);
        }
      }

      console.log('📊 Weekly leaderboard generation completed');

    } catch (error) {
      console.error('❌ Error in weekly leaderboard scheduler:', error);
    }
  }

  async sendTestLeaderboard(guildId, channelId) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel) {
        console.log(`❌ Channel not found: ${channelId}`);
        return false;
      }

      // Generate guild-specific leaderboard
      const guildData = await this.generator.generateServersLeaderboard(guildId);
      
      if (guildData) {
        const guildEmbed = new EmbedBuilder(this.generator.formatLeaderboardEmbed(guildData, false));
        await channel.send({ embeds: [guildEmbed] });
        console.log(`✅ Sent test leaderboard to guild ${guildData.guildName}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Error sending test leaderboard:', error);
      return false;
    }
  }

  // Start the weekly scheduler (runs every Sunday at 12:00 PM UTC)
  startScheduler() {
    const now = new Date();
    const nextSunday = new Date(now);
    
    // Set to next Sunday at 12:00 PM UTC
    nextSunday.setUTCDate(now.getUTCDate() + (7 - now.getUTCDay()));
    nextSunday.setUTCHours(12, 0, 0, 0);

    // If it's already Sunday and past 12 PM, schedule for next Sunday
    if (now.getUTCDay() === 0 && now.getUTCHours() >= 12) {
      nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);
    }

    const timeUntilNext = nextSunday.getTime() - now.getTime();
    
    console.log(`📅 Next leaderboard scheduled for: ${nextSunday.toUTCString()}`);
    console.log(`⏰ Time until next leaderboard: ${Math.round(timeUntilNext / (1000 * 60 * 60))} hours`);

    // Schedule the first run
    setTimeout(() => {
      this.sendWeeklyLeaderboards();
      
      // Then schedule to run every week
      setInterval(() => {
        this.sendWeeklyLeaderboards();
      }, 7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds
      
    }, timeUntilNext);
  }
}

module.exports = LeaderboardScheduler; 