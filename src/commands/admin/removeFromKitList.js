const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-from-kit-list')
    .setDescription('Remove a player from a kit authorization list')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Player name to remove')
        .setRequired(true)
        .setMaxLength(50))
    .addStringOption(option =>
      option.setName('kitlist')
        .setDescription('Select which kit list to remove from')
        .setRequired(true)
        .addChoices(
          { name: 'VIP Kits', value: 'VIPkit' },
          { name: 'Elite List 1', value: 'Elite1' },
          { name: 'Elite List 2', value: 'Elite2' },
          { name: 'Elite List 3', value: 'Elite3' },
          { name: 'Elite List 4', value: 'Elite4' },
          { name: 'Elite List 5', value: 'Elite5' },
          { name: 'Elite List 6', value: 'Elite6' }
        )),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverOption = interaction.options.getString('server');
    const playerName = interaction.options.getString('player');
    const kitlist = interaction.options.getString('kitlist');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const [serverResult] = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
        [guildId, serverOption]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult[0].id;
      const serverName = serverResult[0].nickname;

      // Find player by in-game name
      const [playerResult] = await pool.query(
        'SELECT p.id, p.discord_id, p.ign FROM players p WHERE p.server_id = ? AND p.ign = ?',
        [serverId, playerName]
      );

      if (playerResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Found', `No player found with name "${playerName}" on ${serverName}.`)]
        });
      }

      const player = playerResult[0];

      // Check if player is in this kit list
      const [existingResult] = await pool.query(
        'SELECT id FROM kit_auth WHERE server_id = ? AND discord_id = ? AND kitlist = ?',
        [serverId, player.discord_id, kitlist]
      );

      if (existingResult.length === 0) {
        const kitType = kitlist === 'VIPkit' ? 'VIP kits' : `${kitlist} elite kits`;
        return interaction.editReply({
          embeds: [errorEmbed('Not in List', `${player.ign} is not authorized for ${kitType} on ${serverName}.`)]
        });
      }

      // Remove player from kit list
      await pool.query(
        'DELETE FROM kit_auth WHERE server_id = ? AND discord_id = ? AND kitlist = ?',
        [serverId, player.discord_id, kitlist]
      );

      const kitType = kitlist === 'VIPkit' ? 'VIP kits' : `${kitlist} elite kits`;
      await interaction.editReply({
        embeds: [successEmbed(
          'Player Removed from Kit List',
          `**Player:** ${player.ign}\n**Server:** ${serverName}\n**Authorization:** ${kitType}\n\nPlayer has been removed from ${kitType} authorization.`
        )]
      });

    } catch (error) {
      console.error('Error removing player from kit list:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to remove player from kit list. Please try again.')]
      });
    }
  },
}; 