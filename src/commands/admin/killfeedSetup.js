const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killfeed-setup')
    .setDescription('Customize killfeed format for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('format')
        .setDescription('Killfeed format string (use variables like {Victim}, {Killer}, etc.)')
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
    await interaction.deferReply();

    const serverNickname = interaction.options.getString('server');
    const format = interaction.options.getString('format');
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

      // Check if killfeed config exists
      let configResult = await pool.query(
        'SELECT id FROM killfeed_configs WHERE server_id = $1',
        [serverId]
      );

      if (configResult.rows.length === 0) {
        // Create new killfeed config
        await pool.query(
          'INSERT INTO killfeed_configs (server_id, enabled, format_string) VALUES ($1, $2, $3)',
          [serverId, true, format]
        );
      } else {
        // Update existing config
        await pool.query(
          'UPDATE killfeed_configs SET format_string = $1 WHERE server_id = $2',
          [format, serverId]
        );
      }

      // Show available variables
      const variables = [
        '{Victim} - Victim name',
        '{Killer} - Killer name', 
        '{VictimKD} - Victim K/D ratio',
        '{KillerKD} - Killer K/D ratio',
        '{KillerStreak} - Killer kill streak',
        '{VictimStreak} - Victim kill streak',
        '{VictimHighest} - Victim highest streak',
        '{KillerHighest} - Killer highest streak'
      ];

      await interaction.editReply(orangeEmbed(
        '✅ Killfeed Format Updated',
        `Killfeed format for **${serverNickname}** has been updated.\n\n**New Format:** ${format}\n\n**Available Variables:**\n${variables.join('\n')}`
      ));

    } catch (error) {
      console.error('Error updating killfeed format:', error);
      await interaction.editReply(orangeEmbed('Error', 'Failed to update killfeed format. Please try again.'));
    }
  },
}; 