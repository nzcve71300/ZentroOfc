const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getPlayerBalance, getServersForGuild } = require('../../utils/economy');
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
      const choices = await getServersForGuild(guildId, focusedValue);
      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');

    try {
      // Get the specific server using shared helper
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Check if player is linked to any server
      const linkedResult = await pool.query(
        `SELECT p.id as player_id, p.ign
         FROM players p
         JOIN rust_servers rs ON p.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE p.discord_id = $1 AND g.discord_id = $2
         LIMIT 1`,
        [userId, guildId]
      );

      if (linkedResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Account Not Linked',
            'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account before using this command.'
          )]
        });
      }

      // Get balance for the selected server using shared helper
      const balanceData = await getPlayerBalance(guildId, serverOption, userId);
      if (!balanceData) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Account Not Linked',
            'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account before using this command.'
          )]
        });
      }

      const balance = balanceData.balance;
      const playerId = linkedResult.rows[0].player_id;

      // Get shop categories for this specific server
      const categoriesResult = await pool.query(
        `SELECT sc.id, sc.name, sc.type
         FROM shop_categories sc
         WHERE sc.server_id = $1
         ORDER BY sc.name`,
        [server.id]
      );

      if (categoriesResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'Shop',
            `No shop categories available on **${server.nickname}**.\n\nAdmins need to create categories using \`/add-shop-category\`.`
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
        'Shop',
        `**Server:** ${server.nickname}\n**Your Balance:** ${balance}\n\nSelect a category to browse items and kits!`
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