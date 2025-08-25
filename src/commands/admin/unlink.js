const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');
const { normalizeDiscordId, compareDiscordIds, normalizeIgnForComparison } = require('../../utils/linking');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a Discord user from their in-game player name (Admin only)')
    .addStringOption(option =>
      option.setName('identifier')
        .setDescription('Discord ID or in-game player name')
        .setRequired(true)
        .setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply();
    
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const guildId = interaction.guildId;
    const identifier = interaction.options.getString('identifier');
    
    // Determine if identifier is a Discord ID or IGN
    const isDiscordId = /^\d{17,19}$/.test(identifier);
    const normalizedDiscordId = isDiscordId ? normalizeDiscordId(identifier) : null;
    const normalizedIgn = normalizeIgnForComparison(identifier);

    try {
      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
      );

      if (servers.length === 0) {
        return await interaction.editReply({
          embeds: [errorEmbed('No Servers Found', 'No Rust servers found for this Discord. Contact an admin.')]
        });
      }

      const unlinkedServers = [];
      const errors = [];
      const notFoundServers = [];

      // Process each server
      for (const server of servers) {
        try {
          let query, params;

          if (isDiscordId) {
            // Search by Discord ID
            query = 'SELECT id, ign, discord_id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ? AND is_active = true';
            params = [guildId, server.id, normalizedDiscordId];
          } else {
            // Search by IGN
            query = 'SELECT id, ign, discord_id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND LOWER(ign) = LOWER(?) AND is_active = true';
            params = [guildId, server.id, normalizedIgn];
          }

          const [players] = await pool.query(query, params);

          if (players.length === 0) {
            notFoundServers.push(server.nickname);
            continue;
          }

          // Unlink all matching players
          for (const player of players) {
            await pool.query(
              'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP WHERE id = ?',
              [player.id]
            );
            
            console.log(`Unlinked player: ${player.ign} (Discord ID: ${player.discord_id}) on ${server.nickname}`);
          }
          
          unlinkedServers.push(server.nickname);
        } catch (error) {
          console.error(`Failed to unlink from server ${server.nickname}:`, error);
          errors.push(`${server.nickname}: ${error.message}`);
        }
      }

      // Build response message
      let responseMessage = '';
      
      if (isDiscordId) {
        responseMessage = `**Discord ID ${identifier}** has been unlinked!\n\n`;
      } else {
        responseMessage = `**${identifier}** has been unlinked!\n\n`;
      }
      
      if (unlinkedServers.length > 0) {
        responseMessage += `**✅ Successfully unlinked from:** ${unlinkedServers.join(', ')}`;
      }
      
      if (notFoundServers.length > 0) {
        responseMessage += `\n\n**⚠️ Not found on:** ${notFoundServers.join(', ')}`;
      }
      
      if (errors.length > 0) {
        responseMessage += `\n\n**❌ Errors:**\n${errors.join('\n')}`;
      }

      if (unlinkedServers.length === 0 && notFoundServers.length === 0) {
        responseMessage = `**No active links found** for ${isDiscordId ? `Discord ID ${identifier}` : identifier}`;
      }

      const embed = successEmbed('Unlink Complete', responseMessage);
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in unlink:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to unlink player. Please try again.')]
      });
    }
  }
};
