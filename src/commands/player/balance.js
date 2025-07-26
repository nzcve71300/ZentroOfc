const { SlashCommandBuilder } = require('@discordjs/builders');
const pool = require('../../db');
const { orangeEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Show your balance across all servers'),
  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    
    try {
      // Get player balances across all servers in this guild
      const result = await pool.query(
        `SELECT rs.nickname, e.balance 
         FROM players p 
         JOIN economy e ON p.id = e.player_id 
         JOIN rust_servers rs ON p.server_id = rs.id 
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = $1) 
         AND p.discord_id = $2`,
        [guildId, discordId]
      );
      
      if (result.rows.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('Balance', 'You have no balance on any servers. Use `/link` to connect your account first.')]
        });
      }
      
      const fields = result.rows.map(row => ({
        name: row.nickname,
        value: `${row.balance} coins`,
        inline: true
      }));
      
      const totalBalance = result.rows.reduce((sum, row) => sum + row.balance, 0);
      
      await interaction.editReply({
        embeds: [orangeEmbed('Your Balance', `Total balance across all servers: **${totalBalance} coins**`, fields)]
      });
      
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [orangeEmbed('Error', 'Failed to retrieve balance.')]
      });
    }
  }
}; 