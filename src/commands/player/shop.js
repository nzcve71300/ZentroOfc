const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Open the shop to purchase items and kits'),

  async execute(interaction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Get all servers in this guild
      const serversResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1',
        [guildId]
      );

      if (serversResult.rows.length === 0) {
        return interaction.editReply(orangeEmbed('Error', 'No servers found in this guild.'));
      }

      // Get player's balance across all servers
      const balanceResult = await pool.query(
        `SELECT rs.nickname, e.balance, p.id as player_id
         FROM players p
         JOIN economy e ON p.id = e.player_id
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         ORDER BY e.balance DESC`,
        [userId, guildId]
      );

      if (balanceResult.rows.length === 0) {
        return interaction.editReply(orangeEmbed(
          '💰 Shop',
          'You don\'t have any balance on any servers.\n\nUse `/daily` to get some coins first!'
        ));
      }

      // Get shop categories for all servers
      const categoriesResult = await pool.query(
        `SELECT sc.id, sc.name, sc.type, rs.nickname as server_name, rs.id as server_id
         FROM shop_categories sc
         JOIN rust_servers rs ON sc.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE g.discord_id = $1
         ORDER BY rs.nickname, sc.name`,
        [guildId]
      );

      if (categoriesResult.rows.length === 0) {
        return interaction.editReply(orangeEmbed(
          '💰 Shop',
          'No shop categories available.\n\nAdmins need to create categories using `/add-shop-category`.'
        ));
      }

      // Create server selection dropdown
      const serverOptions = serversResult.rows.map(server => ({
        label: server.nickname,
        description: `Browse ${server.nickname}'s shop`,
        value: server.id.toString()
      }));

      const row = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('shop_server_select')
            .setPlaceholder('Select a server to browse')
            .addOptions(serverOptions)
        );

      // Show balance summary
      const balanceList = balanceResult.rows.map(row => 
        `**${row.nickname}:** ${row.balance || 0} coins`
      ).join('\n');

      const embed = orangeEmbed(
        '💰 Shop',
        `**Your Balance:**\n${balanceList}\n\nSelect a server to browse their shop!`
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error opening shop:', error);
      await interaction.editReply(orangeEmbed('Error', 'Failed to open shop. Please try again.'));
    }
  },
}; 