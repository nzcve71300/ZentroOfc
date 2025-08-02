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
    // const dailyAmount = 100; // REMOVE this line

    try {
      // Check last claim across all servers
      const [cooldownResult] = await pool.query(
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

      const lastClaim = cooldownResult[0].last_claim;
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
      let perServerAmounts = {};

      // Get daily amount for each server
      const serverIds = [...new Set(players.map(p => p.server_id))];
      if (serverIds.length > 0) {
        const [configRows] = await pool.query(
          `SELECT server_id, setting_value FROM eco_games_config WHERE server_id IN (${serverIds.map(() => '?').join(',')}) AND setting_name = 'daily_amount'`,
          serverIds
        );
        for (const row of configRows) {
          perServerAmounts[row.server_id] = parseInt(row.setting_value) || 100;
        }
      }

      for (const player of players) {
        // Use config value if present, else default to 100
        const dailyAmount = perServerAmounts[player.server_id] || 100;
        // Update balance using unified system
        await updatePlayerBalance(player.id, dailyAmount);
        // Record transaction using unified system
        await recordTransaction(player.id, dailyAmount, 'daily_reward');
        totalAdded += dailyAmount;
        serverList.push(player.nickname + ` (+${dailyAmount})`);
      }

      const uniqueServers = [...new Set(serverList)];
      await interaction.editReply({
        embeds: [successEmbed('Daily Reward Claimed', 
          `Coins added to **${players.length} character(s)** across **${uniqueServers.length} server(s)**.\n\n**Total Added:** ${totalAdded} coins\n**Servers:** ${uniqueServers.join(', ')}`)]
      });

    } catch (err) {
      console.error('Daily error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to claim daily reward.')]
      });
    }
  }
};
