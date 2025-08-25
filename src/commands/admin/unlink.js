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
    await interaction.deferReply();
    
    // Check admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    // Get the input - check both string and user options
    const input = interaction.options.getString('name');
    const mentionedUser = interaction.options.getUser('user');
    
    let searchTerm = '';
    
    // If user is mentioned, use their ID
    if (mentionedUser) {
      searchTerm = mentionedUser.id;
    } else if (input) {
      // Remove mention format if present (<@123456789>)
      searchTerm = input.replace(/<@!?(d+)>/g, '$1').trim();
    }
    
    // Basic validation
    if (!searchTerm || searchTerm.length < 2) {
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Input', 'Please provide a valid Discord ID, in-game name, or mention a user.')]
      });
    }

    try {
      // Check if it's a Discord ID (all numbers)
      const isDiscordId = /^d+$/.test(searchTerm);
      
      let players = [];
      let updateQuery = '';
      let queryParams = [];

      if (isDiscordId) {
        // Search by Discord ID - only current guild
        [players] = await pool.query(`
          SELECT p.*, rs.nickname, g.name as guild_name
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          JOIN guilds g ON p.guild_id = g.id
          WHERE p.discord_id = ? AND p.is_active = true AND g.discord_id = ?
        `, [searchTerm, interaction.guildId]);
        
        updateQuery = 'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP WHERE discord_id = ? AND is_active = true AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)';
        queryParams = [searchTerm, interaction.guildId];
      } else {
        // Search by in-game name - only current guild
        [players] = await pool.query(`
          SELECT p.*, rs.nickname, g.name as guild_name
          FROM players p
          JOIN rust_servers rs ON p.server_id = rs.id
          JOIN guilds g ON p.guild_id = g.id
          WHERE LOWER(p.ign) = LOWER(?) AND p.is_active = true AND g.discord_id = ?
        `, [searchTerm, interaction.guildId]);
        
        updateQuery = 'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP WHERE LOWER(ign) = LOWER(?) AND is_active = true AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)';
        queryParams = [searchTerm, interaction.guildId];
      }

      // Check if any players found
      if (players.length === 0) {
        const searchType = isDiscordId ? 'Discord ID' : 'in-game name';
        return await interaction.editReply({
          embeds: [errorEmbed('No Players Found', `❌ No active players found with ${searchType} **${searchTerm}** on this server.`)]
        });
      }

      // Update the players (mark as inactive)
      const [updateResult] = await pool.query(updateQuery, queryParams);

      // Remove ZentroLinked role if it's a Discord ID
      if (isDiscordId) {
        try {
          const guild = interaction.guild;
          const zentroLinkedRole = guild.roles.cache.find(role => role.name === 'ZentroLinked');
          
          if (zentroLinkedRole) {
            const member = await guild.members.fetch(searchTerm);
            if (member && member.roles.cache.has(zentroLinkedRole.id)) {
              await member.roles.remove(zentroLinkedRole);
            }
          }
        } catch (error) {
          // Ignore role removal errors
        }
      }

      // Create success message
      const playerList = players.map(p => `${p.ign} (${p.nickname})`).join(', ');
      
      const embed = successEmbed(
        'Players Unlinked', 
<<<<<<< HEAD
=======
        `✅ Successfully unlinked **${updateResult.affectedRows} player(s)** for **${searchTerm}** on this server.\n\n**Unlinked players:**\n${playerList}\n\n**Note:** Players have been marked as inactive and can now link again with new names.`
>>>>>>> 5bdadc7ffd12ce1dd8bf849cc7fb2443820b55f8
      );

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in unlink command:', error);
      await interaction.editReply({ 
        embeds: [errorEmbed('Error', 'Failed to unlink player. Please try again.')] 
      });
    }
  }
};