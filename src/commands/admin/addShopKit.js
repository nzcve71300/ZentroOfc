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
          `SELECT sc.name FROM shop_categories sc 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = ? AND rs.nickname = ? 
           AND (sc.type = 'kits' OR sc.type = 'both')
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
    await interaction.deferReply();

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const categoryName = interaction.options.getString('category');
    const displayName = interaction.options.getString('display_name');
    const kitName = interaction.options.getString('kit_name');
    const quantity = interaction.options.getInteger('quantity');
    const price = interaction.options.getInteger('price');
    const timer = interaction.options.getInteger('timer') || 0;
    const guildId = interaction.guildId;

    try {
      // Get server and category
      const [result] = await pool.query(
        `SELECT rs.id as server_id, sc.id as category_id, sc.type as category_type 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         JOIN shop_categories sc ON rs.id = sc.server_id 
         WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name = ?`,
        [guildId, serverNickname, categoryName]
      );

      if (result.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Not Found', 'Server or category not found.')]
        });
      }

      const { server_id, category_id, category_type } = result[0];

      // Check if category supports kits
      if (category_type !== 'kits' && category_type !== 'both') {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Category Type', `The category "${categoryName}" only supports items, not kits.`)]
        });
      }

      // Check if kit name already exists in this category
      const [existingKitResult] = await pool.query(
        'SELECT id FROM shop_kits WHERE category_id = ? AND kit_name = ?',
        [category_id, kitName]
      );

      if (existingKitResult.length > 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Kit Already Exists', `A kit with the name "${kitName}" already exists in the "${categoryName}" category.`)]
        });
      }

      // Add the kit to the database
      await pool.query(
        'INSERT INTO shop_kits (category_id, display_name, kit_name, price, quantity, timer) VALUES (?, ?, ?, ?, ?, ?)',
        [category_id, displayName, kitName, price, quantity, timer]
      );

      const timerText = timer > 0 ? ` (Timer: ${timer}m)` : '';
      
      await interaction.editReply({
        embeds: [successEmbed(
          'Kit Added',
          `**${displayName}** has been added to **${categoryName}** in **${serverNickname}**'s shop.\n\n**Kit Name:** ${kitName}\n**Price:** ${price}\n**Quantity:** ${quantity}${timerText}`
        )]
      });

    } catch (error) {
      console.error('Error adding shop kit:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to add kit to shop. Please try again.')]
      });
    }
  },
}; 