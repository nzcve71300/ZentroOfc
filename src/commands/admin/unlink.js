const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player from all servers (Admin only)')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Discord ID, in-game name, or mention the player to unlink')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Mention the user to unlink')
        .setRequired(false)),

  async execute(interaction) {
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
      
      let players = [];
      let updateQuery = '';
      let queryParams = [];

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
        });
        return;
      }

      // Update the players (mark as inactive)
      console.log(`🔗 UNLINK COMMAND: Executing update query to unlink ${players.length} players...`);
      const [updateResult] = await pool.query(updateQuery, queryParams);
      console.log(`🔗 UNLINK COMMAND: Successfully unlinked ${updateResult.affectedRows} players`);

      // Remove ZentroLinked role if it's a Discord ID
      if (isDiscordId) {
        try {
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
      });
    }
  }
};