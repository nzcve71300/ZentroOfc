const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-to-kit-list')
    .setDescription('Add a player to a kit authorization list')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Player name (Discord username or in-game name)')
        .setRequired(true)
        .setMaxLength(50))
    .addStringOption(option =>
      option.setName('kitlist')
        .setDescription('Select which kit list to add to')
        .setRequired(true)
        .addChoices(
          { name: 'VIP Kits', value: 'VIPkit' },
          { name: 'Elite List 1', value: 'Elite1' },
          { name: 'Elite List 2', value: 'Elite2' },
          { name: 'Elite List 3', value: 'Elite3' },
          { name: 'Elite List 4', value: 'Elite4' },
          { name: 'Elite List 5', value: 'Elite5' }
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
    const playerName = interaction.options.getString('name');
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

      // Find player by Discord username or in-game name
      const [playerResult] = await pool.query(
        `SELECT p.id, p.discord_id, p.ign
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE g.discord_id = ? AND rs.id = ? AND (p.ign LIKE ? OR p.discord_id = ? OR p.discord_id IS NULL)
         ORDER BY p.ign`,
        [guildId, serverId, playerName]
      );

      if (playerResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not Found', `No player found with name "${playerName}" on ${serverName}.`)]
        });
      }

      if (playerResult.length > 1) {
        // Multiple players found - show options
        const embed = orangeEmbed(
          'Multiple Players Found',
          `Found ${playerResult.length} players matching "${playerName}". Please be more specific:`
        );

        for (const player of playerResult) {
          embed.addFields({
            name: `👤 ${player.ign || 'Unknown'}`,
            value: `**Discord ID:** ${player.discord_id || 'Not linked'}`,
            inline: true
          });
        }

        return interaction.editReply({
          embeds: [embed]
        });
      }

      const player = playerResult[0];

      // Check if player is already in this kit list
      const [existingResult] = await pool.query(
        'SELECT id FROM kit_auth WHERE server_id = ? AND discord_id = ? AND kitlist = ?',
        [serverId, player.discord_id, kitlist]
      );

      if (existingResult.length > 0) {
        const kitType = kitlist === 'VIPkit' ? 'VIP kits' : `${kitlist} elite kits`;
        return interaction.editReply({
          embeds: [errorEmbed('Already in List', `${player.ign || 'Player'} is already authorized for ${kitType} on ${serverName}.`)]
        });
      }

      // If player doesn't have a Discord ID, we can't add them to kit list
      if (!player.discord_id) {
        return interaction.editReply({
          embeds: [errorEmbed('No Discord Link', `${player.ign || 'Player'} doesn't have a Discord account linked. They need to use \`/link <in-game-name>\` first.`)]
        });
      }

      // Add player to kit list
      await pool.query(
        'INSERT INTO kit_auth (server_id, discord_id, kitlist) VALUES (?, ?, ?)',
        [serverId, player.discord_id, kitlist]
      );

      const kitType = kitlist === 'VIPkit' ? 'VIP kits' : `${kitlist} elite kits`;
      await interaction.editReply({
        embeds: [successEmbed(
          'Player Added to Kit List',
          `**Player:** ${player.ign || 'Unknown'}\n**Server:** ${serverName}\n**Authorization:** ${kitType}\n\nPlayer has been authorized for ${kitType} successfully.`
        )]
      });

    } catch (error) {
      console.error('Error adding player to kit list:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to add player to kit list. Please try again.')]
      });
    }
  },
}; 