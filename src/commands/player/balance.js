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
      const balances = await pool.query(
        `SELECT rs.nickname, e.balance
         FROM players p
         JOIN economy e ON p.id = e.player_id
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         ORDER BY rs.nickname`,
        [userId, guildId]
      );

      if (balances.rows.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Account Not Linked', 'Use `/link <in-game-name>` before checking your balance.')] });
      }

      const embed = orangeEmbed('Balance Overview', '**Your Balances by Server:**');
      balances.rows.forEach(row => embed.addFields({ name: row.nickname, value: `${row.balance || 0} coins`, inline: true }));

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in balance:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to fetch balances. Please try again.')] });
    }
  }
};
