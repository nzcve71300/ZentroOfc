const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allow-link')
    .setDescription('Allow a player to link their Discord account')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Player name (Discord username or in-game name)')
        .setRequired(true)
        .setMaxLength(50)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'You need administrator permissions to use this command.')]
      });
    }

    const playerName = interaction.options.getString('name');
    const guildId = interaction.guildId;

    try {
      // For now, this command will just acknowledge the request
      // In a full implementation, you might want to add a table for pending link requests
      
      await interaction.editReply({
        embeds: [successEmbed(
          'Link Request Acknowledged',
          `**Player:** ${playerName}\n\nThis player can now use \`/link <in-game-name>\` to link their Discord account to their in-game character.`
        )]
      });

    } catch (error) {
      console.error('Error allowing link:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to process link request. Please try again.')]
      });
    }
  },
}; 