const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-scheduler')
    .setDescription('Manage scheduled message pairs for in-game display')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');

    try {
      const server = await getServerByNickname(guildId, serverName);
      if (!server) {
        return interaction.editReply({ embeds: [errorEmbed('Server Not Found', 'This server does not exist.')] });
      }

      const embed = orangeEmbed('Message Scheduler', 'Set a message pair, view message pairs, or delete a message pair');
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`scheduler_add_${server.id}`)
            .setLabel('Add')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`scheduler_view_${server.id}`)
            .setLabel('View')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`scheduler_delete_${server.id}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    } catch (err) {
      console.error('Error in set-scheduler:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to load scheduler. Please try again.')] });
    }
  }
}; 