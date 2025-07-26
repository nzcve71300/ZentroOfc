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
    const serverNickname = interaction.options.getString('server');
    const channel = interaction.options.getChannel('channel');
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

      // Check if killfeed config already exists
      const existingResult = await pool.query(
        'SELECT id FROM killfeed_configs WHERE server_id = $1',
        [serverId]
      );

      if (existingResult.rows.length > 0) {
        // Update existing config
        await pool.query(
          'UPDATE killfeed_configs SET channel_id = $1 WHERE server_id = $2',
          [channel.id, serverId]
        );
      } else {
        // Create new config
        await pool.query(
          'INSERT INTO killfeed_configs (server_id, channel_id) VALUES ($1, $2)',
          [serverId, channel.id]
        );
      }

      await interaction.reply({
        embeds: [orangeEmbed(
          '🔫 Killfeed Setup',
          `Killfeed has been configured for **${serverNickname}**.\n\n**Channel:** ${channel}\n\nKill events will now be posted to this channel.`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error setting up killfeed:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to setup killfeed. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 