const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily currency reward'),

  async execute(interaction) {

    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Get all servers in this guild
      const serversResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1',
        [guildId]
      );

      if (serversResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed('Error', 'No servers found in this guild.')],
          ephemeral: true
        });
      }

      // Check if user has claimed daily reward in the last 24 hours
      const lastClaimResult = await pool.query(
        `SELECT MAX(t.timestamp) as last_claim
         FROM transactions t
         JOIN players p ON t.player_id = p.id
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2 AND t.type = 'daily_reward'`,
        [userId, guildId]
      );

      const lastClaim = lastClaimResult.rows[0]?.last_claim;
      if (lastClaim) {
        const now = new Date();
        const timeSinceLastClaim = now - new Date(lastClaim);
        const hoursSinceLastClaim = timeSinceLastClaim / (1000 * 60 * 60);
        
        if (hoursSinceLastClaim < 24) {
          const hoursRemaining = Math.ceil(24 - hoursSinceLastClaim);
          const minutesRemaining = Math.ceil((24 - hoursSinceLastClaim) * 60);
          
          let timeText;
          if (hoursRemaining >= 1) {
            timeText = `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`;
          } else {
            timeText = `${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}`;
          }
          
          return interaction.reply({
            embeds: [orangeEmbed(
              '⏰ Daily Reward Cooldown',
              `You've already claimed your daily reward!\n\n⏳ **Next claim available in:** ${timeText}`
            )],
            ephemeral: true
          });
        }
      }

      const dailyReward = 100; // Default daily reward amount
      const results = [];

      for (const server of serversResult.rows) {
        try {
          // Check if player exists
          let playerResult = await pool.query(
            'SELECT id FROM players WHERE discord_id = $1 AND server_id = $2',
            [userId, server.id]
          );

          let playerId;
          if (playerResult.rows.length === 0) {
            // Create player record
            const newPlayerResult = await pool.query(
              'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) RETURNING id',
              [guildId, server.id, userId, 'Unknown']
            );
            playerId = newPlayerResult.rows[0].id;
          } else {
            playerId = playerResult.rows[0].id;
          }

          // Check if economy record exists
          let economyResult = await pool.query(
            'SELECT id, balance FROM economy WHERE player_id = $1',
            [playerId]
          );

          if (economyResult.rows.length === 0) {
            // Create economy record with daily reward
            await pool.query(
              'INSERT INTO economy (player_id, balance) VALUES ($1, $2)',
              [playerId, dailyReward]
            );
            results.push({ server: server.nickname, balance: dailyReward, new: true });
          } else {
            // Update existing balance
            const newBalance = parseInt(economyResult.rows[0].balance || 0) + dailyReward;
            await pool.query(
              'UPDATE economy SET balance = $1 WHERE player_id = $2',
              [newBalance, playerId]
            );
            results.push({ server: server.nickname, balance: newBalance, new: false });
          }

          // Record transaction
          await pool.query(
            'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
            [playerId, dailyReward, 'daily_reward']
          );

        } catch (error) {
          console.error(`Error processing daily reward for server ${server.nickname}:`, error);
          results.push({ server: server.nickname, error: true });
        }
      }

      // Create response
      const successfulResults = results.filter(r => !r.error);
      const failedResults = results.filter(r => r.error);

      let response = `**Daily Reward Claimed!**\n\nYou received **${dailyReward} coins** on each server.\n\n`;

      if (successfulResults.length > 0) {
        response += '**Updated Balances:**\n';
        successfulResults.forEach(result => {
          const status = result.new ? ' (New Account)' : '';
          response += `• **${result.server}:** ${result.balance} coins${status}\n`;
        });
      }

      if (failedResults.length > 0) {
        response += `\n**Failed to process:** ${failedResults.map(r => r.server).join(', ')}`;
      }

      response += '\n⏰ **Next daily reward available in 24 hours**';

      await interaction.reply({
        embeds: [orangeEmbed('🎁 Daily Reward', response)],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error claiming daily reward:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to claim daily reward. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 