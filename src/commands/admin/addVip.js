const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { sendRconCommand } = require('../../rcon');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-vip')
    .setDescription('Add VIP status to a player on a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Player name to add VIP to')
        .setRequired(true)),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guildId;

    try {
      if (focusedOption.name === 'server') {
        // Server autocomplete
        const [result] = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
          [guildId, `%${focusedOption.value}%`]
        );

        const choices = result.map(row => ({
          name: row.nickname,
          value: row.nickname
        }));

        await interaction.respond(choices);
      } else {
        // For any other field, return empty array
        await interaction.respond([]);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
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
    const playerName = interaction.options.getString('player');
    const guildId = interaction.guildId;

    try {
      // Get server details
      const [serverResult] = await pool.query(
        'SELECT id, ip, port, password FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, serverNickname]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', `Server "${serverNickname}" was not found.`)]
        });
      }

      const server = serverResult[0];

      // Send VIP command to server
      const command = `vipid "${playerName}"`;
      console.log(`[ADD VIP] Sending command to ${serverNickname}: ${command}`);
      
      const response = await sendRconCommand(server.ip, server.port, server.password, command);
      console.log(`[ADD VIP] Response from server:`, response);

      // Create success embed
      const embed = successEmbed(
        '✅ VIP Added Successfully',
        `**Player:** ${playerName}\n**Server:** ${serverNickname}\n**Command:** \`${command}\`\n\nVIP status has been added to the player.`
      );

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error adding VIP:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', `Failed to add VIP status to ${playerName} on ${serverNickname}. Error: ${error.message}`)]
      });
    }
  },
};
