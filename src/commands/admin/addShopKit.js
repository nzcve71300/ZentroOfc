const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-shop-kit')
    .setDescription('Add a kit to a shop category')
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
        .setDescription('Display name for the kit (shown in shop)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('kit_name')
        .setDescription('Kit name (must match kit name on server)')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Quantity of items in the kit')
        .setRequired(true)
        .setMinValue(1))
    .addIntegerOption(option =>
      option.setName('price')
        .setDescription('Price in coins')
        .setRequired(true)
        .setMinValue(1))
    .addIntegerOption(option =>
      option.setName('timer')
        .setDescription('Cooldown timer in minutes (0 for no cooldown)')
        .setRequired(false)
        .setMinValue(0)),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guildId;

    try {
      if (focusedOption.name === 'server') {
        const value = focusedOption.value.toLowerCase();
        
        // Get servers for this guild
        const result = await pool.query(
          `SELECT rs.id, rs.nickname 
           FROM rust_servers rs 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = $1 AND rs.nickname ILIKE $2 
           ORDER BY rs.nickname 
           LIMIT 25`,
          [guildId, `%${value}%`]
        );

        const choices = result.rows.map(row => ({
          name: row.nickname,
          value: row.id.toString()
        }));

        await interaction.respond(choices);
      } else if (focusedOption.name === 'category') {
        const value = focusedOption.value.toLowerCase();
        const serverId = interaction.options.getString('server');

        if (!serverId) {
          await interaction.respond([]);
          return;
        }

        // Get categories for the selected server
        const result = await pool.query(
          `SELECT sc.id, sc.name 
           FROM shop_categories sc 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = $1 AND rs.id = $2 AND sc.name ILIKE $3 
           ORDER BY sc.name 
           LIMIT 25`,
          [guildId, serverId, `%${value}%`]
        );

        const choices = result.rows.map(row => ({
          name: row.name,
          value: row.id.toString()
        }));

        await interaction.respond(choices);
      }
    } catch (error) {
      console.error('Error in autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverId = interaction.options.getString('server');
    const categoryId = interaction.options.getString('category');
    const displayName = interaction.options.getString('display_name');
    const kitName = interaction.options.getString('kit_name');
    const quantity = interaction.options.getInteger('quantity');
    const price = interaction.options.getInteger('price');
    const timer = interaction.options.getInteger('timer') || 0;
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const serverResult = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = $1 AND rs.id = $2`,
        [guildId, serverId]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found.')]
        });
      }

      const { nickname } = serverResult.rows[0];

      // Verify category exists and belongs to the selected server
      const categoryResult = await pool.query(
        `SELECT sc.id, sc.name, sc.type 
         FROM shop_categories sc 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         WHERE rs.id = $1 AND sc.id = $2`,
        [serverId, categoryId]
      );

      if (categoryResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Category Not Found', 'The selected category was not found.')]
        });
      }

      const { name: categoryName, type: categoryType } = categoryResult.rows[0];

      // Check if category supports kits
      if (categoryType !== 'kits' && categoryType !== 'both') {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Category Type', `The category "${categoryName}" only supports items, not kits.`)]
        });
      }

      // Check if kit name already exists in this category
      const existingKitResult = await pool.query(
        'SELECT id FROM shop_kits WHERE category_id = $1 AND kit_name = $2',
        [categoryId, kitName]
      );

      if (existingKitResult.rows.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Kit Already Exists', `A kit with the name "${kitName}" already exists in the "${categoryName}" category.`)]
        });
      }

      // Add the kit to the database
      const insertResult = await pool.query(
        `INSERT INTO shop_kits (category_id, display_name, kit_name, price, quantity, timer) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id`,
        [categoryId, displayName, kitName, price, quantity, timer]
      );

      const kitId = insertResult.rows[0].id;

      // Create success embed
      const embed = successEmbed(
        'Kit Added Successfully',
        `**Kit:** ${displayName}\n**Kit Name:** ${kitName}\n**Category:** ${categoryName}\n**Server:** ${nickname}\n**Price:** ${price} coins\n**Quantity:** ${quantity}x${timer > 0 ? `\n**Cooldown:** ${timer} minutes` : ''}\n\n✅ Kit has been added to the shop!`
      );

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error adding shop kit:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to add kit to shop. Please try again.')]
      });
    }
  },
}; 