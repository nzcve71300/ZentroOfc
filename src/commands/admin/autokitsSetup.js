const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autokits-setup')
    .setDescription('Configure autokits for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('setup')
        .setDescription('What to configure')
        .setRequired(true)
        .addChoices(
          { name: 'FREEkit1', value: 'FREEkit1' },
          { name: 'FREEkit2', value: 'FREEkit2' },
          { name: 'VIPkit', value: 'VIPkit' },
          { name: 'ELITEkit1', value: 'ELITEkit1' },
          { name: 'ELITEkit2', value: 'ELITEkit2' },
          { name: 'ELITEkit3', value: 'ELITEkit3' },
          { name: 'ELITEkit4', value: 'ELITEkit4' },
          { name: 'ELITEkit5', value: 'ELITEkit5' }
        ))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Configuration option')
        .setRequired(true)
        .addChoices(
          { name: 'Enable/Disable', value: 'enabled' },
          { name: 'Cooldown (minutes)', value: 'cooldown' },
          { name: 'Kit Name', value: 'kit_name' }
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('Value for the option (on/off for enabled, number for cooldown, text for kit name)')
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
    const setup = interaction.options.getString('setup');
    const option = interaction.options.getString('option');
    const value = interaction.options.getString('value');
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

      // Check if autokit exists
      let autokitResult = await pool.query(
        'SELECT id FROM autokits WHERE server_id = $1 AND kit_name = $2',
        [serverId, setup]
      );

      if (autokitResult.rows.length === 0) {
        // Create new autokit
        await pool.query(
          'INSERT INTO autokits (server_id, kit_name, enabled, cooldown, game_name) VALUES ($1, $2, $3, $4, $5)',
          [serverId, setup, false, 60, setup]
        );
      }

      // Update the specific option
      let updateQuery;
      let updateValue;

      switch (option) {
        case 'enabled':
          updateValue = value.toLowerCase() === 'on' || value.toLowerCase() === 'true';
          updateQuery = 'UPDATE autokits SET enabled = $1 WHERE server_id = $2 AND kit_name = $3';
          break;
        case 'cooldown':
          updateValue = parseInt(value);
          if (isNaN(updateValue) || updateValue < 0) {
            return interaction.editReply(orangeEmbed('Error', 'Cooldown must be a positive number.'));
          }
          updateQuery = 'UPDATE autokits SET cooldown = $1 WHERE server_id = $2 AND kit_name = $3';
          break;
        case 'kit_name':
          updateValue = value;
          updateQuery = 'UPDATE autokits SET game_name = $1 WHERE server_id = $2 AND kit_name = $3';
          break;
        default:
          return interaction.editReply(orangeEmbed('Error', 'Invalid option.'));
      }

      await pool.query(updateQuery, [updateValue, serverId, setup]);

      const statusText = option === 'enabled' ? (updateValue ? 'enabled' : 'disabled') : `set to ${updateValue}`;

      await interaction.editReply(orangeEmbed(
        '✅ Autokit Updated',
        `**${setup}** on **${serverNickname}** has been updated.\n\n**${option}:** ${statusText}`
      ));

    } catch (error) {
      console.error('Error updating autokit:', error);
      await interaction.editReply(orangeEmbed('Error', 'Failed to update autokit. Please try again.'));
    }
  },
}; 