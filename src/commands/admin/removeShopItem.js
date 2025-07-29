const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-shop-item')
    .setDescription('Remove an item from the shop')
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
      option.setName('item')
        .setDescription('Select an item to remove')
        .setRequired(true)
        .setAutocomplete(true)),

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
      } else if (focusedOption.name === 'item') {
        const serverOption = interaction.options.getString('server');
        const categoryOption = interaction.options.getString('category');
        
        const [result] = await pool.query(
          `SELECT si.display_name FROM shop_items si 
           JOIN shop_categories sc ON si.category_id = sc.id 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name = ? AND si.display_name LIKE ? 
           LIMIT 25`,
          [guildId, serverOption, categoryOption, `%${focusedOption.value}%`]
        );

        const choices = result.map(row => ({
          name: row.display_name,
          value: row.display_name
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
    const itemOption = interaction.options.getString('item');
    const guildId = interaction.guildId;

    try {
      // Get the item details
      const [itemResult] = await pool.query(
        `SELECT si.id, si.display_name, si.short_name, si.price, rs.nickname as server_name
         FROM shop_items si 
         JOIN shop_categories sc ON si.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name = ? AND si.display_name = ?`,
        [guildId, serverOption, categoryOption, itemOption]
      );

      if (itemResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Item Not Found', 'The specified item was not found.')]
        });
      }

      const item = itemResult[0];

      // Remove the item
      await pool.query(
        'DELETE FROM shop_items WHERE id = ?',
        [item.id]
      );

      await interaction.editReply({
        embeds: [successEmbed(
          'Item Removed',
          `**${item.display_name}** has been removed from the shop on **${item.server_name}**.\n\n**Item Details:**\n• **Short Name:** ${item.short_name}\n• **Price:** ${item.price} coins`
        )]
      });

    } catch (error) {
      console.error('Error removing item:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to remove item. Please try again.')]
      });
    }
  },
}; 