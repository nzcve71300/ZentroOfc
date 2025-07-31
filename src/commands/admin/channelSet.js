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
          { name: 'Note feed (Text Channel)', value: 'notefeed' },
          { name: 'Killfeed (Text Channel)', value: 'killfeed' },
          { name: 'ZORP feed (Text Channel)', value: 'zorpfeed' }
        )),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname LIKE ? 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
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

    const serverNickname = interaction.options.getString('server');
    const channel = interaction.options.getChannel('channel');
    const channelType = interaction.options.getString('channel_type');
    const guildId = interaction.guildId;

    try {
            // Verify server exists and belongs to this guild
      const [serverResult] = await pool.query(
        `SELECT rs.id, rs.nickname
         FROM rust_servers rs
         JOIN guilds g ON rs.guild_id = g.id
         WHERE rs.nickname = ? AND g.discord_id = ?`,
        [serverNickname, guildId]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const serverId = serverResult[0].id;
      const serverName = serverResult[0].nickname;

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
      const [existingResult] = await pool.query(
        'SELECT * FROM channel_settings WHERE server_id = ? AND channel_type = ?',
        [serverId, channelType]
      );

      try {
        if (existingResult.length > 0) {
          // Update existing setting
          await pool.query(
            'UPDATE channel_settings SET channel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND channel_type = ?',
            [channel.id, serverId, channelType]
          );

          await interaction.editReply({
            embeds: [successEmbed(
              'Channel Updated',
              `**${channelType}** channel for **${serverName}** has been updated to <#${channel.id}>\n\nPrevious channel: <#${existingResult[0].channel_id}>`
            )]
          });
        } else {
          // Create new setting
          await pool.query(
            'INSERT INTO channel_settings (server_id, channel_type, channel_id, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [serverId, channelType, channel.id]
          );

          await interaction.editReply({
            embeds: [successEmbed(
              'Channel Set',
              `**${channelType}** channel for **${serverName}** has been set to <#${channel.id}>`
            )]
          });
        }
      } catch (dbError) {
        console.error('Database error in channel-set:', dbError);
        
        // If there's a foreign key constraint error, try to clean up and retry
        if (dbError.code === 'ER_NO_REFERENCED_ROW_2') {
          await interaction.editReply({
            embeds: [errorEmbed('Database Error', 'There was an issue with the database constraint. Please try again or contact support.')]
          });
        } else {
          await interaction.editReply({
            embeds: [errorEmbed('Database Error', `Failed to set channel: ${dbError.message}`)]
          });
        }
      }

    } catch (error) {
      console.error('Error in channel-set command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to set channel. Please try again.')]
      });
    }
  }
}; 