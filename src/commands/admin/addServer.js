const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
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

    // Check if user is authorized (only you can use this command)
    if (interaction.user.id !== '1252993829007528086') {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'You do not have permission to use this command.')]
      });
    }

    const nickname = interaction.options.getString('nickname');
    const ip = interaction.options.getString('server_ip');
    const port = interaction.options.getInteger('rcon_port') || 28016;
    const rconPassword = interaction.options.getString('rcon_password') || '';
    const guildId = interaction.guildId;

    try {
      // Check if guild exists, if not create it
      let guildResult = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = $1',
        [guildId]
      );

      if (guildResult.rows.length === 0) {
        // Create guild with explicit ID to avoid sequence permission issues
        const newGuildResult = await pool.query(
          'INSERT INTO guilds (discord_id, name) VALUES ($1, $2) RETURNING id',
          [guildId, interaction.guild.name]
        );
        guildResult = newGuildResult;
      }

      const guildDbId = guildResult.rows[0].id;

      // Check if server already exists
      const existingServer = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = $1 AND nickname = $2',
        [guildDbId, nickname]
      );

      if (existingServer.rows.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Exists', `A server with nickname **${nickname}** already exists in this guild.`)]
        });
      }

      // Add the server
      await pool.query(
        'INSERT INTO rust_servers (guild_id, nickname, ip, port, password) VALUES ($1, $2, $3, $4, $5)',
        [guildDbId, nickname, ip, port, rconPassword]
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
      if (error.code === '42501') {
        errorMessage = 'Database permission error. Please check PostgreSQL user permissions. Contact the bot owner.';
      } else if (error.code === '23505') {
        errorMessage = 'A server with this nickname already exists.';
      } else if (error.code === '23502') {
        errorMessage = 'Missing required data. Please check all required fields.';
      }
      
      await interaction.editReply({
        embeds: [errorEmbed('Database Error', errorMessage)]
      });
    }
  },
}; 