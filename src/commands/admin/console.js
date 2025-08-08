const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('console')
    .setDescription('Send RCON commands directly to the server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to send the command to')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('input')
        .setDescription('The RCON command to execute')
        .setRequired(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [servers] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ?',
        [guildId, `%${focusedValue}%`]
      );

      await interaction.respond(
        servers.map(server => ({ name: server.nickname, value: server.nickname }))
      );
    } catch (error) {
      console.error('Console autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');
    const commandInput = interaction.options.getString('input');

    try {
      // Check if user has admin permissions (Administrator OR ZentroAdmin role)
      const member = await interaction.guild.members.fetch(userId);
      if (!hasAdminPermissions(member)) {
        return sendAccessDeniedMessage(interaction, false);
      }

      // Get server
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Send command via RCON
      console.log(`[CONSOLE] ${interaction.user.tag} (${userId}) executing: ${commandInput} on ${server.nickname}`);
      
      const { sendRconCommand } = require('../../rcon');
      const response = await sendRconCommand(server.ip, server.port, server.password, commandInput);
      
      // Create rich embed for the response
      const embed = orangeEmbed('🎮 **RCON CONSOLE** 🎮', `Command executed successfully on **${server.nickname}**`);
      
      embed.addFields(
        { name: '👤 **Executor**', value: `${interaction.user.tag}`, inline: true },
        { name: '🎯 **Command**', value: `\`${commandInput}\``, inline: true },
        { name: '🖥️ **Server**', value: `${server.nickname}`, inline: true }
      );

      if (response && response.trim()) {
        embed.addFields(
          { name: '📡 **Response**', value: `\`\`\`${response.trim()}\`\`\``, inline: false }
        );
      } else {
        embed.addFields(
          { name: '📡 **Response**', value: '`Command executed successfully (no response)`', inline: false }
        );
      }

      embed.setFooter({ text: '🔧 Admin Console • RCON Direct Access' });
      embed.setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Console command error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Execution Error', `Failed to execute command on ${serverOption}. Error: ${err.message}`)]
      });
    }
  }
}; 