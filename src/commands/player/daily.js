const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward on all servers'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const dailyAmount = 100; // Default daily reward amount

    try {
      // Check if player is linked to any server
      const linkedResult = await pool.query(
        `SELECT p.id as player_id, p.ign
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         LIMIT 1`,
        [userId, guildId]
      );

      if (linkedResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Account Not Linked',
            'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account before using this command.'
          )]
        });
      }

      // Get Discord balance (single balance for all servers)
      const balanceResult = await pool.query(
        `SELECT e.balance
         FROM players p
         JOIN economy e ON p.id = e.player_id
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         LIMIT 1`,
        [userId, guildId]
      );

      const currentBalance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance || 0 : 0;
      const newBalance = currentBalance + dailyAmount;
      const playerId = linkedResult.rows[0].player_id;

      // Update Discord balance (single balance for all servers)
      if (balanceResult.rows.length === 0) {
        // Create economy record
        await pool.query(
          'INSERT INTO economy (player_id, balance) VALUES ($1, $2)',
          [playerId, dailyAmount]
        );
      } else {
        // Update existing balance
        await pool.query(
          'UPDATE economy SET balance = $1 WHERE player_id = $2',
          [newBalance, playerId]
        );
      }

      // Record transaction
      await pool.query(
        'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
        [playerId, dailyAmount, 'daily_reward']
      );

      // Create success embed
      const embed = successEmbed(
        'Daily Reward Claimed!',
        `**Reward:** +${dailyAmount} coins\n**New Balance:** ${newBalance} coins`
      );

      embed.addFields({
        name: 'Come Back Tomorrow!',
        value: 'You can claim your daily reward again in 24 hours.',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error claiming daily reward:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to claim daily reward. Please try again.')]
      });
    }
  },
}; 