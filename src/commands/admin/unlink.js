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
        // ✅ Unlink by Discord ID - MARK AS INACTIVE (not delete)
        const [players] = await pool.query(
          `SELECT p.*, rs.nickname 
           FROM players p
           JOIN rust_servers rs ON p.server_id = rs.id
           WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND p.discord_id = ? 
           AND p.is_active = true`,
          [guildId, identifier]
        );
        
        if (players.length === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('No Players Found', `❌ No active players found with Discord ID **${identifier}**.\n\nMake sure you're using the correct Discord ID.`)]
          });
        }
        
        // Store player info before deactivation
        playerInfo = players.map(p => `${p.ign} (${p.nickname})`);
        
        // ✅ Mark all player records as inactive for this Discord ID
        const [updateResult] = await pool.query(
          `UPDATE players 
           SET is_active = false, unlinked_at = CURRENT_TIMESTAMP
           WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND discord_id = ? 
           AND is_active = true`,
          [guildId, identifier]
        );
        
        result = { rowCount: updateResult.affectedRows };
      } else {
        // ✅ Unlink by IGN - MARK AS INACTIVE (not delete) - case-insensitive
        const [players] = await pool.query(
          `SELECT p.*, rs.nickname 
           FROM players p
           JOIN rust_servers rs ON p.server_id = rs.id
           WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND LOWER(p.ign) = LOWER(?) 
           AND p.is_active = true`,
          [guildId, identifier]
        );
        
        if (players.length === 0) {
          return await interaction.editReply({
            embeds: [errorEmbed('No Players Found', `❌ No active players found with in-game name **${identifier}**.\n\nMake sure you're using the correct in-game name.`)]
          });
        }
        
        // Store player info before deactivation
        playerInfo = players.map(p => `${p.ign} (${p.nickname})`);
        
        // ✅ Mark all player records as inactive for this IGN (case-insensitive)
        const [updateResult] = await pool.query(
          `UPDATE players 
           SET is_active = false, unlinked_at = CURRENT_TIMESTAMP
           WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND LOWER(ign) = LOWER(?) 
           AND is_active = true`,
          [guildId, identifier]
        );
        
        result = { rowCount: updateResult.affectedRows };
      }

      const playerList = playerInfo.join(', ');
      const embed = successEmbed(
        'Players Unlinked', 
        `✅ Successfully unlinked **${result.rowCount} player(s)** for **${identifier}**.\n\n**Unlinked players:**\n${playerList}\n\n**Note:** Players have been marked as inactive and can now link again with new names.`
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
