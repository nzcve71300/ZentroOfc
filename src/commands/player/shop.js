const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname, getActivePlayerByDiscordId, getPlayerBalance, getServersForGuild } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and purchase items from the shop')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server to browse')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    try {
      const servers = await getServersForGuild(guildId);
      const filtered = servers.filter(s => s.nickname.toLowerCase().includes(focusedValue.toLowerCase()));
      await interaction.respond(filtered.map(s => ({ name: s.nickname, value: s.nickname })));
    } catch (err) {
      console.error('Autocomplete error:', err);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');

    try {
      // Get server using shared helper
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server does not exist.')]
        });
      }

      // Get player using unified system
      const player = await getActivePlayerByDiscordId(guildId, server.id, userId);
      if (!player) {
        return interaction.editReply({
          embeds: [errorEmbed(
            'Account Not Linked',
            'You must link your Discord account to your in-game character first.\n\nUse `/link <in-game-name>` to link your account.'
          )]
        });
      }

      // Get player balance using unified system
      const balance = await getPlayerBalance(player.id);

      // Fetch categories for the shop
      const [categoriesResult] = await pool.query(
        `SELECT sc.id, sc.name, sc.type, sc.role
         FROM shop_categories sc
         WHERE sc.server_id = ?
         ORDER BY sc.name`,
        [server.id]
      );

      if (categoriesResult.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'Shop',
            `No shop categories are available on **${server.nickname}**.\nAdmins need to create categories using \`/add-shop-category\`.`
          )]
        });
      }

      // Build dropdown with role checking
      const categoryOptions = [];
      for (const category of categoriesResult) {
        const hasRole = !category.role || interaction.member.roles.cache.has(category.role);
        const lockIcon = category.role && !hasRole ? '🔒 ' : '';
        
        categoryOptions.push({
          label: `${lockIcon}${category.name}`,
          description: `${category.type} category${category.role && !hasRole ? ' (Role Required)' : ''}`,
          value: category.id.toString(),
          disabled: category.role && !hasRole // Disable if role required but user doesn't have it
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('shop_category_select')
          .setPlaceholder('Select a category to browse')
          .addOptions(categoryOptions)
      );

      // Get currency name for this server
      const { getCurrencyName } = require('../../utils/economy');
      const currencyName = await getCurrencyName(server.id);
      
      const embed = orangeEmbed(
        'Shop',
        `**Server:** ${server.nickname}\n**Your Balance:** ${balance} ${currencyName}\n\nSelect a category below to browse items and kits!`
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('Error opening shop:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to open the shop. Please try again.')]
      });
    }
  },
};
