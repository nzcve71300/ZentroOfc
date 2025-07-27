const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-shop-kit')
    .setDescription('Remove a kit from the shop')
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
      option.setName('kit')
        .setDescription('Select a kit to remove')
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
      } else if (focusedOption.name === 'kit') {
        const serverOption = interaction.options.getString('server');
        const categoryOption = interaction.options.getString('category');
        
        const result = await pool.query(
          `SELECT sk.display_name FROM shop_kits sk 
           JOIN shop_categories sc ON sk.category_id = sc.id 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = $1 AND rs.nickname = $2 AND sc.name = $3 AND sk.display_name ILIKE $4 
           LIMIT 25`,
          [guildId, serverOption, categoryOption, `%${focusedOption.value}%`]
        );

        const choices = result.rows.map(row => ({
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
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'You need administrator permissions to use this command.')]
      });
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
         WHERE g.discord_id = $1 AND rs.nickname = $2 AND sc.name = $3 AND sk.display_name = $4`,
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
        'DELETE FROM shop_kits WHERE id = $1',
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