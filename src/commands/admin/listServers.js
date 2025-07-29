const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-servers')
    .setDescription('List all Rust servers in this guild'),

  async execute(interaction) {
    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, true);
    }

    const guildId = interaction.guildId;

    try {
      // Get all servers for this guild
      const serversResult = await pool.query(
        'SELECT rs.nickname, rs.ip, rs.port, rs.password FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? ORDER BY rs.nickname',
        [guildId]
      );

      if (serversResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed(
            '🖥️ Servers',
            'No servers found in this guild.\n\nUse `/add-server` to add your first server!'
          )],
          ephemeral: true
        });
      }

      let serverList = '';
      serversResult.rows.forEach((server, index) => {
        serverList += `**${index + 1}. ${server.nickname}**\n`;
        serverList += `   • **IP:** ${server.ip}:${server.port}\n`;
        serverList += `   • **RCON:** ${server.password ? 'Configured' : 'Not configured'}\n\n`;
      });

      await interaction.reply({
        embeds: [orangeEmbed(
          '🖥️ Servers',
          serverList
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error listing servers:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to list servers. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 