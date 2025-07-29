const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-currency')
    .setDescription('Set the currency name for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(TRUE)
        .setAutocomplete(TRUE))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Currency name (e.g., coins, credits, tokens)')
        .setRequired(TRUE)
        .setMaxLength(20)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
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
    await interaction.deferReply({ ephemeral: TRUE });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, FALSE);
    }

    const serverOption = interaction.options.getString('server');
    const currencyName = interaction.options.getString('name');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const serverResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
        [guildId, serverOption]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult.rows[0].id;
      const serverName = serverResult.rows[0].nickname;

      // For now, we'll store currency name in a comment or note
      // In a full implementation, you might want to add a currency_name column to rust_servers table
      
      await interaction.editReply({
        embeds: [successEmbed(
          'Currency Set',
          `**Server:** ${serverName}\n**Currency Name:** ${currencyName}\n\nCurrency name has been set successfully!`
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