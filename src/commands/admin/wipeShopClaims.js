const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wipe-shop-claims')
    .setDescription('Wipe all pending kit claims for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guildId;

    try {
      if (focusedOption.name === 'server') {
        // Server autocomplete
        const [result] = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
          [guildId, `%${focusedOption.value}%`]
        );

        const choices = result.map(row => ({
          name: row.nickname,
          value: row.nickname
        }));

        await interaction.respond(choices);
      } else {
        // For any other field, return empty array
        await interaction.respond([]);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Get server details
      const [serverResult] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, serverNickname]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', `Server "${serverNickname}" was not found.`)]
        });
      }

      const serverId = serverResult[0].id;

      // Get count of pending claims before deletion
      const [countResult] = await pool.query(
        'SELECT COUNT(*) as count FROM kit_delivery_queue WHERE server_id = ? AND remaining_quantity > 0',
        [serverId]
      );

      const pendingClaims = countResult[0].count;

      if (pendingClaims === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            '📦 No Pending Claims',
            `There are no pending kit claims to wipe for **${serverNickname}**.`
          )]
        });
      }

      // Get details of pending claims for logging
      const [pendingDetails] = await pool.query(
        `SELECT kdq.*, p.ign, rs.nickname as server_name
         FROM kit_delivery_queue kdq
         JOIN players p ON kdq.player_id = p.id
         JOIN rust_servers rs ON kdq.server_id = rs.id
         WHERE kdq.server_id = ? AND kdq.remaining_quantity > 0
         ORDER BY kdq.created_at DESC`,
        [serverId]
      );

      // Delete all pending claims for this server
      const [deleteResult] = await pool.query(
        'DELETE FROM kit_delivery_queue WHERE server_id = ? AND remaining_quantity > 0',
        [serverId]
      );

      const deletedClaims = deleteResult.affectedRows;

      // Create detailed embed showing what was wiped
      let detailsText = '';
      if (pendingDetails.length > 0) {
        detailsText = '\n\n**Wiped Claims:**\n';
        pendingDetails.slice(0, 10).forEach((claim, index) => {
          detailsText += `${index + 1}. **${claim.ign}** - ${claim.display_name} (${claim.remaining_quantity}/${claim.original_quantity} remaining)\n`;
        });
        
        if (pendingDetails.length > 10) {
          detailsText += `... and ${pendingDetails.length - 10} more claims`;
        }
      }

      // Create success embed
      const embed = successEmbed(
        '🗑️ Shop Claims Wiped Successfully',
        `**Server:** ${serverNickname}\n**Claims Wiped:** ${deletedClaims}\n**Pending Claims Found:** ${pendingClaims}${detailsText}\n\nAll pending kit claims have been removed. Players will need to purchase kits again if they want them.`
      );

      await interaction.editReply({
        embeds: [embed]
      });

      // Log the action
      console.log(`[WIPE SHOP CLAIMS] Admin ${interaction.user.username} (${interaction.user.id}) wiped ${deletedClaims} pending kit claims for server ${serverNickname} (${serverId})`);

    } catch (error) {
      console.error('Error wiping shop claims:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', `Failed to wipe shop claims for ${serverNickname}. Error: ${error.message}`)]
      });
    }
  },
};
