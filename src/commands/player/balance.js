const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getAllActivePlayersByDiscordId, getPlayerBalance } = require('../../utils/unifiedPlayerSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('View your balance across all servers'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Get all active players for this Discord ID
      const players = await getAllActivePlayersByDiscordId(guildId, userId);

      if (players.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Account Not Linked', 'Use `/link <in-game-name>` before checking your balance.')] });
      }

      const embed = orangeEmbed('Balance Overview', '**Your Balances by Server:**');
      
      for (const player of players) {
        const balance = await getPlayerBalance(player.id);
        embed.addFields({ name: player.nickname, value: `${balance} coins`, inline: TRUE });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in balance:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to fetch balances. Please try again.')] });
    }
  }
};
