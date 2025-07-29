const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-shop-category')
    .setDescription('Add a new category to a server\'s shop')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(TRUE)
        .setAutocomplete(TRUE))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Category name')
        .setRequired(TRUE))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Category type')
        .setRequired(TRUE)
        .addChoices(
          { name: 'Items', value: 'items' },
          { name: 'Kits', value: 'kits' },
          { name: 'Both', value: 'both' }
        ))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Required role to access this category (optional)')
        .setRequired(FALSE)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
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
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: TRUE });

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, FALSE);
    }

    const serverNickname = interaction.options.getString('server');
    const categoryName = interaction.options.getString('name');
    const categoryType = interaction.options.getString('type');
    const role = interaction.options.getRole('role');
    const guildId = interaction.guildId;

    try {
      // Get server ID
      const serverResult = await pool.query(
        'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
        [guildId, serverNickname]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult.rows[0].id;

      // Check if category already exists
      const existingResult = await pool.query(
        'SELECT id FROM shop_categories WHERE server_id = ? AND name LIKE ?',
        [serverId, categoryName]
      );

      if (existingResult.rows.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Category Exists', `Category **${categoryName}** already exists for this server.`)]
        });
      }

      // Insert new category
      await pool.query(
        'INSERT INTO shop_categories (server_id, name, type, role) VALUES (?, ?, ?, ?)',
        [serverId, categoryName, categoryType, role ? role.id : null]
      );

      const roleText = role ? ` (Role: ${role.name})` : '';
      
      await interaction.editReply({
        embeds: [successEmbed(
          'Category Added',
          `**${categoryName}** has been added to **${serverNickname}**'s shop.\n\n**Type:** ${categoryType}${roleText}`
        )]
      });

    } catch (error) {
      console.error('Error adding shop category:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to add shop category. Please try again.')]
      });
    }
  },
}; 