const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-shop-category')
    .setDescription('Edit a shop category')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Select a category to edit')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('new_name')
        .setDescription('New category name')
        .setRequired(true)
        .setMaxLength(100))
    .addStringOption(option =>
      option.setName('new_type')
        .setDescription('New category type')
        .setRequired(true)
        .addChoices(
          { name: 'Items Only', value: 'items' },
          { name: 'Kits Only', value: 'kits' },
          { name: 'Both Items & Kits', value: 'both' }
        ))
    .addStringOption(option =>
      option.setName('new_role')
        .setDescription('New role requirement (optional)')
        .setRequired(false)
        .setMaxLength(100)),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guildId;

    try {
      if (focusedOption.name === 'server') {
        const [result] = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
          [guildId, `%${focusedOption.value}%`]
        );

        const choices = result.map(row => ({
          name: row.nickname,
          value: row.nickname
        }));

        await interaction.respond(choices);
      } else if (focusedOption.name === 'category') {
        const serverOption = interaction.options.getString('server');
        
        const [result] = await pool.query(
          `SELECT sc.name FROM shop_categories sc 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name LIKE ? 
           LIMIT 25`,
          [guildId, serverOption, `%${focusedOption.value}%`]
        );

        const choices = result.map(row => ({
          name: row.name,
          value: row.name
        }));

        await interaction.respond(choices);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverOption = interaction.options.getString('server');
    const categoryOption = interaction.options.getString('category');
    const newName = interaction.options.getString('new_name');
    const newType = interaction.options.getString('new_type');
    const newRole = interaction.options.getString('new_role');
    const guildId = interaction.guildId;

    try {
      // Get the category details
      const [categoryResult] = await pool.query(
        `SELECT sc.id, sc.name, sc.type, sc.role, rs.nickname as server_name
         FROM shop_categories sc 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name = ?`,
        [guildId, serverOption, categoryOption]
      );

      if (categoryResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Category Not Found', 'The specified category was not found.')]
        });
      }

      const category = categoryResult[0];

      // Check if new name already exists (if name is being changed)
      if (newName !== category.name) {
        const [existingResult] = await pool.query(
          `SELECT sc.id FROM shop_categories sc 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name = ?`,
          [guildId, serverOption, newName]
        );

        if (existingResult.length > 0) {
          return interaction.editReply({
            embeds: [errorEmbed('Name Already Exists', `A category with the name "${newName}" already exists on this server.`)]
          });
        }
      }

      // Update the category
      await pool.query(
        'UPDATE shop_categories SET name = ?, type = ?, role = ? WHERE id = ?',
        [newName, newType, newRole || null, category.id]
      );

      const embed = successEmbed(
        'Category Updated',
        `**${category.name}** has been updated on **${category.server_name}**.`
      );

      embed.addFields({
        name: '📋 Changes Made',
        value: `**Name:** ${category.name} → ${newName}\n**Type:** ${category.type} → ${newType}\n**Role:** ${category.role || 'None'} → ${newRole || 'None'}`,
        inline: false
      });

      embed.addFields({
        name: '💡 Category Types',
        value: '• **Items Only** - Only shop items\n• **Kits Only** - Only shop kits\n• **Both Items & Kits** - Both items and kits',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error updating category:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to update category. Please try again.')]
      });
    }
  },
}; 