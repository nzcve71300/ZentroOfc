const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { cleanupZorpDuplicates } = require('../../rcon');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleanup-zorps')
    .setDescription('Clean up duplicate and orphaned ZORP zones in the database')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    console.log(`🧹 CLEANUP-ZORPS: Admin ${interaction.user.id} triggered ZORP cleanup`);
    
    try {
      await interaction.deferReply({ flags: 64 });
      
      if (!hasAdminPermissions(interaction.member)) {
        return sendAccessDeniedMessage(interaction, false);
      }

      console.log(`🧹 CLEANUP-ZORPS: Starting cleanup process...`);
      
      // Run the cleanup function
      await cleanupZorpDuplicates();
      
      const embed = successEmbed(
        'ZORP Cleanup Complete', 
        '✅ **ZORP cleanup completed successfully!**\n\n' +
        'The system has:\n' +
        '• Removed duplicate zone entries\n' +
        '• Cleaned up orphaned zones (in database but not in game)\n' +
        '• Synchronized database with actual game state\n\n' +
        'Check the console logs for detailed information about what was cleaned up.'
      );
      
      await interaction.editReply({ embeds: [embed] });
      
      console.log(`🧹 CLEANUP-ZORPS: Cleanup completed successfully`);

    } catch (error) {
      console.error('❌ CLEANUP-ZORPS: Error in cleanup-zorps command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', '❌ **Error:** Failed to cleanup ZORP zones. Please check the console logs for details.')]
      });
    }
  }
};
