const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-shop-category')
    .setDescription('Add a new category to a server\'s shop')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Category name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Category type')
        .setRequired(true)
        .addChoices(
          { name: 'Items', value: 'items' },
          { name: 'Kits', value: 'kits' }
        ))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Required role to access this category (optional)')
        .setRequired(false)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
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
    const serverNickname = interaction.options.getString('server');
    const categoryName = interaction.options.getString('name');
    const categoryType = interaction.options.getString('type');
    const role = interaction.options.getRole('role');
    const guildId = interaction.guildId;

    try {
      // Get server ID
      const serverResult = await pool.query(
        'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverNickname]
      );

      if (serverResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed('Error', 'Server not found.')],
          ephemeral: true
        });
      }

      const serverId = serverResult.rows[0].id;

      // Check if category already exists
      const existingResult = await pool.query(
        'SELECT id FROM shop_categories WHERE server_id = $1 AND name ILIKE $2',
        [serverId, categoryName]
      );

      if (existingResult.rows.length > 0) {
        return interaction.reply({
          embeds: [orangeEmbed('Error', `Category **${categoryName}** already exists for this server.`)],
          ephemeral: true
        });
      }

      // Insert new category
      await pool.query(
        'INSERT INTO shop_categories (server_id, name, type, role) VALUES ($1, $2, $3, $4)',
        [serverId, categoryName, categoryType, role ? role.id : null]
      );

      const roleText = role ? ` (Role: ${role.name})` : '';
      
      await interaction.reply({
        embeds: [orangeEmbed(
          '✅ Category Added',
          `**${categoryName}** has been added to **${serverNickname}**'s shop.\n\n**Type:** ${categoryType}${roleText}`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error adding shop category:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to add shop category. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 