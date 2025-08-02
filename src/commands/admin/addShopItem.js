const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-shop-item')
    .setDescription('Add an item to a shop category')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Select a category')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('display_name')
        .setDescription('Display name for the item')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('short_name')
        .setDescription('Short name/ID for the item')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('price')
        .setDescription('Price in currency')
        .setRequired(true)
        .setMinValue(1))
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Quantity to give')
        .setRequired(true)
        .setMinValue(1))
    .addIntegerOption(option =>
      option.setName('timer')
        .setDescription('Cooldown timer in minutes (optional)')
        .setRequired(false)
        .setMinValue(1)),

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
        const serverNickname = interaction.options.getString('server');
        
        if (!serverNickname) {
          await interaction.respond([]);
          return;
        }

        const [result] = await pool.query(
          `SELECT sc.id, sc.name FROM shop_categories sc 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND rs.nickname = ? 
           AND sc.name LIKE ? LIMIT 25`,
          [guildId, serverNickname, `%${focusedOption.value}%`]
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
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const categoryName = interaction.options.getString('category');
    const displayName = interaction.options.getString('display_name');
    const shortName = interaction.options.getString('short_name');
    const price = interaction.options.getInteger('price');
    const quantity = interaction.options.getInteger('quantity');
    const timer = interaction.options.getInteger('timer');
    const guildId = interaction.guildId;

    try {
             // Get server and category
       const [result] = await pool.query(
         `SELECT rs.id as server_id, sc.id as category_id 
          FROM rust_servers rs 
          JOIN shop_categories sc ON rs.id = sc.server_id 
          WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND rs.nickname = ? AND sc.name = ?`,
         [guildId, serverNickname, categoryName]
       );

      if (result.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Not Found', 'Server or category not found.')]
        });
      }

      const { server_id, category_id } = result[0];

      // Check if item already exists in this category
      const [existingResult] = await pool.query(
        'SELECT id FROM shop_items WHERE category_id = ? AND (display_name LIKE ? OR short_name LIKE ?)',
        [category_id, displayName, shortName]
      );

      if (existingResult.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Item Exists', `Item **${displayName}** already exists in this category.`)]
        });
      }

      // Insert new item
      await pool.query(
        'INSERT INTO shop_items (category_id, display_name, short_name, price, quantity, timer) VALUES (?, ?, ?, ?, ?, ?)',
        [category_id, displayName, shortName, price, quantity, timer || null]
      );

      const timerText = timer ? ` (Timer: ${timer}m)` : '';
      
      await interaction.editReply({
        embeds: [successEmbed(
          'Item Added',
          `**${displayName}** has been added to **${categoryName}** in **${serverNickname}**'s shop.\n\n**Price:** ${price}\n**Quantity:** ${quantity}${timerText}`
        )]
      });

    } catch (error) {
      console.error('Error adding shop item:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to add shop item. Please try again.')]
      });
    }
  },
}; 