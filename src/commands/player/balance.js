const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('View your balance across all servers'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Get all servers and balances for this player
      const balanceResult = await pool.query(
        `SELECT rs.nickname, e.balance, p.ign
         FROM players p
         JOIN economy e ON p.id = e.player_id
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         ORDER BY rs.nickname`,
        [userId, guildId]
      );

      if (balanceResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            '💰 Balance',
            'You don\'t have any accounts linked yet.\n\nUse `/link <in-game-name>` to link your Discord account to your in-game character.'
          )]
        });
      }

      // Calculate total balance
      const totalBalance = balanceResult.rows.reduce((sum, row) => sum + (row.balance || 0), 0);

      // Create embed
      const embed = orangeEmbed(
        '💰 Balance Overview',
        `**Total Balance:** ${totalBalance} coins\n\n**Balance by Server:**`
      );

      for (const row of balanceResult.rows) {
        const ign = row.ign || 'Not linked';
        embed.addFields({
          name: `🏠 ${row.nickname}`,
          value: `**Balance:** ${row.balance || 0} coins\n**IGN:** ${ign}`,
          inline: true
        });
      }

      embed.addFields({
        name: '💡 Tips',
        value: '• Use `/daily` to claim daily rewards\n• Play `/blackjack` or `/slots` to earn more coins\n• Use `/shop` to spend your coins',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error fetching balance:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to fetch balance. Please try again.')]
      });
    }
  },
}; 