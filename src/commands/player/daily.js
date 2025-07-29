const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getAllActivePlayersByDiscordId, updatePlayerBalance, recordTransaction } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward across all linked servers'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const dailyAmount = 100;

    try {
      // Check last claim across all servers
      const cooldownResult = await pool.query(
        `SELECT MAX(timestamp) as last_claim 
         FROM transactions 
         WHERE player_id IN (
           SELECT p.id FROM players p 
           JOIN rust_servers rs ON p.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE p.discord_id = ? AND g.discord_id = ?
         ) AND type = 'daily_reward'`,
        [userId, guildId]
      );

      const lastClaim = cooldownResult.rows[0].last_claim;
      if (lastClaim && Date.now() - new Date(lastClaim).getTime() < 24 * 60 * 60 * 1000) {
        return interaction.editReply({
          embeds: [orangeEmbed('Cooldown', 'You can only claim your daily reward once every 24 hours.')]
        });
      }

      // Get all linked players across all servers using unified system
      const players = await getAllActivePlayersByDiscordId(guildId, userId);

      if (players.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Account Not Linked', 'Use `/link <in-game-name>` to link your account first.')]
        });
      }

      let totalAdded = 0;
      const serverList = [];

      for (const player of players) {
        // Update balance using unified system
        await updatePlayerBalance(player.id, dailyAmount);
        
        // Record transaction using unified system
        await recordTransaction(player.id, dailyAmount, 'daily_reward');
        
        totalAdded += dailyAmount;
        serverList.push(player.nickname);
      }

      const uniqueServers = [...new Set(serverList)];
      await interaction.editReply({
        embeds: [successEmbed('Daily Reward Claimed', 
          `+${dailyAmount} coins added to **${players.length} character(s)** across **${uniqueServers.length} server(s)**.\n\n**Total Added:** ${totalAdded} coins\n**Servers:** ${uniqueServers.join(', ')}`)]
      });

    } catch (err) {
      console.error('Daily error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to claim daily reward.')]
      });
    }
  }
};
