const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-servers')
    .setDescription('List all Rust servers in this guild'),

  async execute(interaction) {
    // Check if user is authorized (only you can use this command)
    if (interaction.user.id !== '1252993829007528086') {
      return interaction.reply({
        embeds: [orangeEmbed('❌ Access Denied', 'You do not have permission to use this command.')],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const guildId = interaction.guildId;

    try {
      // Get all servers for this guild
      const serversResult = await pool.query(
        'SELECT rs.nickname, rs.ip, rs.port, rs.rcon_password FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 ORDER BY rs.nickname',
        [guildId]
      );

      if (serversResult.rows.length === 0) {
        return interaction.editReply(orangeEmbed(
          '🖥️ Servers',
          'No servers found in this guild.\n\nUse `/add-server` to add your first server!'
        ));
      }

      let serverList = '';
      serversResult.rows.forEach((server, index) => {
        serverList += `**${index + 1}. ${server.nickname}**\n`;
        serverList += `   • **IP:** ${server.ip}:${server.port}\n`;
        serverList += `   • **RCON:** ${server.rcon_password ? 'Configured' : 'Not configured'}\n\n`;
      });

      await interaction.editReply(orangeEmbed(
        '🖥️ Servers',
        serverList
      ));

    } catch (error) {
      console.error('Error listing servers:', error);
      await interaction.editReply(orangeEmbed('Error', 'Failed to list servers. Please try again.'));
    }
  },
}; 