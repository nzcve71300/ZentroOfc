const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a player from all servers')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Discord ID or in-game name of the player to unlink')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const identifier = interaction.options.getString('name');

    try {
      // Check if identifier is a Discord ID (numeric)
      const isDiscordId = /^\d+$/.test(identifier);
      
      let result;
      if (isDiscordId) {
        // Unlink by Discord ID
        const [updateResult] = await pool.query(
          `UPDATE players 
           SET is_active = false, unlinked_at = CURRENT_TIMESTAMP 
           WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND discord_id = ? 
           AND is_active = true`,
          [guildId, identifier]
        );
        
        if (updateResult.affectedRows === 0) {
          return interaction.editReply({
            embeds: [errorEmbed('No Players Found', `❌ No active players found with Discord ID **${identifier}**.\n\nMake sure you're using the correct Discord ID.`)]
          });
        }
        
        result = { rowCount: updateResult.affectedRows };
      } else {
        // Unlink by IGN
        const [updateResult] = await pool.query(
          `UPDATE players 
           SET is_active = false, unlinked_at = CURRENT_TIMESTAMP 
           WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND LOWER(ign) = LOWER(?) 
           AND is_active = true`,
          [guildId, identifier]
        );
        
        if (updateResult.affectedRows === 0) {
          return interaction.editReply({
            embeds: [errorEmbed('No Players Found', `❌ No active players found with in-game name **${identifier}**.\n\nMake sure you're using the correct in-game name.`)]
          });
        }
        
        result = { rowCount: updateResult.affectedRows };
      }

      const embed = successEmbed(
        'Players Unlinked', 
        `✅ Successfully unlinked **${result.rowCount} player(s)** for **${identifier}**.`
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in unlink:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to unlink player. Please try again.')] });
    }
  }
};
