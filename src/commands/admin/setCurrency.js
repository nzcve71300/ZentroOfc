const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-currency')
    .setDescription('Set the currency name for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Currency name (e.g., Coins, Credits, Points)')
        .setRequired(true)),

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
        return interaction.reply({
          embeds: [orangeEmbed('Error', 'Server not found.')],
          ephemeral: true
        });
      }

      const serverId = serverResult.rows[0].id;

      // Update currency for all players on this server
      const result = await pool.query(
        `UPDATE economy 
         SET balance = $1 
         FROM players p 
         WHERE economy.player_id = p.id AND p.server_id = $2`,
        [amount, serverId]
      );

      await interaction.reply({
        embeds: [orangeEmbed(
          '💰 Currency Set',
          `Set all players' balance to **${amount} coins** on **${serverNickname}**.\n\n**Players affected:** ${result.rowCount}`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error setting currency:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to set currency. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 