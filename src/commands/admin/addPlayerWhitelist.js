const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-player-whitelist')
    .setDescription('Add a player to the whitelist')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('config')
        .setDescription('Select whitelist type')
        .setRequired(true)
        .addChoices(
          { name: 'Home Teleport', value: 'home_teleport' },
          { name: 'Zorp', value: 'zorp' }
        ))
    .addStringOption(option =>
      option.setName('playername')
        .setDescription('Player name to add to whitelist')
        .setRequired(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname LIKE ? 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in add-player-whitelist autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const whitelistType = interaction.options.getString('config');
    const playerName = interaction.options.getString('playername');
    const guildId = interaction.guildId;
    const adminId = interaction.user.id;

    try {
      // Verify server exists and belongs to this guild
      const [serverResult] = await pool.query(
        `SELECT rs.id, rs.nickname
         FROM rust_servers rs
         JOIN guilds g ON rs.guild_id = g.id
         WHERE rs.nickname = ? AND g.discord_id = ?`,
        [serverNickname, guildId]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const serverId = serverResult[0].id;
      const serverName = serverResult[0].nickname;

      // Check if player is already whitelisted
      const [existingResult] = await pool.query(
        'SELECT * FROM player_whitelists WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND player_name = ? AND whitelist_type = ?',
        [guildId, serverId, playerName, whitelistType]
      );

      if (existingResult.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Already Whitelisted', `**${playerName}** is already whitelisted for **${whitelistType.replace('_', ' ')}** on **${serverName}**.`)]
        });
      }

      // Add player to whitelist
      await pool.query(
        'INSERT INTO player_whitelists (guild_id, server_id, player_name, whitelist_type, added_by) VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, ?)',
        [guildId, serverId, playerName, whitelistType, adminId]
      );

      const whitelistTypeDisplay = whitelistType === 'home_teleport' ? 'Home Teleport' : 'Zorp';

      await interaction.editReply({
        embeds: [successEmbed(
          'Player Added to Whitelist',
          `**${playerName}** has been added to the **${whitelistTypeDisplay}** whitelist for **${serverName}**.\n\nAdded by: ${interaction.user.tag}`
        )]
      });

    } catch (error) {
      console.error('Error in add-player-whitelist command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', `Failed to add player to whitelist: ${error.message}`)]
      });
    }
  }
}; 