const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
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
    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.respond([]);
    }

    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
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
    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, true);
    }

    const serverNickname = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Get server ID
      const [serverResult] = await pool.query(
        'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
        [guildId, serverNickname]
      );

      if (serverResult.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed('Error', `Server **${serverNickname}** not found in this guild.`)],
          ephemeral: true
        });
      }

      const serverId = serverResult[0].id;

      // Delete the server (this will cascade to related data)
      await pool.query('DELETE FROM rust_servers WHERE id = ?', [serverId]);

      await interaction.reply({
        embeds: [orangeEmbed(
          '🗑️ Server Removed',
          `**${serverNickname}** has been removed from the bot.\n\nAll associated data (players, economy, shop items, etc.) has been deleted.`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error removing server:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to remove server. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 