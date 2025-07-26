const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-server')
    .setDescription('Remove a Rust server from the bot')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server to remove')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    // Check if user is authorized (only you can use this command)
    if (interaction.user.id !== '1252993829007528086') {
      return interaction.respond([]);
    }

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
    // Check if user is authorized (only you can use this command)
    if (interaction.user.id !== '1252993829007528086') {
      return interaction.reply({
        embeds: [orangeEmbed('❌ Access Denied', 'You do not have permission to use this command.')],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const serverNickname = interaction.options.getString('server');
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

      // Remove the server (this will cascade delete related data)
      await pool.query(
        'DELETE FROM rust_servers WHERE id = $1',
        [serverId]
      );

      await interaction.editReply(orangeEmbed(
        '✅ Server Removed',
        `**${serverNickname}** has been removed successfully.\n\nAll related data (players, economy, shop items, etc.) has also been removed.`
      ));

    } catch (error) {
      console.error('Error removing server:', error);
      await interaction.editReply(orangeEmbed('Error', 'Failed to remove server. Please try again.'));
    }
  },
}; 