const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('open-shop')
    .setDescription('Open the shop for a specific server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server to open shop for')
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
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'You need administrator permissions to use this command.')]
      });
    }

    const serverOption = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Get server info
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

      // Get shop categories for this server
      const categoriesResult = await pool.query(
        'SELECT id, name, type FROM shop_categories WHERE server_id = $1 ORDER BY name',
        [serverId]
      );

      if (categoriesResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            '💰 Shop Status',
            `**Server:** ${serverName}\n\nNo shop categories available. Create categories using \`/add-shop-category\` first.`
          )]
        });
      }

      // Create shop overview embed
      const embed = orangeEmbed(
        '💰 Shop Overview',
        `**Server:** ${serverName}\n\n**Available Categories:**`
      );

      for (const category of categoriesResult.rows) {
        // Count items and kits in this category
        const itemsResult = await pool.query(
          'SELECT COUNT(*) as count FROM shop_items WHERE category_id = $1',
          [category.id]
        );
        
        const kitsResult = await pool.query(
          'SELECT COUNT(*) as count FROM shop_kits WHERE category_id = $1',
          [category.id]
        );

        const itemCount = itemsResult.rows[0].count;
        const kitCount = kitsResult.rows[0].count;

        embed.addFields({
          name: `📁 ${category.name}`,
          value: `**Type:** ${category.type}\n**Items:** ${itemCount} | **Kits:** ${kitCount}`,
          inline: true
        });
      }

      embed.addFields({
        name: '📋 Instructions',
        value: 'Players can use `/shop` to browse and purchase items from this server.',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error opening shop:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to open shop. Please try again.')]
      });
    }
  },
}; 