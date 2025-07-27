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
      // Get all servers and player records for this user
      const playerResult = await pool.query(
        `SELECT p.id as player_id, p.ign, rs.nickname, e.balance
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         LEFT JOIN economy e ON p.id = e.player_id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         ORDER BY rs.nickname`,
        [userId, guildId]
      );

      if (playerResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Account Not Linked',
            'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account before using this command.'
          )]
        });
      }

      let totalRewarded = 0;
      let updatedServers = [];
      let alreadyClaimed = [];

      // Process each server
      for (const player of playerResult.rows) {
        const currentBalance = player.balance || 0;
        const newBalance = currentBalance + dailyAmount;

        // Update balance
        await pool.query(
          'UPDATE economy SET balance = $1 WHERE player_id = $2',
          [newBalance, player.player_id]
        );

        // Record transaction
        await pool.query(
          'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
          [player.player_id, dailyAmount, 'daily_reward']
        );

        totalRewarded += dailyAmount;
        updatedServers.push(player.nickname);
      }

      // Create success embed
      const embed = successEmbed(
        '🎁 Daily Reward Claimed!',
        `**Total Reward:** ${totalRewarded} coins\n**Servers Updated:** ${updatedServers.length}\n\n**Rewards Added:**`
      );

      for (const server of updatedServers) {
        embed.addFields({
          name: `🏠 ${server}`,
          value: `+${dailyAmount} coins`,
          inline: true
        });
      }

      embed.addFields({
        name: '💡 Come Back Tomorrow!',
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