const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { updateSubscription } = require('../../utils/subscriptionSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mark-paid')
    .setDescription('Mark a guild as paid (Owner only)')
    .addStringOption(option =>
      option.setName('guild_id')
        .setDescription('Discord guild ID')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('allowed_servers')
        .setDescription('Number of servers allowed')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(10)),

  async execute(interaction) {
    // Check if user is the bot owner
    const BOT_OWNER_ID = '1252993829007528086';
    
    if (interaction.user.id !== BOT_OWNER_ID) {
      return interaction.reply({
        embeds: [errorEmbed(
          '❌ Access Denied',
          'You do not have permission to use this command.'
        )],
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.options.getString('guild_id');
    const allowedServers = interaction.options.getInteger('allowed_servers');

    try {
      // Validate guild ID format
      if (!/^\d+$/.test(guildId)) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Invalid Guild ID',
            'Please provide a valid Discord guild ID (numbers only).'
          )]
        });
      }

      // Update the subscription
      await updateSubscription(guildId, allowedServers);

      const message = allowedServers > 0 
        ? `✅ Guild **${guildId}** has been marked as paid with **${allowedServers}** servers allowed.`
        : `✅ Guild **${guildId}** has been marked as unpaid (0 servers allowed).`;

      await interaction.editReply({
        embeds: [successEmbed(
          'Subscription Updated',
          message
        )]
      });

    } catch (error) {
      console.error('Error in mark-paid command:', error);
      await interaction.editReply({
        embeds: [errorEmbed(
          'Error',
          'Failed to update subscription. Please try again.'
        )]
      });
    }
  },
}; 