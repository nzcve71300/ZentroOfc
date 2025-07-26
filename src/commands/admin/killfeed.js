const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killfeed')
    .setDescription('Enable or disable killfeed for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Enable or disable killfeed')
        .setRequired(true)
        .addChoices(
          { name: 'Enable', value: 'on' },
          { name: 'Disable', value: 'off' }
        )),

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
    const option = interaction.options.getString('option');
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
          [serverId, option === 'on', '{Victim} was killed by {Killer}']
        );
      } else {
        // Update existing config
        await pool.query(
          'UPDATE killfeed_configs SET enabled = $1 WHERE server_id = $2',
          [option === 'on', serverId]
        );
      }

      const status = option === 'on' ? 'enabled' : 'disabled';

      await interaction.editReply(orangeEmbed(
        '✅ Killfeed Updated',
        `Killfeed for **${serverNickname}** has been **${status}**.\n\nUse \`/killfeed-setup\` to customize the killfeed format.`
      ));

    } catch (error) {
      console.error('Error updating killfeed:', error);
      await interaction.editReply(orangeEmbed('Error', 'Failed to update killfeed. Please try again.'));
    }
  },
}; 