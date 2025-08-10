const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force-link')
    .setDescription('Forcefully link a Discord user to an in-game player name (Admin only)')
    .addUserOption(option =>
      option.setName('discord_user')
        .setDescription('The Discord user to link (mention or select)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('The in-game player name')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply();
    
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const guildId = interaction.guildId;
    const discordUser = interaction.options.getUser('discord_user');
    const playerName = interaction.options.getString('ign');

    try {
      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
      );

      if (servers.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Servers Found', 'No Rust servers found for this Discord. Contact an admin.')]
        });
      }

      const linkedServers = [];
      const errors = [];

      // Link the player to all servers
      for (const server of servers) {
        try {
          // Check if this exact link already exists (active)
          const [existingExactLink] = await pool.query(
            'SELECT id, is_active FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ? AND LOWER(ign) = LOWER(?)',
            [guildId, server.id, discordUser.id, playerName]
          );

          if (existingExactLink.length > 0) {
            const existing = existingExactLink[0];
            if (existing.is_active) {
              // Already linked - skip
              linkedServers.push(`${server.nickname} (already linked)`);
              continue;
            } else {
              // Reactivate inactive player
              await pool.query(
                'UPDATE players SET linked_at = CURRENT_TIMESTAMP, is_active = true, unlinked_at = NULL WHERE id = ?',
                [existing.id]
              );
              
              // Ensure economy record exists (preserve existing balance)
              await pool.query(
                'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT id FROM guilds WHERE discord_id = ?), 0) ON DUPLICATE KEY UPDATE balance = balance',
                [existing.id, guildId]
              );
              
              linkedServers.push(server.nickname);
              continue;
            }
          }

          // Check if there's an inactive record with the same IGN but no discord_id (from unlink)
          const [inactiveRecord] = await pool.query(
            'SELECT id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND LOWER(ign) = LOWER(?) AND discord_id IS NULL AND is_active = false',
            [guildId, server.id, playerName]
          );

          if (inactiveRecord.length > 0) {
            // Reactivate the inactive record and set the discord_id
            await pool.query(
              'UPDATE players SET discord_id = ?, linked_at = CURRENT_TIMESTAMP, is_active = true, unlinked_at = NULL WHERE id = ?',
              [discordUser.id, inactiveRecord[0].id]
            );
            
            // Ensure economy record exists (preserve existing balance)
            await pool.query(
              'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT id FROM guilds WHERE discord_id = ?), 0) ON DUPLICATE KEY UPDATE balance = balance',
              [inactiveRecord[0].id, guildId]
            );
            
            linkedServers.push(server.nickname);
            continue;
          }

          // Check if IGN is already linked to a different Discord ID
          const [existingIgnLink] = await pool.query(
            'SELECT id, discord_id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND LOWER(ign) = LOWER(?) AND is_active = true',
            [guildId, server.id, playerName]
          );

          if (existingIgnLink.length > 0) {
            const existing = existingIgnLink[0];
            if (existing.discord_id != discordUser.id) {
              // Force unlink the existing Discord ID and link the new one
              await pool.query(
                'UPDATE players SET discord_id = ?, linked_at = CURRENT_TIMESTAMP, is_active = true, unlinked_at = NULL WHERE id = ?',
                [discordUser.id, existing.id]
              );
              linkedServers.push(`${server.nickname} (replaced existing link)`);
              continue;
            }
          }

          // Check if Discord ID is already linked to a different IGN
          const [existingDiscordLink] = await pool.query(
            'SELECT id, ign FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ? AND is_active = true',
            [guildId, server.id, discordUser.id]
          );

          if (existingDiscordLink.length > 0) {
            const existing = existingDiscordLink[0];
            if (existing.ign.toLowerCase() !== playerName.toLowerCase()) {
              // Force unlink the existing IGN and link the new one
              await pool.query(
                'UPDATE players SET ign = ?, linked_at = CURRENT_TIMESTAMP, is_active = true, unlinked_at = NULL WHERE id = ?',
                [playerName, existing.id]
              );
              linkedServers.push(`${server.nickname} (replaced existing link)`);
              continue;
            }
          }

          // Insert new player
          const [playerResult] = await pool.query(
            'INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, CURRENT_TIMESTAMP, true)',
            [guildId, server.id, discordUser.id, playerName]
          );
          
          // Create economy record with guild_id
          await pool.query(
            'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT id FROM guilds WHERE discord_id = ?), 0)',
            [playerResult.insertId, guildId]
          );
          
          linkedServers.push(server.nickname);
        } catch (error) {
          console.error(`Failed to force-link to server ${server.nickname}:`, error);
          errors.push(`${server.nickname}: ${error.message}`);
        }
      }

      if (linkedServers.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Force Link Failed', 'Failed to link account to any servers. Please try again.')]
        });
      }

      const serverList = linkedServers.join(', ');
      const embed = successEmbed(
        'Account Force Linked',
        `Successfully force-linked **${discordUser}** to **${playerName}**!\n\n**Linked to servers:** ${serverList}`
      );

      if (errors.length > 0) {
        embed.addFields({ 
          name: '⚠️ Errors', 
          value: errors.join('\n'),
          inline: false 
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in force-link:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to force-link player. Please try again.')]
      });
    }
  }
}; 