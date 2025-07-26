const { SlashCommandBuilder } = require('@discordjs/builders');
const pool = require('../../db');
const { orangeEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward'),
  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const discordId = interaction.user.id;
    
    try {
      // Get all servers for this guild
      const serversResult = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)',
        [guildId]
      );
      
      if (serversResult.rows.length === 0) {
        return await interaction.editReply({
          embeds: [orangeEmbed('Error', 'No servers found for this guild.')]
        });
      }
      
      let totalReward = 0;
      const rewards = [];
      
      for (const server of serversResult.rows) {
        // Get or create player record
        let playerResult = await pool.query(
          'SELECT id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND server_id = $2 AND discord_id = $3',
          [guildId, server.id, discordId]
        );
        
        let playerId;
        if (playerResult.rows.length === 0) {
          // Create player record
          const newPlayerResult = await pool.query(
            'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES ((SELECT id FROM guilds WHERE discord_id = $1), $2, $3, $4) RETURNING id',
            [guildId, server.id, discordId, 'Unknown']
          );
          playerId = newPlayerResult.rows[0].id;
        } else {
          playerId = playerResult.rows[0].id;
        }
        
        // Get or create economy record
        let economyResult = await pool.query(
          'SELECT id, balance FROM economy WHERE player_id = $1',
          [playerId]
        );
        
        if (economyResult.rows.length === 0) {
          // Create economy record with daily reward
          await pool.query(
            'INSERT INTO economy (player_id, balance) VALUES ($1, $2)',
            [playerId, 100] // Default daily reward amount
          );
          totalReward += 100;
          rewards.push({ server: server.nickname, amount: 100 });
        } else {
          // Update existing balance
          const currentBalance = economyResult.rows[0].balance;
          const dailyReward = 100; // This could be configurable per server
          const newBalance = currentBalance + dailyReward;
          
          await pool.query(
            'UPDATE economy SET balance = $1 WHERE player_id = $2',
            [newBalance, playerId]
          );
          
          totalReward += dailyReward;
          rewards.push({ server: server.nickname, amount: dailyReward });
        }
        
        // Record transaction
        await pool.query(
          'INSERT INTO transactions (player_id, amount, type) VALUES ($1, $2, $3)',
          [playerId, 100, 'daily_reward']
        );
      }
      
      const fields = rewards.map(reward => ({
        name: reward.server,
        value: `+${reward.amount} coins`,
        inline: true
      }));
      
      await interaction.editReply({
        embeds: [orangeEmbed('Daily Reward Claimed!', `You received **${totalReward} coins** across all servers!`, fields)]
      });
      
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [orangeEmbed('Error', 'Failed to claim daily reward.')]
      });
    }
  }
}; 