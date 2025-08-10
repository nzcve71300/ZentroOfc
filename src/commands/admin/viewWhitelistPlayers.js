const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-whitelist-players')
    .setDescription('View whitelisted players for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number (default: 1)')
        .setRequired(false)
        .setMinValue(1)),

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
      console.error('Error in view-whitelist-players autocomplete:', error);
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
    const page = interaction.options.getInteger('page') || 1;
    const guildId = interaction.guildId;
    const itemsPerPage = 10;
    const offset = (page - 1) * itemsPerPage;

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

      // Get total count of whitelisted players
      const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM player_whitelists WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ?',
        [guildId, serverId]
      );

      const totalPlayers = countResult[0].total;
      const totalPages = Math.ceil(totalPlayers / itemsPerPage);

      if (page > totalPages && totalPages > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Page', `Page ${page} does not exist. Total pages: ${totalPages}`)]
        });
      }

      // Get whitelisted players for the current page
      const [playersResult] = await pool.query(
        `SELECT player_name, whitelist_type, added_at, added_by 
         FROM player_whitelists 
         WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? 
         ORDER BY added_at DESC 
         LIMIT ? OFFSET ?`,
        [guildId, serverId, itemsPerPage, offset]
      );

      if (playersResult.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'No Whitelisted Players',
            `No players are currently whitelisted for **${serverName}**.\n\nUse \`/add-player-whitelist\` to add players to the whitelist.`
          )]
        });
      }

      // Group players by whitelist type
      const homeTeleportPlayers = playersResult.filter(p => p.whitelist_type === 'home_teleport');
      const zorpPlayers = playersResult.filter(p => p.whitelist_type === 'zorp');

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00) // Orange color
        .setTitle(`🏠 Whitelisted Players - ${serverName}`)
        .setDescription(`Page ${page} of ${totalPages} • Total players: ${totalPlayers}`)
        .setTimestamp();

      // Add Home Teleport section
      if (homeTeleportPlayers.length > 0) {
        const homeTeleportList = homeTeleportPlayers.map(player => {
          const date = new Date(player.added_at).toLocaleDateString();
          return `• **${player.player_name}** (Added: ${date})`;
        }).join('\n');
        
        embed.addFields({
          name: '🏠 Home Teleport Whitelist',
          value: homeTeleportList,
          inline: false
        });
      }

      // Add Zorp section
      if (zorpPlayers.length > 0) {
        const zorpList = zorpPlayers.map(player => {
          const date = new Date(player.added_at).toLocaleDateString();
          return `• **${player.player_name}** (Added: ${date})`;
        }).join('\n');
        
        embed.addFields({
          name: '🛡️ Zorp Whitelist',
          value: zorpList,
          inline: false
        });
      }

      // Add footer with navigation info
      if (totalPages > 1) {
        embed.setFooter({
          text: `Use /view-whitelist-players ${serverName} <page> to navigate • Page ${page}/${totalPages}`
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in view-whitelist-players command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', `Failed to view whitelisted players: ${error.message}`)]
      });
    }
  }
}; 