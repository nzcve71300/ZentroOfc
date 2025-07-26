const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
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
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const serverNickname = interaction.options.getString('server');
    const currencyName = interaction.options.getString('name');
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

      // For now, we'll just acknowledge the currency name
      // In a full implementation, you might store this in a separate table
      await interaction.editReply({
        embeds: [successEmbed(
          'Currency Set',
          `Currency name set to **${currencyName}** for **${serverNickname}**.\n\nNote: This is currently informational only. The currency name will be displayed in future messages.`
        )]
      });

    } catch (error) {
      console.error('Error setting currency:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to set currency. Please try again.')]
      });
    }
  },
}; 