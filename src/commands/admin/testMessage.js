const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { sendFeedEmbed } = require('../../rcon');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test-message')
    .setDescription('Test sending a message to configured channels')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('channel_type')
        .setDescription('Select the channel type to test')
        .setRequired(true)
        .addChoices(
          { name: 'Playerfeed', value: 'playerfeed' },
          { name: 'Admin feed', value: 'adminfeed' },
          { name: 'Note feed', value: 'notefeed' }
        )),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        `SELECT rs.nickname
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
      console.error('Test message autocomplete error:', error);
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

      // Check if channel is configured
      const [channelResult] = await pool.query(
        'SELECT * FROM channel_settings WHERE server_id = ? AND channel_type = ?',
        [serverId, channelType]
      );

      if (channelResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Channel Not Configured', `No ${channelType} channel configured for ${serverName}. Use /channel-set to configure it.`)]
        });
      }

      // Send test message
      const testMessage = `🧪 **TEST MESSAGE** - This is a test message sent at ${new Date().toLocaleTimeString()} to verify the channel system is working!`;
      
      console.log(`[TEST] Sending test message to ${serverName} ${channelType}: ${testMessage}`);
      
      await sendFeedEmbed(interaction.client, guildId, serverName, channelType, testMessage);

      await interaction.editReply({
        embeds: [successEmbed(
          'Test Message Sent',
          `✅ Test message sent to **${channelType}** channel for **${serverName}**!\n\nCheck the channel to see if the message was delivered.`
        )]
      });

    } catch (error) {
      console.error('Test message error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', `Failed to send test message: ${error.message}`)]
      });
    }
  }
}; 