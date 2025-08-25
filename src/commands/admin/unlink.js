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
<<<<<<< HEAD
    
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
=======
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    
    // Debug: Log all available options
    console.log('[UNLINK DEBUG] All interaction options:', interaction.options.data);
    console.log('[UNLINK DEBUG] Available option names:', interaction.options.data.map(opt => opt.name));
    
    const identifier = interaction.options.getString('name');
    console.log('[UNLINK DEBUG] Raw identifier value:', identifier);
    console.log('[UNLINK DEBUG] Identifier type:', typeof identifier);
    
    // Add null check and validation
    if (!identifier) {
      console.log('[UNLINK DEBUG] Identifier is null/undefined, showing error');
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Input', 'Please provide a Discord ID or in-game name.')]
      });
    }
    
    const trimmedIdentifier = identifier.trim();

    // Validate input
    if (!trimmedIdentifier || trimmedIdentifier.length < 2) {
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Input', 'Please provide a valid Discord ID or in-game name (at least 2 characters).')]
      });
>>>>>>> 4b860dde4894f4ff5dcd0416e160bb284bafe44b
    }

    const guildId = interaction.guildId;
    const identifier = interaction.options.getString('identifier');
    
    // Determine if identifier is a Discord ID or IGN
    const isDiscordId = /^\d{17,19}$/.test(identifier);
    const normalizedDiscordId = isDiscordId ? normalizeDiscordId(identifier) : null;
    const normalizedIgn = normalizeIgnForComparison(identifier);

    try {
<<<<<<< HEAD
      // Get all servers for this guild
      const [servers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
=======
      // Check if identifier is a Discord ID (numeric)
      const isDiscordId = /^\d+$/.test(trimmedIdentifier);
      const normalizedDiscordId = isDiscordId ? normalizeDiscordId(trimmedIdentifier) : null;
      
      let result;
      let playerInfo = [];
      
      if (isDiscordId) {
        // ✅ Unlink by Discord ID - MARK AS INACTIVE (not delete) - UNIVERSAL
        const [players] = await pool.query(
          `SELECT p.*, rs.nickname, g.name as guild_name
           FROM players p
           JOIN rust_servers rs ON p.server_id = rs.id
           JOIN guilds g ON p.guild_id = g.id
           WHERE p.discord_id = ? 
           AND p.is_active = true`,
          [normalizedDiscordId]
        );
        
        if (players.length === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('No Players Found', `❌ No active players found with Discord ID **${trimmedIdentifier}** across all servers.\n\nMake sure you're using the correct Discord ID.`)]
          });
        }
        
        // Store player info before deactivation
        playerInfo = players.map(p => {
          console.log(`[UNLINK DEBUG] Player data:`, p);
          return `${p.ign || 'Unknown'} (${p.nickname || 'Unknown'} - ${p.guild_name || 'Unknown'})`;
        });
        
        // ✅ Mark all player records as inactive for this Discord ID - UNIVERSAL
        const [updateResult] = await pool.query(
          `UPDATE players 
           SET is_active = false, unlinked_at = CURRENT_TIMESTAMP
           WHERE discord_id = ? 
           AND is_active = true`,
          [normalizedDiscordId]
        );
        
        result = { rowCount: updateResult.affectedRows };
      } else {
        // ✅ NORMALIZE IGN: use utility function for proper handling
        const normalizedIgn = normalizeIgnForComparison(trimmedIdentifier);
        
        // ✅ Unlink by IGN - MARK AS INACTIVE (not delete) - case-insensitive - UNIVERSAL
        const [players] = await pool.query(
          `SELECT p.*, rs.nickname, g.name as guild_name
           FROM players p
           JOIN rust_servers rs ON p.server_id = rs.id
           JOIN guilds g ON p.guild_id = g.id
           WHERE LOWER(p.ign) = LOWER(?) 
           AND p.is_active = true`,
          [normalizedIgn]
        );
        
        if (players.length === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('No Players Found', `❌ No active players found with in-game name **${trimmedIdentifier}** across all servers.\n\nMake sure you're using the correct in-game name.`)]
          });
        }
        
        // Store player info before deactivation
        playerInfo = players.map(p => {
          console.log(`[UNLINK DEBUG] Player data:`, p);
          return `${p.ign || 'Unknown'} (${p.nickname || 'Unknown'} - ${p.guild_name || 'Unknown'})`;
        });
        
        // ✅ Mark all player records as inactive for this IGN (case-insensitive) - UNIVERSAL
        const [updateResult] = await pool.query(
          `UPDATE players 
           SET is_active = false, unlinked_at = CURRENT_TIMESTAMP
           WHERE LOWER(ign) = LOWER(?) 
           AND is_active = true`,
          [normalizedIgn]
        );
        
        result = { rowCount: updateResult.affectedRows };
      }

      // Remove ZentroLinked role from the user if they were unlinked by Discord ID
      if (isDiscordId) {
        try {
          const guild = interaction.guild;
          const zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
          
          if (zentroLinkedRole) {
            const member = await guild.members.fetch(normalizedDiscordId);
            if (member && member.roles.cache.has(zentroLinkedRole.id)) {
              await member.roles.remove(zentroLinkedRole);
              console.log(`[ROLE] Removed ZentroLinked role from user: ${member.user.username}`);
            }
          }
        } catch (roleError) {
          console.log('Could not remove ZentroLinked role:', roleError.message);
        }
      }

      // Debug logging
      console.log(`[UNLINK DEBUG] Identifier: ${trimmedIdentifier}`);
      console.log(`[UNLINK DEBUG] Is Discord ID: ${isDiscordId}`);
      console.log(`[UNLINK DEBUG] Player info array:`, playerInfo);
      console.log(`[UNLINK DEBUG] Result row count: ${result.rowCount}`);

      // Ensure we have valid player info
      if (playerInfo.length === 0) {
        playerInfo = [`Unknown player (${trimmedIdentifier})`];
      }

      // Extract just the player names for the success message
      const playerNames = playerInfo.map(info => {
        const match = info.match(/^([^(]+)/);
        const name = match ? match[1].trim() : info;
        console.log(`[UNLINK DEBUG] Extracted name: "${name}" from info: "${info}"`);
        return name;
      });

      const playerList = playerNames.join(', ');
      console.log(`[UNLINK DEBUG] Final player list: "${playerList}"`);
      const embed = successEmbed(
        'Players Unlinked', 
<<<<<<< HEAD
        `✅ Successfully unlinked **${result.rowCount} player(s)** for **${identifier}**.\n\n**Unlinked players:**\n${playerList}\n\n**Note:** Players have been marked as inactive and can now link again with new names.`
>>>>>>> c8521cc0b1cfc66d2a2a032b7e906b7684dc57cb
=======
        `✅ Successfully unlinked **${result.rowCount} player(s)** for **${trimmedIdentifier}**.\n\n**Unlinked players:**\n${playerList}\n\n**Note:** Players have been marked as inactive and can now link again with new names.`
>>>>>>> 4b860dde4894f4ff5dcd0416e160bb284bafe44b
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
