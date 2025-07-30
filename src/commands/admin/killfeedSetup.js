const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killfeed-setup')
    .setDescription('Configure killfeed format string for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('format_string')
        .setDescription('Killfeed format string with placeholders')
        .setRequired(true)
        .setMaxLength(500)),

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
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverOption = interaction.options.getString('server');
    const formatString = interaction.options.getString('format_string');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const serverResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
        [guildId, serverOption]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult[0].id;
      const serverName = serverResult[0].nickname;

      // Check if killfeed config exists
      let killfeedResult = await pool.query(
        'SELECT id, enabled FROM killfeed_configs WHERE server_id = ?',
        [serverId]
      );

      if (killfeedResult.length === 0) {
        // Create new killfeed config
        await pool.query(
          'INSERT INTO killfeed_configs (server_id, enabled, format_string) VALUES (?, false, ?)',
          [serverId, formatString]
        );
        killfeedResult = await pool.query(
          'SELECT id, enabled FROM killfeed_configs WHERE server_id = ?',
          [serverId]
        );
      }

      const killfeed = killfeedResult[0];

      // Update format string
      await pool.query(
        'UPDATE killfeed_configs SET format_string = ? WHERE id = ?',
        [formatString, killfeed.id]
      );

      // Create preview of the format
      const preview = formatString
        .replace(/{Killer}/g, 'Player1')
        .replace(/{Victim}/g, 'Player2')
        .replace(/{KillerKD}/g, '5.2')
        .replace(/{VictimKD}/g, '2.1')
        .replace(/{KillerStreak}/g, '3')
        .replace(/{VictimStreak}/g, '1')
        .replace(/{KillerHighest}/g, '8')
        .replace(/{VictimHighest}/g, '4');

      const embed = successEmbed(
        'Killfeed Format Updated',
        `**${serverName}** killfeed format has been updated.`
      );

      embed.addFields({
        name: '📋 Current Configuration',
        value: `**Status:** ${killfeed.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Format:** ${formatString}`,
        inline: false
      });

      embed.addFields({
        name: '👀 Preview',
        value: preview,
        inline: false
      });

      embed.addFields({
        name: '🔧 Available Placeholders',
        value: '`{Killer}` - Killer name\n`{Victim}` - Victim name\n`{KillerKD}` - Killer K/D ratio\n`{VictimKD}` - Victim K/D ratio\n`{KillerStreak}` - Killer kill streak\n`{VictimStreak}` - Victim kill streak\n`{KillerHighest}` - Killer highest streak\n`{VictimHighest}` - Victim highest streak',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error updating killfeed format:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to update killfeed format. Please try again.')]
      });
    }
  },
}; 