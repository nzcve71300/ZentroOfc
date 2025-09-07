const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { ensurePlayerOnAllServers, isIgnAvailable, normalizeIGN } = require('../../utils/autoServerLinking');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-link')
    .setDescription('Admin link a Discord user to an in-game player name')
    .addUserOption(option =>
      option.setName('discord')
        .setDescription('The Discord user to link')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The in-game player name')
        .setRequired(true)
        .setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    console.log(`🔗 ADMIN-LINK: Admin ${interaction.user.id} attempting to link Discord user to IGN: "${interaction.options.getString('name')}"`);
    
    try {
      await interaction.deferReply();
      
      if (!hasAdminPermissions(interaction.member)) {
        return sendAccessDeniedMessage(interaction, false);
      }

      const guildId = interaction.guildId;
      const discordUser = interaction.options.getUser('discord');
      const discordId = discordUser.id;
      const rawPlayerName = interaction.options.getString('name');
      const playerName = rawPlayerName.trim(); // Preserve original for display
      const normalizedPlayerName = normalizeIGN(rawPlayerName); // Normalize for comparison

      // Validate inputs
      if (!guildId) {
        console.error(`🚨 ADMIN-LINK: No guild ID found`);
        await interaction.editReply({
          embeds: [errorEmbed('Error', '❌ **Error:** Guild ID not found. Please try again.')]
        });
        return;
      }

      if (!playerName || playerName.length < 2 || playerName.length > 32 || !normalizedPlayerName) {
        console.error(`🚨 ADMIN-LINK: Invalid IGN detected: "${playerName}" (normalized: "${normalizedPlayerName}")`);
        await interaction.editReply({
          embeds: [errorEmbed('Invalid IGN', '❌ **Error:** Invalid in-game name. Must be 2-32 characters and contain valid characters.')]
        });
        return;
      }

      console.log(`🔗 ADMIN-LINK: Validated inputs - Discord ID: ${discordId}, IGN: "${playerName}", Guild: ${guildId}`);

      // Get all servers for this guild using the same pattern as /link command
      const [servers] = await pool.query(`
        SELECT id, nickname, guild_id 
        FROM rust_servers 
        WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
      `, [guildId]);

      if (servers.length === 0) {
        console.log(`❌ ADMIN-LINK: No servers found for guild ${guildId}`);
        await interaction.editReply({
          embeds: [errorEmbed('No Servers Found', '❌ **Error:** No Rust servers found for this Discord server.')]
        });
        return;
      }

      console.log(`🔗 ADMIN-LINK: Found ${servers.length} servers for guild ${guildId}`);

      const linkedServers = [];
      const errors = [];
      const warnings = [];

      // Ensure guild exists first
      try {
        await pool.query(
          'INSERT INTO guilds (discord_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
          [guildId, interaction.guild?.name || 'Unknown Guild']
        );
      } catch (error) {
        console.error(`❌ ADMIN-LINK: Failed to ensure guild exists:`, error);
        throw new Error(`Failed to create guild record: ${error.message}`);
      }

      // Check for existing links using the same pattern as /link command
      const [existingDiscordLinks] = await pool.query(`
        SELECT p.*, rs.nickname 
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
        AND p.discord_id = ? 
        AND p.is_active = true
      `, [guildId, discordId]);

      if (existingDiscordLinks.length > 0) {
        const currentIgn = existingDiscordLinks[0].ign;
        if (currentIgn.toLowerCase() !== playerName.toLowerCase()) {
          warnings.push(`⚠️ **${discordUser.username}** is already linked to **${currentIgn}** on: ${existingDiscordLinks.map(p => p.nickname).join(', ')}`);
        }
      }

      // ✅ CRITICAL: Use new utility function for proper tenant-scoped IGN checking
      const [guildResult] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [guildId]
      );
      
      if (guildResult.length === 0) {
        console.error(`🚨 ADMIN-LINK: No guild found for Discord ID ${guildId}`);
        await interaction.editReply({
          embeds: [errorEmbed('Guild Error', '❌ **Error:** Failed to find guild configuration. Please try again.')]
        });
        return;
      }
      
      const dbGuildId = guildResult[0].id;
      
      // Check if IGN is already linked to someone else (excluding current user)
      const ignAvailability = await isIgnAvailable(dbGuildId, playerName, discordId);
      
      if (!ignAvailability.available && !ignAvailability.error) {
        // IGN is already linked to someone else
        const serverList = ignAvailability.existingLinks.map(p => p.nickname).join(', ');
        const existingDiscordId = ignAvailability.existingLinks[0].discord_id;
        
        if (existingDiscordId && existingDiscordId !== discordId) {
          // IGN is linked to a different Discord user - show warning but allow admin override
          warnings.push(`⚠️ **${playerName}** is already linked to a different Discord account on: ${serverList}. Admin override will unlink the existing account and link to the new one.`);
        } else if (!existingDiscordId) {
          warnings.push(`⚠️ **${playerName}** already has economy records on: ${serverList} (no Discord account linked)`);
        }
        // If existingDiscordId === discordId, that's fine - we'll update the existing records
      }
      
      // Also check for any inactive records with the same normalized IGN that might cause constraint conflicts
      const [inactiveRecords] = await pool.query(
        'SELECT id, discord_id, is_active FROM players WHERE guild_id = ? AND normalized_ign = ? AND is_active = false',
        [dbGuildId, normalizedPlayerName]
      );
      
      if (inactiveRecords.length > 0) {
        console.log(`🔗 ADMIN-LINK: Found ${inactiveRecords.length} inactive records with normalized IGN "${normalizedPlayerName}", will reactivate them`);
      }

      // 🔒 ADMIN OVERRIDE: If IGN is linked to a different Discord user, unlink the existing account first
      if (!ignAvailability.available && !ignAvailability.error) {
        const existingDiscordId = ignAvailability.existingLinks[0].discord_id;
        
        if (existingDiscordId && existingDiscordId !== discordId) {
          console.log(`🔗 ADMIN-LINK: Admin override - unlinking existing Discord account ${existingDiscordId} from IGN "${playerName}"`);
          
          // Unlink the existing account by setting is_active = false
          await pool.query(
            'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlinked_by = ?, unlink_reason = ? WHERE guild_id = ? AND normalized_ign = ? AND discord_id = ? AND is_active = true',
            [interaction.user.id, 'Admin override during admin-link', dbGuildId, normalizedPlayerName, existingDiscordId]
          );
          
          console.log(`🔗 ADMIN-LINK: Successfully unlinked existing account ${existingDiscordId} from IGN "${playerName}"`);
        }
      }

             // Process each server
       console.log(`🔗 ADMIN-LINK: Processing ${servers.length} servers...`);
       
       // 🔒 CRITICAL: First, backup existing player data to preserve currency and stats
       console.log(`🔗 ADMIN-LINK: Backing up existing player data for Discord ID ${discordId}...`);
       
       const [existingPlayerData] = await pool.query(`
         SELECT p.*, e.balance, rs.nickname
         FROM players p
         LEFT JOIN economy e ON p.id = e.player_id
         JOIN rust_servers rs ON p.server_id = rs.id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND p.discord_id = ? 
         AND p.is_active = true
       `, [guildId, discordId]);
       
       console.log(`🔗 ADMIN-LINK: Found ${existingPlayerData.length} existing player records to preserve`);
       
       // Store existing data for restoration
       const existingData = {};
       for (const record of existingPlayerData) {
         if (!existingData[record.server_id]) {
           existingData[record.server_id] = {
             balance: record.balance || 0,
             kills: record.kills || 0,
             deaths: record.deaths || 0,
             playtime: record.playtime || 0,
             last_seen: record.last_seen,
             linked_at: record.linked_at
           };
         }
       }
       
       for (const server of servers) {
         try {
           console.log(`🔗 ADMIN-LINK: Processing server ${server.nickname} (ID: ${server.id})`);

           // 🔒 CRITICAL: Check if player already exists on this server using normalized IGN (including inactive)
           const [existingPlayer] = await pool.query(
             'SELECT id, discord_id, is_active FROM players WHERE guild_id = ? AND server_id = ? AND normalized_ign = ?',
             [dbGuildId, server.id, normalizedPlayerName]
           );

           if (existingPlayer.length > 0) {
             // Player with this IGN already exists - update the record
             const existing = existingPlayer[0];
             console.log(`🔗 ADMIN-LINK: Player "${playerName}" already exists on ${server.nickname} (active: ${existing.is_active}), updating...`);
             
             await pool.query(
               'UPDATE players SET discord_id = ?, normalized_ign = ?, linked_at = CURRENT_TIMESTAMP, is_active = true WHERE id = ?',
               [discordId, normalizedPlayerName, existing.id]
             );
             
             console.log(`🔗 ADMIN-LINK: Updated existing player "${playerName}" on ${server.nickname}`);
             linkedServers.push(server.nickname);
             continue;
           }

           // 🔒 CRITICAL: Check if Discord user already has a record on this server
           const [existingDiscordPlayer] = await pool.query(
             'SELECT p.id, p.ign, e.balance FROM players p LEFT JOIN economy e ON p.id = e.player_id WHERE p.guild_id = ? AND p.server_id = ? AND p.discord_id = ? AND p.is_active = true',
             [dbGuildId, server.id, discordId]
           );

           if (existingDiscordPlayer.length > 0) {
             // Discord user already has a record on this server - update IGN and preserve data
             console.log(`🔗 ADMIN-LINK: Discord user already has record on ${server.nickname}, updating IGN and preserving data...`);
             
             const existingBalance = existingDiscordPlayer[0].balance || 0;
             const existingIgn = existingDiscordPlayer[0].ign;
             
             // Update the existing record with new IGN and normalized IGN
             await pool.query(
               'UPDATE players SET ign = ?, normalized_ign = ?, linked_at = CURRENT_TIMESTAMP WHERE id = ?',
               [playerName, normalizedPlayerName, existingDiscordPlayer[0].id]
             );
             
             console.log(`🔗 ADMIN-LINK: Updated IGN from "${existingIgn}" to "${playerName}" on ${server.nickname}, preserved balance: ${existingBalance}`);
             linkedServers.push(server.nickname);
             continue;
           }

           // 🔒 CRITICAL: Check if Discord user has ANY record on this server (including inactive)
           const [anyDiscordPlayer] = await pool.query(
             'SELECT p.id, p.ign, p.is_active, e.balance FROM players p LEFT JOIN economy e ON p.id = e.player_id WHERE p.guild_id = ? AND p.server_id = ? AND p.discord_id = ?',
             [dbGuildId, server.id, discordId]
           );

           if (anyDiscordPlayer.length > 0) {
             // Discord user has an inactive record on this server - reactivate and update
             console.log(`🔗 ADMIN-LINK: Discord user has inactive record on ${server.nickname}, reactivating and updating...`);
             
             const existingBalance = anyDiscordPlayer[0].balance || 0;
             const existingIgn = anyDiscordPlayer[0].ign;
             
             // Reactivate and update the existing record
             await pool.query(
               'UPDATE players SET ign = ?, normalized_ign = ?, linked_at = CURRENT_TIMESTAMP, is_active = true, unlinked_at = NULL, unlinked_by = NULL, unlink_reason = NULL WHERE id = ?',
               [playerName, normalizedPlayerName, anyDiscordPlayer[0].id]
             );
             
             console.log(`🔗 ADMIN-LINK: Reactivated and updated IGN from "${existingIgn}" to "${playerName}" on ${server.nickname}, preserved balance: ${existingBalance}`);
             linkedServers.push(server.nickname);
             continue;
           }

           // 🔒 CRITICAL: Create new player record and restore existing data if available
           console.log(`🔗 ADMIN-LINK: Creating new player record for "${playerName}" on ${server.nickname}...`);
           
           const [playerResult] = await pool.query(
             'INSERT INTO players (guild_id, server_id, discord_id, ign, normalized_ign, linked_at, is_active) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, true)',
             [dbGuildId, server.id, discordId, playerName, normalizedPlayerName]
           );
           
           console.log(`🔗 ADMIN-LINK: Created player record with ID ${playerResult.insertId} for server ${server.nickname}`);
           
           // 🔒 CRITICAL: Create economy record with EXISTING balance if available, or starting balance if none
           const existingBalance = existingData[server.id]?.balance || 0;
           
           // If no existing balance, check for starting balance setting
           let finalBalance = existingBalance;
           if (existingBalance === 0) {
             try {
               const [startingBalanceResult] = await pool.query(
                 'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = "starting_balance"',
                 [server.id]
               );
               
               if (startingBalanceResult.length > 0) {
                 const startingBalance = parseInt(startingBalanceResult[0].setting_value) || 0;
                 if (startingBalance > 0) {
                   finalBalance = startingBalance;
                   console.log(`🔗 ADMIN-LINK: Applied starting balance ${startingBalance} for "${playerName}" on ${server.nickname}`);
                 }
               }
             } catch (error) {
               console.log(`🔗 ADMIN-LINK: Could not fetch starting balance for server ${server.id}:`, error.message);
             }
           }
           
           await pool.query(
             'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, (SELECT guild_id FROM players WHERE id = ?), ?) ON DUPLICATE KEY UPDATE balance = VALUES(balance)',
             [playerResult.insertId, playerResult.insertId, finalBalance]
           );
           
           if (existingBalance > 0) {
             console.log(`🔗 ADMIN-LINK: Restored existing balance ${existingBalance} for "${playerName}" on ${server.nickname}`);
           } else if (finalBalance > 0) {
             console.log(`🔗 ADMIN-LINK: Created economy record with starting balance ${finalBalance} for "${playerName}" on ${server.nickname}`);
           } else {
             console.log(`🔗 ADMIN-LINK: Created economy record with 0 balance for "${playerName}" on ${server.nickname}`);
           }
           
           linkedServers.push(server.nickname);
         } catch (error) {
           console.error(`❌ ADMIN-LINK: Failed to link to server ${server.nickname}:`, error);
           errors.push(`${server.nickname}: ${error.message}`);
         }
       }

      // Create ZentroLinked role if it doesn't exist and assign it to the user
      try {
        console.log(`🔗 ADMIN-LINK: Managing ZentroLinked role for user ${discordUser.username}...`);
        const guild = interaction.guild;
        let zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
        
        if (!zentroLinkedRole) {
          console.log(`🔗 ADMIN-LINK: Creating ZentroLinked role for guild: ${guild.name}`);
          zentroLinkedRole = await guild.roles.create({
            name: 'ZentroLinked',
            color: '#00ff00',
            reason: 'Auto-created role for linked players'
          });
          console.log(`🔗 ADMIN-LINK: Successfully created ZentroLinked role with ID: ${zentroLinkedRole.id}`);
        }
        
        // Assign the role to the user
        const member = await guild.members.fetch(discordId);
        if (member && !member.roles.cache.has(zentroLinkedRole.id)) {
          await member.roles.add(zentroLinkedRole);
          console.log(`🔗 ADMIN-LINK: Assigned ZentroLinked role to user: ${member.user.username}`);
        } else if (member && member.roles.cache.has(zentroLinkedRole.id)) {
          console.log(`🔗 ADMIN-LINK: User ${member.user.username} already has ZentroLinked role`);
        }
      } catch (roleError) {
        console.log(`🔗 ADMIN-LINK: Could not create/assign ZentroLinked role: ${roleError.message}`);
      }

             // Build response message
       console.log(`🔗 ADMIN-LINK: Building response message...`);
       let responseMessage = `**${discordUser.username}** has been admin-linked to **${playerName}**!\n\n`;
       
       // 🔒 CRITICAL: Show what data was preserved or starting balance applied
       const totalPreservedBalance = Object.values(existingData).reduce((sum, data) => sum + (data.balance || 0), 0);
       if (totalPreservedBalance > 0) {
         responseMessage += `**💰 Data Preserved:**\n`;
         for (const [serverId, data] of Object.entries(existingData)) {
           const serverName = servers.find(s => s.id === serverId)?.nickname || 'Unknown Server';
           if (data.balance > 0) {
             responseMessage += `• ${serverName}: ${data.balance.toLocaleString()} coins\n`;
           }
         }
         responseMessage += `\n`;
       } else {
         // Check if starting balance was applied to any servers
         let startingBalanceApplied = false;
         for (const server of servers) {
           try {
             const [startingBalanceResult] = await pool.query(
               'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = "starting_balance"',
               [server.id]
             );
             
             if (startingBalanceResult.length > 0) {
               const startingBalance = parseInt(startingBalanceResult[0].setting_value) || 0;
               if (startingBalance > 0) {
                 if (!startingBalanceApplied) {
                   responseMessage += `**💰 Starting Balance Applied:**\n`;
                   startingBalanceApplied = true;
                 }
                 responseMessage += `• ${server.nickname}: ${startingBalance.toLocaleString()} coins\n`;
               }
             }
           } catch (error) {
             // Ignore errors, just continue
           }
         }
         if (startingBalanceApplied) {
           responseMessage += `\n`;
         }
       }
       
       if (warnings.length > 0) {
         responseMessage += `**Warnings:**\n${warnings.join('\n')}\n\n`;
       }
       
       if (linkedServers.length > 0) {
         responseMessage += `**✅ Successfully linked to:** ${linkedServers.join(', ')}`;
       }
       
       if (errors.length > 0) {
         responseMessage += `\n\n**❌ Errors:**\n${errors.join('\n')}`;
       }

      const embed = successEmbed('Admin Link Complete', responseMessage);
      await interaction.editReply({ embeds: [embed] });
      
      console.log(`🔗 ADMIN-LINK: Successfully admin-linked ${discordUser.username} to ${playerName} on ${linkedServers.length} servers`);
      
      // 🔗 AUTO-SERVER-LINKING: Ensure player exists on ALL servers in this guild
      try {
        console.log(`🔗 AUTO-SERVER-LINKING: Starting cross-server player creation for ${playerName}`);
        
        // Get the database guild ID
        const [guildResult] = await pool.query(
          'SELECT id FROM guilds WHERE discord_id = ?',
          [guildId]
        );
        
        if (guildResult.length > 0) {
          const dbGuildId = guildResult[0].id;
          
          // Ensure player exists on all servers
          const autoLinkResult = await ensurePlayerOnAllServers(dbGuildId, discordId, playerName);
          
          if (autoLinkResult.success) {
            console.log(`🔗 AUTO-SERVER-LINKING: Successfully ensured ${playerName} exists on ${autoLinkResult.totalServers} servers (${autoLinkResult.createdCount} created, ${autoLinkResult.existingCount} existing)`);
          } else {
            console.log(`⚠️ AUTO-SERVER-LINKING: Failed to ensure ${playerName} on all servers: ${autoLinkResult.error}`);
          }
        }
      } catch (autoLinkError) {
        console.log(`⚠️ AUTO-SERVER-LINKING: Error during cross-server linking: ${autoLinkError.message}`);
      }

    } catch (error) {
      console.error('❌ ADMIN-LINK: Error in admin-link:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', '❌ **Error:** Failed to admin link player. Please try again.')]
      });
    }
  }
};
