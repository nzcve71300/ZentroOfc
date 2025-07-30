const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-channels')
    .setDescription('List all configured channels for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to check')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    try {
      const guildId = interaction.guildId;
      
      const [result] = await pool.query(
        `SELECT rs.nickname
         FROM rust_servers rs
         JOIN guilds g ON rs.guild_id = g.id
         WHERE g.discord_id = ?`,
        [guildId]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in list-channels autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Get server info
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

      // Get all channel settings for this server
      const [channelSettings] = await pool.query(
        `SELECT cs.channel_type, cs.channel_id, cs.created_at, cs.updated_at
         FROM channel_settings cs
         WHERE cs.server_id = ?`,
        [serverId]
      );

      if (channelSettings.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'No Channels Configured',
            `No channels are configured for **${serverName}**.\n\nUse \`/channel-set\` to configure channels.`
          )]
        });
      }

      // Create fields for each channel type
      const fields = channelSettings.map(setting => {
        const channelMention = `<#${setting.channel_id}>`;
        const lastUpdated = new Date(setting.updated_at).toLocaleDateString();
        
        return {
          name: `${setting.channel_type.charAt(0).toUpperCase() + setting.channel_type.slice(1)}`,
          value: `Channel: ${channelMention}\nLast Updated: ${lastUpdated}`,
          inline: true
        };
      });

      await interaction.editReply({
        embeds: [orangeEmbed(
          `Channel Configuration - ${serverName}`,
          `Found **${channelSettings.length}** configured channel(s) for this server.`,
          fields
        )]
      });

    } catch (error) {
      console.error('Error in list-channels command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to list channels. Please try again.')]
      });
    }
  }
}; 