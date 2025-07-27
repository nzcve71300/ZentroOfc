const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel-set')
    .setDescription('Set up Discord channels for bot feeds')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Select the Discord channel')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('channel_type')
        .setDescription('Select the channel type')
        .setRequired(true)
        .addChoices(
          { name: 'Playercount (Voice Channel)', value: 'playercount' },
          { name: 'Playerfeed (Text Channel)', value: 'playerfeed' },
          { name: 'Admin feed (Text Channel)', value: 'adminfeed' },
          { name: 'Note feed (Text Channel)', value: 'notefeed' }
        )),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = $1 AND rs.nickname ILIKE $2 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
        name: row.nickname,
        value: row.id.toString()
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in channel-set autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverId = parseInt(interaction.options.getString('server'));
    const channel = interaction.options.getChannel('channel');
    const channelType = interaction.options.getString('channel_type');
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const serverResult = await pool.query(
        `SELECT rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.id = $1 AND g.discord_id = $2`,
        [serverId, guildId]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const serverName = serverResult.rows[0].nickname;

      // Validate channel type requirements
      if (channelType === 'playercount' && channel.type !== 2) { // 2 = voice channel
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Channel Type', 'Playercount must be set to a voice channel.')]
        });
      }

      if (channelType !== 'playercount' && channel.type !== 0) { // 0 = text channel
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Channel Type', `${channelType} must be set to a text channel.`)]
        });
      }

      // Check if channel setting already exists for this server and type
      const existingResult = await pool.query(
        'SELECT * FROM channel_settings WHERE server_id = $1 AND channel_type = $2',
        [serverId, channelType]
      );

      if (existingResult.rows.length > 0) {
        // Update existing setting
        await pool.query(
          'UPDATE channel_settings SET channel_id = $1, updated_at = NOW() WHERE server_id = $2 AND channel_type = $3',
          [channel.id, serverId, channelType]
        );

        await interaction.editReply({
          embeds: [successEmbed(
            'Channel Updated',
            `**${channelType}** channel for **${serverName}** has been updated to <#${channel.id}>`
          )]
        });
      } else {
        // Create new setting
        await pool.query(
          'INSERT INTO channel_settings (server_id, channel_type, channel_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [serverId, channelType, channel.id]
        );

        await interaction.editReply({
          embeds: [successEmbed(
            'Channel Set',
            `**${channelType}** channel for **${serverName}** has been set to <#${channel.id}>`
          )]
        });
      }

    } catch (error) {
      console.error('Error in channel-set command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to set channel. Please try again.')]
      });
    }
  }
}; 