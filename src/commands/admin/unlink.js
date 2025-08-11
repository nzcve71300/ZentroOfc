const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player from all servers (Admin only)')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Discord ID or in-game name of the player to unlink')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const identifier = interaction.options.getString('name').trim();

    // Validate input
    if (!identifier || identifier.length < 2) {
      return await interaction.editReply({
        embeds: [errorEmbed('Invalid Input', 'Please provide a valid Discord ID or in-game name (at least 2 characters).')]
      });
    }

    try {
      // Check if identifier is a Discord ID (numeric)
      const isDiscordId = /^\d+$/.test(identifier);
      
      let result;
      let playerInfo = [];
      
      if (isDiscordId) {
        // Unlink by Discord ID - COMPLETELY REMOVE from database
        const [players] = await pool.query(
          `SELECT p.*, rs.nickname 
           FROM players p
           JOIN rust_servers rs ON p.server_id = rs.id
           WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND p.discord_id = ?`,
          [guildId, identifier]
        );
        
        if (players.length === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('No Players Found', `❌ No players found with Discord ID **${identifier}**.\n\nMake sure you're using the correct Discord ID.`)]
          });
        }
        
        // Store player info before deletion
        playerInfo = players.map(p => `${p.ign} (${p.nickname})`);
        
        // Delete all player records for this Discord ID
        const [deleteResult] = await pool.query(
          `DELETE FROM players 
           WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND discord_id = ?`,
          [guildId, identifier]
        );
        
        result = { rowCount: deleteResult.affectedRows };
      } else {
        // Unlink by IGN - COMPLETELY REMOVE from database
        const [players] = await pool.query(
          `SELECT p.*, rs.nickname 
           FROM players p
           JOIN rust_servers rs ON p.server_id = rs.id
           WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND LOWER(p.ign) = LOWER(?)`,
          [guildId, identifier]
        );
        
        if (players.length === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('No Players Found', `❌ No players found with in-game name **${identifier}**.\n\nMake sure you're using the correct in-game name.`)]
          });
        }
        
        // Store player info before deletion
        playerInfo = players.map(p => `${p.ign} (${p.nickname})`);
        
        // Delete all player records for this IGN
        const [deleteResult] = await pool.query(
          `DELETE FROM players 
           WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND LOWER(ign) = LOWER(?)`,
          [guildId, identifier]
        );
        
        result = { rowCount: deleteResult.affectedRows };
      }

      const playerList = playerInfo.join(', ');
      const embed = successEmbed(
        'Players Unlinked', 
        `✅ Successfully unlinked **${result.rowCount} player(s)** for **${identifier}**.\n\n**Removed players:**\n${playerList}\n\n**Note:** Players have been completely removed from the database and can now link again with new names.`
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in unlink:', error);
      await interaction.editReply({ 
        embeds: [errorEmbed('Error', 'Failed to unlink player. Please try again.')] 
      });
    }
  }
};
