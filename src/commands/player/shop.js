const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and purchase items from the shop')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server to browse')
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
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');

    try {
      // Get the specific server
      const serverResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverOption]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult.rows[0].id;
      const serverName = serverResult.rows[0].nickname;

      // Get player's balance for this specific server
      const balanceResult = await pool.query(
        `SELECT e.balance, p.id as player_id
         FROM players p
         JOIN economy e ON p.id = e.player_id
         WHERE p.discord_id = $1 AND p.server_id = $2`,
        [userId, serverId]
      );

      let balance = 0;
      let playerId = null;

      if (balanceResult.rows.length > 0) {
        balance = balanceResult.rows[0].balance || 0;
        playerId = balanceResult.rows[0].player_id;
      }

      // Get shop categories for this specific server
      const categoriesResult = await pool.query(
        `SELECT sc.id, sc.name, sc.type
         FROM shop_categories sc
         WHERE sc.server_id = $1
         ORDER BY sc.name`,
        [serverId]
      );

      if (categoriesResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            '💰 Shop',
            `No shop categories available on **${serverName}**.\n\nAdmins need to create categories using \`/add-shop-category\`.`
          )]
        });
      }

      // Create category selection dropdown
      const categoryOptions = categoriesResult.rows.map(category => ({
        label: category.name,
        description: `${category.type} category`,
        value: category.id.toString()
      }));

      const row = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('shop_category_select')
            .setPlaceholder('Select a category to browse')
            .addOptions(categoryOptions)
        );

      const embed = orangeEmbed(
        '💰 Shop',
        `**Server:** ${serverName}\n**Your Balance:** ${balance} coins\n\nSelect a category to browse items and kits!`
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error opening shop:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to open shop. Please try again.')]
      });
    }
  },
}; 