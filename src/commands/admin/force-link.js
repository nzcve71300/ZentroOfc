const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force-link')
    .setDescription('Forcefully link a Discord user to an in-game player name (Admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server nickname')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The in-game player name to link')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The Discord user to link')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const choices = ['Rise 3x', 'EMPEROR 3X'];
    const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase()));
    await interaction.respond(
      filtered.map(choice => ({ name: choice, value: choice })).slice(0, 25)
    );
  },

  async execute(interaction) {
    try {
      const serverNickname = interaction.options.getString('server');
      const playerName = interaction.options.getString('name');
      const discordUser = interaction.options.getUser('user');

      // Get server information
      const server = await getServerByNickname(serverNickname);
      if (!server) {
        return interaction.reply({
          content: '❌ **Server not found!** Please check the server nickname.',
          ephemeral: true
        });
      }

      // Use server.id (rust_servers.id string) for database operations
      const serverId = server.id;

      // Check if player already exists in the database
      const [existingPlayers] = await pool.query(
        'SELECT * FROM players WHERE LOWER(ign) = LOWER(?) AND server_id = ?',
        [playerName, serverId]
      );

      if (existingPlayers.length > 0) {
        // Update existing player record
        await pool.query(
          'UPDATE players SET discord_id = ?, updated_at = NOW() WHERE id = ?',
          [discordUser.id, existingPlayers[0].id]
        );

        return interaction.reply({
          content: `✅ **Successfully force-linked!**\n\n**Player:** ${playerName}\n**Discord User:** ${discordUser}\n**Server:** ${serverNickname}\n\n*Updated existing player record.*`,
          ephemeral: true
        });
      } else {
        // Create new player record
        await pool.query(
          'INSERT INTO players (ign, discord_id, server_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [playerName, discordUser.id, serverId]
        );

        return interaction.reply({
          content: `✅ **Successfully force-linked!**\n\n**Player:** ${playerName}\n**Discord User:** ${discordUser}\n**Server:** ${serverNickname}\n\n*Created new player record.*`,
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Force link error:', error);
      return interaction.reply({
        content: '❌ **Force link failed!** An error occurred while processing the request.',
        ephemeral: true
      });
    }
  },
}; 