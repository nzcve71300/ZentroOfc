const { SlashCommandBuilder } = require('discord.js');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { errorEmbed, successEmbed } = require('../../embeds/format');
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
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const nickname = interaction.options.getString('nickname');
    const ip = interaction.options.getString('server_ip');
    const port = interaction.options.getInteger('rcon_port') || 28016;
    const rconPassword = interaction.options.getString('rcon_password') || '';
    const guildId = interaction.guildId;

    try {
      // Check if guild exists, if not create it
      const [guildResult] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [guildId]
      );

      let guildDbId;
      if (guildResult.length === 0) {
        // Create guild
        const [newGuildResult] = await pool.query(
          'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
          [guildId, interaction.guild.name]
        );
        guildDbId = newGuildResult.insertId;
      } else {
        guildDbId = guildResult[0].id;
      }

      // Check if server already exists
      const [existingServer] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
        [guildDbId, nickname]
      );

      if (existingServer.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Exists', `A server with nickname **${nickname}** already exists in this guild.`)]
        });
      }

      // Generate a unique server ID (shorter to fit VARCHAR(32))
      const serverId = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      // Add the server
      await pool.query(
        'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password) VALUES (?, ?, ?, ?, ?, ?)',
        [serverId, guildDbId, nickname, ip, port, rconPassword]
      );

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