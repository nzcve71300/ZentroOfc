const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('open-shop')
    .setDescription('Open the shop for a specific server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true)),

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

      // Get shop categories for this server
      const categoriesResult = await pool.query(
        'SELECT id, name, type FROM shop_categories WHERE server_id = $1 ORDER BY name',
        [serverId]
      );

      if (categoriesResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed(
            '💰 Shop',
            `No shop categories found for **${serverNickname}**.\n\nUse \`/add-shop-category\` to create categories first.`
          )],
          ephemeral: true
        });
      }

      // Create category list
      let categoryList = '';
      categoriesResult.rows.forEach(category => {
        categoryList += `• **${category.name}** (${category.type})\n`;
      });

      await interaction.reply({
        embeds: [orangeEmbed(
          '💰 Shop',
          `**${serverNickname}** Shop Categories:\n\n${categoryList}\n\nPlayers can use \`/shop\` to browse and purchase items.`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error opening shop:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to open shop. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 