const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');
const { getServerByNickname, getServersForGuild } = require('../../utils/unifiedPlayerSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player from Discord')
    .addStringOption(option =>
      option.setName('identifier')
        .setDescription('Player name or Discord ID')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    
    try {
      const servers = await getServersForGuild(guildId);
      const filtered = servers.filter(s => s.nickname.toLowerCase().includes(focusedValue.toLowerCase()));
      await interaction.respond(filtered.map(s => ({ name: s.nickname, value: s.nickname })));
    } catch (err) {
      console.error('Autocomplete error:', err);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
<<<<<<< HEAD
    try {
      const searchTerm = interaction.options.getString('identifier');
      const serverOption = interaction.options.getString('server');
      const guildId = interaction.guildId;
=======
    console.log(`🔗 UNLINK COMMAND: Admin ${interaction.user.id} attempting to unlink player...`);
    
    try {
      await interaction.deferReply();
      
      // Check admin permissions
      if (!hasAdminPermissions(interaction.member)) {
        return sendAccessDeniedMessage(interaction, false);
      }

      const guildId = interaction.guildId;
      
      // CRITICAL VALIDATION 1: Validate guild ID
      if (!guildId) {
        console.error(`🚨 UNLINK COMMAND: No guild ID found for admin ${interaction.user.id}`);
        await interaction.editReply({
          embeds: [errorEmbed('Guild Error', '❌ **Error:** Guild ID not found. Please try again.')]
        });
        return;
      }

      // Get the input - check both string and user options
      const input = interaction.options.getString('name');
      const mentionedUser = interaction.options.getUser('user');
      
      let searchTerm = '';
      
      // If user is mentioned, use their ID
      if (mentionedUser) {
        searchTerm = mentionedUser.id;
        console.log(`🔗 UNLINK COMMAND: Using mentioned user ID: ${searchTerm}`);
      } else if (input) {
        // Remove mention format if present (<@123456789>)
        searchTerm = input.replace(/<@!?(\d+)>/g, '$1').trim();
        console.log(`🔗 UNLINK COMMAND: Using input string: "${input}" -> "${searchTerm}"`);
      }
      
      // Basic validation
      if (!searchTerm || searchTerm.length < 2) {
        console.error(`🚨 UNLINK COMMAND: Invalid search term: "${searchTerm}"`);
        await interaction.editReply({
          embeds: [errorEmbed('Invalid Input', '❌ **Error:** Please provide a valid Discord ID, in-game name, or mention a user.')]
        });
        return;
      }

            console.log(`🔗 UNLINK COMMAND: Validated inputs - Search term: "${searchTerm}", Guild: ${guildId}`);

      // Check if it's a Discord ID (all numbers)
      const isDiscordId = /^\d+$/.test(searchTerm);
      console.log(`🔗 UNLINK COMMAND: Search term "${searchTerm}" is Discord ID: ${isDiscordId}`);
>>>>>>> 6b8eed9305c5c0e90429e6a840b2a5592ccd0dc4
      
      console.log(`[UNLINK] Attempting to unlink: ${searchTerm} from server: ${serverOption} in guild: ${guildId}`);

<<<<<<< HEAD
      // Get server using shared helper
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.reply({
          content: `❌ Server not found: ${serverOption}`,
          ephemeral: true
=======
      if (isDiscordId) {
        // Search by Discord ID - only current guild
        console.log(`🔍 UNLINK COMMAND: Searching for Discord ID ${searchTerm} in guild ${guildId}...`);
        [players] = await pool.query(`
          SELECT p.*, rs.nickname, g.name as guild_name
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          JOIN guilds g ON p.guild_id = g.id
          WHERE p.discord_id = ? AND p.is_active = true AND g.discord_id = ?
        `, [searchTerm, guildId]);
        
        updateQuery = 'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP WHERE discord_id = ? AND is_active = true AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)';
        queryParams = [searchTerm, guildId];
      } else {
        // Search by in-game name - only current guild
        console.log(`🔍 UNLINK COMMAND: Searching for IGN "${searchTerm}" in guild ${guildId}...`);
        [players] = await pool.query(`
          SELECT p.*, rs.nickname, g.name as guild_name
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          JOIN guilds g ON p.guild_id = g.id
          WHERE LOWER(p.ign) = LOWER(?) AND p.is_active = true AND g.discord_id = ?
        `, [searchTerm, guildId]);
        
        updateQuery = 'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP WHERE LOWER(ign) = LOWER(?) AND is_active = true AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)';
        queryParams = [searchTerm, guildId];
      }

      // Check if any players found
      console.log(`🔍 UNLINK COMMAND: Found ${players.length} active players to unlink`);
      if (players.length === 0) {
        const searchType = isDiscordId ? 'Discord ID' : 'in-game name';
        console.log(`❌ UNLINK COMMAND: No active players found with ${searchType} "${searchTerm}"`);
        await interaction.editReply({
          embeds: [errorEmbed('No Players Found', `❌ **Error:** No active players found with ${searchType} **${searchTerm}** on this server.`)]
>>>>>>> 6b8eed9305c5c0e90429e6a840b2a5592ccd0dc4
        });
        return;
      }

<<<<<<< HEAD
      // Get database connection
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });
=======
      // Update the players (mark as inactive)
      console.log(`🔗 UNLINK COMMAND: Executing update query to unlink ${players.length} players...`);
      const [updateResult] = await pool.query(updateQuery, queryParams);
      console.log(`🔗 UNLINK COMMAND: Successfully unlinked ${updateResult.affectedRows} players`);
>>>>>>> 6b8eed9305c5c0e90429e6a840b2a5592ccd0dc4

      let player = null;
      let searchMethod = '';

      // First, try to search by Discord ID
      try {
        const [rows] = await connection.execute(`
          SELECT p.*, rs.nickname as server_name
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          WHERE p.discord_id = ? AND p.server_id = ? AND p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        `, [searchTerm, server.id, guildId]);

        if (rows.length > 0) {
          player = rows[0];
          searchMethod = 'Discord ID';
          console.log(`[UNLINK] Found player by Discord ID: ${player.ign} on ${player.server_name}`);
        }
      } catch (error) {
        console.error('[UNLINK] Error searching by Discord ID:', error);
      }

      // If not found by Discord ID, try searching by IGN
      if (!player) {
        try {
<<<<<<< HEAD
          const [rows] = await connection.execute(`
            SELECT p.*, rs.nickname as server_name
            FROM players p
            JOIN rust_servers rs ON p.server_id = rs.id
            WHERE p.ign = ? AND p.server_id = ? AND p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
          `, [searchTerm, server.id, guildId]);

          if (rows.length > 0) {
            player = rows[0];
            searchMethod = 'IGN';
            console.log(`[UNLINK] Found player by IGN: ${player.ign} on ${player.server_name}`);
          }
        } catch (error) {
          console.error('[UNLINK] Error searching by IGN:', error);
        }
      }

      if (!player) {
        await interaction.reply({
          content: `❌ Player not found: ${searchTerm}\n⚠️ Not found on: ${server.nickname}`,
          ephemeral: true
        });
        await connection.end();
        return;
      }

      // Check if player is already unlinked
      if (!player.discord_id) {
        await interaction.reply({
          content: `⚠️ Player ${player.ign || 'Unknown'} is already unlinked on ${server.nickname}!`,
          ephemeral: true
        });
        await connection.end();
        return;
      }

      // Update the player record
      try {
        await connection.execute(`
          UPDATE players 
          SET discord_id = NULL, unlinked_at = NOW(), is_active = false
          WHERE id = ? AND server_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
        `, [player.id, server.id, guildId]);

        console.log(`[UNLINK] Successfully unlinked player: ${player.ign} (ID: ${player.id}) from ${server.nickname}`);

        // Create success message
        const playerName = player.ign || 'Unknown';
        const discordId = player.discord_id || 'Unknown';
        
        const successMessage = `✅ Unlink Complete\n\n**${playerName}** has been unlinked from **${server.nickname}**!\n\n**Details:**\n• **Player:** ${playerName}\n• **Discord ID:** ${discordId}\n• **Server:** ${server.nickname}\n• **Found by:** ${searchMethod}`;

        await interaction.reply({
          content: successMessage,
          ephemeral: true
        });

      } catch (error) {
        console.error('[UNLINK] Error updating player:', error);
        await interaction.reply({
          content: `❌ Error unlinking player: ${error.message}`,
          ephemeral: true
        });
      }

      await connection.end();

    } catch (error) {
      console.error('[UNLINK] Unexpected error:', error);
      await interaction.reply({
        content: `❌ Unexpected error: ${error.message}`,
        ephemeral: true
=======
          console.log(`🔗 UNLINK COMMAND: Attempting to remove ZentroLinked role from Discord user ${searchTerm}...`);
          const guild = interaction.guild;
          const zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
          
          if (zentroLinkedRole) {
            const member = await guild.members.fetch(searchTerm);
            if (member && member.roles.cache.has(zentroLinkedRole.id)) {
              await member.roles.remove(zentroLinkedRole);
              console.log(`🔗 UNLINK COMMAND: Successfully removed ZentroLinked role from user ${member.user.username}`);
            } else if (member) {
              console.log(`🔗 UNLINK COMMAND: User ${member.user.username} does not have ZentroLinked role`);
            } else {
              console.log(`🔗 UNLINK COMMAND: Could not fetch member with Discord ID ${searchTerm}`);
            }
          } else {
            console.log(`🔗 UNLINK COMMAND: ZentroLinked role not found in guild`);
          }
        } catch (error) {
          console.log(`🔗 UNLINK COMMAND: Could not remove ZentroLinked role: ${error.message}`);
        }
      }

      // Create success message
      console.log(`🔗 UNLINK COMMAND: Building success message...`);
      const playerList = players.map(p => `${p.ign} (${p.nickname})`).join(', ');
      
      const embed = successEmbed(
        'Players Unlinked', 
        `✅ Successfully unlinked **${updateResult.affectedRows} player(s)** for **${searchTerm}** on this server.\n\n**Unlinked players:**\n${playerList}\n\n**Note:** Players have been marked as inactive and can now link again with new names.`
      );

      await interaction.editReply({ embeds: [embed] });
      
      console.log(`🔗 UNLINK COMMAND: Successfully unlinked ${updateResult.affectedRows} players for "${searchTerm}"`);

    } catch (error) {
      console.error('❌ UNLINK COMMAND: Error in unlink command:', error);
      await interaction.editReply({ 
        embeds: [errorEmbed('Error', '❌ **Error:** Failed to unlink player. Please try again.')] 
>>>>>>> 6b8eed9305c5c0e90429e6a840b2a5592ccd0dc4
      });
    }
  }
};
