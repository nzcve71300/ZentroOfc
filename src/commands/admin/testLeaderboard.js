const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../../utils/database');
const LeaderboardScheduler = require('../../utils/leaderboardScheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test-leaderboard')
    .setDescription('Test the leaderboard generation (Owner only)'),

  async execute(interaction) {
    // Check if user is the owner (your user ID)
    const OWNER_ID = '1252993829007528086';
    
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: '❌ Only the bot owner can use this command.',
        ephemeral: true
      });
    }

    const guildId = interaction.guild.id;

    try {
      // Check if leaderboard is configured for this guild
      const [guildResult] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [guildId]
      );

      if (guildResult.length === 0) {
        return interaction.reply({
          content: '❌ This guild is not set up in the database.',
          ephemeral: true
        });
      }

      const guildDbId = guildResult[0].id;

      const [settingsResult] = await pool.query(
        'SELECT channel_id FROM leaderboard_settings WHERE guild_id = ?',
        [guildDbId]
      );

      if (settingsResult.length === 0) {
        return interaction.reply({
          content: '❌ No leaderboard channel configured for this guild. Use `/servers-leaderboard` first.',
          ephemeral: true
        });
      }

      const channelId = settingsResult[0].channel_id;

      await interaction.reply({
        content: '🔄 Generating test leaderboard...',
        ephemeral: true
      });

      // Create scheduler instance and send test leaderboard
      const scheduler = new LeaderboardScheduler(interaction.client);
      const success = await scheduler.sendTestLeaderboard(guildId, channelId);

      if (success) {
        await interaction.editReply({
          content: `✅ Test leaderboard sent to <#${channelId}>!`,
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: '❌ Failed to generate or send test leaderboard.',
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Error testing leaderboard:', error);
      await interaction.editReply({
        content: '❌ An error occurred while testing the leaderboard.',
        ephemeral: true
      });
    }
  },
}; 