const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { sendFeedEmbed } = require('../../rcon');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test-message')
    .setDescription('Send a test message to a configured channel')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to test')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('channel_type')
        .setDescription('The type of channel to test')
        .setRequired(true)
        .addChoices(
          { name: 'Player Feed', value: 'playerfeed' },
          { name: 'Admin Feed', value: 'adminfeed' },
          { name: 'Note Feed', value: 'notefeed' },
          { name: 'Kill Feed', value: 'killfeed' }
        )),

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
      console.error('Error in test-message autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guildId;
      const serverName = interaction.options.getString('server');
      const channelType = interaction.options.getString('channel_type');

      // Check if user has admin permissions
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.editReply({
          embeds: [errorEmbed('❌ **Permission Denied**\nYou need Administrator permissions to use this command.')]
        });
      }

      // Check if channel is configured
      const [channelResult] = await pool.query(
        `SELECT cs.channel_id 
         FROM channel_settings cs 
         JOIN rust_servers rs ON cs.server_id = rs.id 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname = ? AND cs.channel_type = ?`,
        [guildId, serverName, channelType]
      );

      if (channelResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed(`❌ **Channel Not Configured**\nNo ${channelType} channel configured for ${serverName}.\nUse \`/channel-set\` to configure channels.`)]
        });
      }

      const testMessage = `🧪 **TEST MESSAGE** - This is a test message sent at ${new Date().toLocaleTimeString()} to verify channel configuration is working!`;

      // Send the test message
      await sendFeedEmbed(interaction.client, guildId, serverName, channelType, testMessage);

      return interaction.editReply({
        embeds: [successEmbed(`✅ **Test Message Sent**\nTest message sent to ${channelType} channel for ${serverName}!\nCheck the channel to see if the message was delivered.`)]
      });

    } catch (error) {
      console.error('Error in test-message command:', error);
      return interaction.editReply({
        embeds: [errorEmbed(`❌ **Error**\nFailed to send test message: ${error.message}`)]
      });
    }
  }
}; 