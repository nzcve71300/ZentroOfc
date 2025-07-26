const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-currency-player')
    .setDescription('Remove currency from a specific player')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('player_name')
        .setDescription('Player\'s in-game name')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of currency to remove')
        .setRequired(true)
        .setMinValue(1)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    const serverNickname = interaction.options.getString('server');
    const playerName = interaction.options.getString('player_name');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    try {
      // Get server ID
      const serverResult = await pool.query(
        'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverNickname]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply(orangeEmbed('Error', 'Server not found.'));
      }

      const serverId = serverResult.rows[0].id;

      // Find player by IGN
      const playerResult = await pool.query(
        'SELECT id, ign FROM players WHERE server_id = $1 AND ign ILIKE $2',
        [serverId, playerName]
      );

      if (playerResult.rows.length === 0) {
        return interaction.editReply(orangeEmbed('Error', `Player **${playerName}** not found on **${serverNickname}**.`));
      }

      const playerId = playerResult.rows[0].id;

      // Get economy record
      const economyResult = await pool.query(
        'SELECT id, balance FROM economy WHERE player_id = $1',
        [playerId]
      );

      if (economyResult.rows.length === 0) {
        return interaction.editReply(orangeEmbed('Error', `Player **${playerName}** has no balance on **${serverNickname}**.`));
      }

      const currentBalance = parseInt(economyResult.rows[0].balance || 0);
      
      if (currentBalance < amount) {
        return interaction.editReply(orangeEmbed('Error', `Player **${playerName}** only has **${currentBalance} coins** on **${serverNickname}**. Cannot remove ${amount} coins.`));
      }

      const newBalance = currentBalance - amount;
      
      // Update balance
      await pool.query(
        'UPDATE economy SET balance = $1 WHERE player_id = $2',
        [newBalance, playerId]
      );

      // Record transaction
      await pool.query(
        'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
        [playerId, -amount, 'admin_remove']
      );

      await interaction.editReply(orangeEmbed(
        '✅ Currency Removed',
        `Removed **${amount} coins** from **${playerName}** on **${serverNickname}**.\n\n**Previous Balance:** ${currentBalance} coins\n**New Balance:** ${newBalance} coins`
      ));

    } catch (error) {
      console.error('Error removing currency from player:', error);
      await interaction.editReply(orangeEmbed('Error', 'Failed to remove currency from player. Please try again.'));
    }
  },
}; 