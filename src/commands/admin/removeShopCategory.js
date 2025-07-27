const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-shop-category')
    .setDescription('Remove a category from the shop')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Select a category to remove')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guildId;

    try {
      if (focusedOption.name === 'server') {
        const result = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
          [guildId, `%${focusedOption.value}%`]
        );

        const choices = result.rows.map(row => ({
          name: row.nickname,
          value: row.nickname
        }));

        await interaction.respond(choices);
      } else if (focusedOption.name === 'category') {
        const serverOption = interaction.options.getString('server');
        
        const result = await pool.query(
          `SELECT sc.name FROM shop_categories sc 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = $1 AND rs.nickname = $2 AND sc.name ILIKE $3 
           LIMIT 25`,
          [guildId, serverOption, `%${focusedOption.value}%`]
        );

        const choices = result.rows.map(row => ({
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
    const guildId = interaction.guildId;

    try {
      // Get the category details and count items/kits
      const categoryResult = await pool.query(
        `SELECT sc.id, sc.name, sc.type, rs.nickname as server_name,
         (SELECT COUNT(*) FROM shop_items WHERE category_id = sc.id) as item_count,
         (SELECT COUNT(*) FROM shop_kits WHERE category_id = sc.id) as kit_count
         FROM shop_categories sc 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = $1 AND rs.nickname = $2 AND sc.name = $3`,
        [guildId, serverOption, categoryOption]
      );

      if (categoryResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Category Not Found', 'The specified category was not found.')]
        });
      }

      const category = categoryResult.rows[0];
      const totalItems = parseInt(category.item_count) + parseInt(category.kit_count);

      if (totalItems > 0) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Category Not Empty',
            `Cannot remove category **${category.name}** because it contains ${totalItems} items/kits.\n\nPlease remove all items and kits from this category first using \`/remove-shop-item\` and \`/remove-shop-kit\`.`
          )]
        });
      }

      // Remove the category
      await pool.query(
        'DELETE FROM shop_categories WHERE id = $1',
        [category.id]
      );

      await interaction.editReply({
        embeds: [successEmbed(
          'Category Removed',
          `**${category.name}** has been removed from the shop on **${category.server_name}**.\n\n**Category Details:**\n• **Type:** ${category.type}\n• **Items:** ${category.item_count}\n• **Kits:** ${category.kit_count}`
        )]
      });

    } catch (error) {
      console.error('Error removing category:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to remove category. Please try again.')]
      });
    }
  },
}; 