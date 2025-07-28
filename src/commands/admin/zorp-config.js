const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('zorp-config')
    .setDescription('Configure ZORP default settings')
    .addIntegerOption(option =>
      option.setName('size')
        .setDescription('Default zone size (default: 75)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('color_online')
        .setDescription('Default online color (R,G,B format, default: 0,255,0)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('color_offline')
        .setDescription('Default offline color (R,G,B format, default: 255,0,0)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('expire')
        .setDescription('Default expiration time in seconds (default: 115200)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('min_team')
        .setDescription('Default minimum team size (default: 1)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('max_team')
        .setDescription('Default maximum team size (default: 8)')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const size = interaction.options.getInteger('size');
      const colorOnline = interaction.options.getString('color_online');
      const colorOffline = interaction.options.getString('color_offline');
      const expire = interaction.options.getInteger('expire');
      const minTeam = interaction.options.getInteger('min_team');
      const maxTeam = interaction.options.getInteger('max_team');

      // For now, we'll just show the current defaults since we don't have a config table
      // In a full implementation, you'd store these in a config table
      
      const embed = orangeEmbed('**ZORP Configuration**');
      
      embed.addFields(
        {
          name: 'Current Defaults',
          value: `**Size:** 75\n**Online Color:** 0,255,0 (Green)\n**Offline Color:** 255,0,0 (Red)\n**Expire:** 115200 seconds (32 hours)\n**Min Team:** 1\n**Max Team:** 8`,
          inline: true
        },
        {
          name: 'Usage',
          value: 'Use `/edit-zone <zone_name>` to modify individual zones.\n\nZones are created automatically when players use the ZORP emote in-game.',
          inline: true
        }
      );

      if (size || colorOnline || colorOffline || expire || minTeam || maxTeam) {
        embed.addFields({
          name: 'Note',
          value: 'Configuration changes would be applied to new zones only. Use `/edit-zone` to modify existing zones.',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error configuring ZORP:', error);
      await interaction.editReply({
        embeds: [errorEmbed('**Error:** Failed to execute this command. Please try again later.')]
      });
    }
  },
}; 