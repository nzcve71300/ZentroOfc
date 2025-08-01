const { SlashCommandBuilder } = require('discord.js');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { canAddServer, incrementActiveServers } = require('../../utils/subscriptionSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-server')
    .setDescription('Add a Rust server to the bot')
    .addStringOption(option =>
      option.setName('nickname')
        .setDescription('Server nickname (e.g., Main Server, PvP Server)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('server_ip')
        .setDescription('Server IP address')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('rcon_port')
        .setDescription('RCON port (default: 28016)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('rcon_password')
        .setDescription('RCON password')
        .setRequired(false)),

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply();

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const nickname = interaction.options.getString('nickname');
    const ip = interaction.options.getString('server_ip');
    const port = interaction.options.getInteger('rcon_port') || 28016;
    const rconPassword = interaction.options.getString('rcon_password') || '';
    const guildId = interaction.guildId;

    // Validate inputs
    if (!nickname || nickname.trim() === '' || nickname.toLowerCase().includes('unknown') || nickname.toLowerCase().includes('placeholder')) {
      return interaction.editReply({
        embeds: [errorEmbed('Invalid Nickname', 'Server nickname cannot be empty, "Unknown", or "Placeholder". Please provide a proper server name.')]
      });
    }

    if (!ip || ip.trim() === '' || ip === '0.0.0.0' || ip === 'PLACEHOLDER_IP' || ip === 'localhost' || ip === '127.0.0.1') {
      return interaction.editReply({
        embeds: [errorEmbed('Invalid IP', 'Please provide a valid server IP address. Cannot use placeholder or localhost addresses.')]
      });
    }

    // Basic IP format validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return interaction.editReply({
        embeds: [errorEmbed('Invalid IP Format', 'Please provide a valid IP address in the format: xxx.xxx.xxx.xxx')]
      });
    }

    try {
      // Check subscription limits
      const subscriptionCheck = await canAddServer(guildId);
      if (!subscriptionCheck.canAdd) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Server Limit Reached',
            `You can only add up to **${subscriptionCheck.allowed}** servers. You currently have **${subscriptionCheck.active}** active servers.\n\nUpgrade your subscription to add more servers.`
          )]
        });
      }

      // Check if server already exists
      const [existingServer] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
        [guildId, nickname]
      );

      if (existingServer.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Exists', `A server with nickname **${nickname}** already exists in this guild.`)]
        });
      }

      // Generate a unique server ID
      const serverId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add the server with the generated ID
      const [serverResult] = await pool.query(
        'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, rcon_password) VALUES (?, ?, ?, ?, ?, ?)',
        [serverId, guildId, nickname, ip, port, rconPassword]
      );

      // Increment active servers count
      await incrementActiveServers(guildId);

      const successEmbedObj = successEmbed(
        'Server Added Successfully',
        `**${nickname}** has been added successfully!\n\n**IP:** ${ip}:${port}\n**RCON:** ${rconPassword ? 'Configured' : 'Not configured'}\n\nYou can now use this server in other commands with autocomplete.`
      );

      await interaction.editReply({ embeds: [successEmbedObj] });

    } catch (error) {
      console.error('Error adding server:', error);
      
      let errorMessage = 'Failed to add server. Please try again.';
      
      // Handle specific database errors
      if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        errorMessage = 'Database permission error. Please check MySQL user permissions. Contact the bot owner.';
      } else if (error.code === 'ER_DUP_ENTRY') {
        errorMessage = 'A server with this nickname already exists.';
      } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        errorMessage = 'Missing required data. Please check all required fields.';
      }
      
      await interaction.editReply({
        embeds: [errorEmbed('Database Error', errorMessage)]
      });
    }
  },
}; 