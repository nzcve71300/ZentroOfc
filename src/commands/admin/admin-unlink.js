const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');
const { normalizeIGN } = require('../../utils/autoServerLinking');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-unlink')
    .setDescription('Unlink a Discord account from an in-game name (Admin only)')
    .addUserOption(option =>
      option.setName('target_user')
        .setDescription('Discord user to unlink (optional)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('In-game name to unlink (optional)')
        .setRequired(false)
        .setMaxLength(32))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for unlinking (optional)')
        .setRequired(false)
        .setMaxLength(200)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const discordGuildId = interaction.guildId;
    const executorId = interaction.user.id;

    try {
      // Get database guild ID
      const [guildResult] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [discordGuildId]
      );

      if (guildResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Guild Error', 'Failed to find guild configuration. Please contact an admin.')]
        });
      }

      const dbGuildId = guildResult[0].id;

      // Parse inputs
      const targetUser = interaction.options.getUser('target_user');
      const rawIgn = interaction.options.getString('ign');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const targetDiscordId = targetUser ? targetUser.id : null;
      const normalizedIgn = rawIgn ? normalizeIGN(rawIgn.trim()) : null;

      // Validate that at least one identifier is provided
      if (!targetDiscordId && !normalizedIgn) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Input', 'You must provide either a target user or an in-game name to unlink.')]
        });
      }

      // Resolve link scope candidates (active only, this guild only)
      let query, params, queryType;

      if (targetDiscordId && normalizedIgn) {
        // Both provided - check if they match, if not, just use Discord ID
        const [checkMatch] = await pool.query(`
          SELECT p.id, p.discord_id, p.ign, p.normalized_ign, rs.nickname
          FROM players p
          JOIN rust_servers rs ON rs.id = p.server_id
          WHERE p.guild_id = ?
            AND p.is_active = TRUE
            AND p.discord_id = ?
            AND p.normalized_ign = ?
        `, [dbGuildId, targetDiscordId, normalizedIgn]);
        
        if (checkMatch.length > 0) {
          // Perfect match found
          query = `
            SELECT p.id, p.discord_id, p.ign, p.normalized_ign, rs.nickname
            FROM players p
            JOIN rust_servers rs ON rs.id = p.server_id
            WHERE p.guild_id = ?
              AND p.is_active = TRUE
              AND p.discord_id = ?
              AND p.normalized_ign = ?
          `;
          params = [dbGuildId, targetDiscordId, normalizedIgn];
          queryType = 'both';
        } else {
          // No exact match, just use Discord ID
          query = `
            SELECT p.id, p.discord_id, p.ign, p.normalized_ign, rs.nickname
            FROM players p
            JOIN rust_servers rs ON rs.id = p.server_id
            WHERE p.guild_id = ?
              AND p.is_active = TRUE
              AND p.discord_id = ?
          `;
          params = [dbGuildId, targetDiscordId];
          queryType = 'discord';
        }
      } else if (targetDiscordId) {
        // Discord ID only
        query = `
          SELECT p.id, p.discord_id, p.ign, p.normalized_ign, rs.nickname
          FROM players p
          JOIN rust_servers rs ON rs.id = p.server_id
          WHERE p.guild_id = ?
            AND p.is_active = TRUE
            AND p.discord_id = ?
        `;
        params = [dbGuildId, targetDiscordId];
        queryType = 'discord';
      } else {
        // IGN only
        query = `
          SELECT p.id, p.discord_id, p.ign, p.normalized_ign, rs.nickname
          FROM players p
          JOIN rust_servers rs ON rs.id = p.server_id
          WHERE p.guild_id = ?
            AND p.is_active = TRUE
            AND p.normalized_ign = ?
        `;
        params = [dbGuildId, normalizedIgn];
        queryType = 'ign';
      }

      const [players] = await pool.query(query, params);

      if (players.length === 0) {
        let errorMessage;
        if (queryType === 'both') {
          errorMessage = 'No active link found matching that user + IGN in this guild.';
        } else if (queryType === 'discord') {
          errorMessage = 'User has no active link in this guild.';
        } else {
          errorMessage = 'IGN not linked in this guild.';
        }

        return interaction.editReply({
          embeds: [errorEmbed('No Link Found', errorMessage)]
        });
      }

      // Collect distinct discord_id and server list
      const distinctDiscordIds = [...new Set(players.map(p => p.discord_id))];
      const displayIgn = players[0].ign;
      const serverList = players.map(p => p.nickname);

      if (distinctDiscordIds.length > 1) {
        return interaction.editReply({
          embeds: [errorEmbed('Multiple Users', 'This IGN is linked to multiple users. Please specify the target user.')]
        });
      }

      const targetDiscordIdFinal = distinctDiscordIds[0];

      // Create confirmation token
      const tokenData = {
        g: dbGuildId,
        u: targetDiscordIdFinal,
        n: normalizedIgn,
        r: reason,
        x: executorId
      };

      const token = Buffer.from(JSON.stringify(tokenData)).toString('base64url');

      // Show confirmation embed
      const confirmEmbed = orangeEmbed(
        'Confirm Admin Unlink',
        `This will unlink **${displayIgn}** from <@${targetDiscordIdFinal}> across **${serverList.length} server(s)** in this guild.\n\n` +
        `**Servers:**\n${serverList.map(s => `• ${s}`).join('\n')}\n\n` +
        `**Reason:** ${reason}\n\n` +
        `**⚠️ Warning:** This action is irreversible without re-linking.`
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`admin_unlink_confirm:${token}`)
          .setLabel('Confirm Unlink')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('admin_unlink_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row]
      });

    } catch (error) {
      console.error('Error in admin-unlink command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('System Error', 'Failed to process unlink request. Please try again.')]
      });
    }
  }
};
