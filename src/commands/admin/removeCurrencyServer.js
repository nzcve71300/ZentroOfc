const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-currency-server')
    .setDescription('Remove currency from all players on a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to remove from all players')
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
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const serverNickname = interaction.options.getString('server');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    try {
      // Get server ID
      const serverResult = await pool.query(
        'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverNickname]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult.rows[0].id;

      // Update currency for all players on this server (ensure balance doesn't go below 0)
      const result = await pool.query(
        `UPDATE economy 
         SET balance = GREATEST(0, balance - $1) 
         FROM players p 
         WHERE economy.player_id = p.id AND p.server_id = $2`,
        [amount, serverId]
      );

      // Get list of affected players
      const playersResult = await pool.query(
        `SELECT p.ign, e.balance 
         FROM players p 
         JOIN economy e ON p.id = e.player_id 
         WHERE p.server_id = $1 
         ORDER BY e.balance DESC`,
        [serverId]
      );

      let playersList = '';
      if (playersResult.rows.length > 0) {
        playersList = '\n\n**Players affected:**\n';
        playersResult.rows.forEach((player, index) => {
          if (index < 10) { // Show first 10 players
            playersList += `• **${player.ign}:** ${player.balance} coins\n`;
          }
        });
        if (playersResult.rows.length > 10) {
          playersList += `• ... and ${playersResult.rows.length - 10} more players\n`;
        }
      }

      await interaction.editReply({
        embeds: [successEmbed(
          'Currency Removed',
          `Removed **${amount} coins** from all players on **${serverNickname}**.\n\n**Players affected:** ${result.rowCount}${playersList}`
        )]
      });

    } catch (error) {
      console.error('Error removing currency from server:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to remove currency from server. Please try again.')]
      });
    }
  },
}; 