const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-shop-kit')
    .setDescription('Remove a kit from the shop')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(TRUE)
        .setAutocomplete(TRUE))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Select a category')
        .setRequired(TRUE)
        .setAutocomplete(TRUE))
    .addStringOption(option =>
      option.setName('kit')
        .setDescription('Select a kit to remove')
        .setRequired(TRUE)
        .setAutocomplete(TRUE)),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(TRUE);
    const guildId = interaction.guildId;

    try {
      if (focusedOption.name === 'server') {
        const result = await pool.query(
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
        
        const result = await pool.query(
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
      } else if (focusedOption.name === 'kit') {
        const serverOption = interaction.options.getString('server');
        const categoryOption = interaction.options.getString('category');
        
        const result = await pool.query(
          `SELECT sk.display_name FROM shop_kits sk 
           JOIN shop_categories sc ON sk.category_id = sc.id 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name = ? AND sk.display_name LIKE ? 
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
    await interaction.deferReply({ ephemeral: TRUE });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, FALSE);
    }

    const serverOption = interaction.options.getString('server');
    const categoryOption = interaction.options.getString('category');
    const kitOption = interaction.options.getString('kit');
    const guildId = interaction.guildId;

    try {
      // Get the kit details
      const kitResult = await pool.query(
        `SELECT sk.id, sk.display_name, sk.kit_name, sk.price, rs.nickname as server_name
         FROM shop_kits sk 
         JOIN shop_categories sc ON sk.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name = ? AND sk.display_name = ?`,
        [guildId, serverOption, categoryOption, kitOption]
      );

      if (kitResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Kit Not Found', 'The specified kit was not found.')]
        });
      }

      const kit = kitResult.rows[0];

      // Remove the kit
      await pool.query(
        'DELETE FROM shop_kits WHERE id = ?',
        [kit.id]
      );

      await interaction.editReply({
        embeds: [successEmbed(
          'Kit Removed',
          `**${kit.display_name}** has been removed from the shop on **${kit.server_name}**.\n\n**Kit Details:**\n• **Kit Name:** ${kit.kit_name}\n• **Price:** ${kit.price} coins`
        )]
      });

    } catch (error) {
      console.error('Error removing kit:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to remove kit. Please try again.')]
      });
    }
  },
}; 