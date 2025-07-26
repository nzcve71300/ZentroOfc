const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('View your currency balance across all servers'),

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Get player's balance across all servers in this guild
      const result = await pool.query(
        `SELECT rs.nickname, e.balance, p.ign
         FROM players p
         JOIN economy e ON p.id = e.player_id
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         ORDER BY rs.nickname`,
        [userId, guildId]
      );

      if (result.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            '💰 Balance',
            'You don\'t have any balance on any servers in this guild.\n\nUse `/link` to link your Discord account to your in-game name first.'
          )]
        });
      }

      // Calculate total balance
      const totalBalance = result.rows.reduce((sum, row) => sum + parseInt(row.balance || 0), 0);

      // Create balance list
      const balanceList = result.rows.map(row => 
        `**${row.nickname}:** ${row.balance || 0} coins`
      ).join('\n');

      const embed = orangeEmbed(
        '💰 Balance',
        `**Total Balance:** ${totalBalance} coins\n\n**Server Breakdown:**\n${balanceList}`
      );

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