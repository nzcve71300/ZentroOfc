const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-shop-item')
    .setDescription('Edit a shop item using a modal')
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
      option.setName('item')
        .setDescription('Select an item to edit')
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
      } else if (focusedOption.name === 'item') {
        const serverOption = interaction.options.getString('server');
        const categoryOption = interaction.options.getString('category');
        
        const result = await pool.query(
          `SELECT si.display_name FROM shop_items si 
           JOIN shop_categories sc ON si.category_id = sc.id 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name = ? AND si.display_name LIKE ? 
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
    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, TRUE);
    }

    const serverOption = interaction.options.getString('server');
    const categoryOption = interaction.options.getString('category');
    const itemOption = interaction.options.getString('item');
    const guildId = interaction.guildId;

    try {
      // Get the item details
      const itemResult = await pool.query(
        `SELECT si.id, si.display_name, si.short_name, si.price, si.quantity, si.timer 
         FROM shop_items si 
         JOIN shop_categories sc ON si.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname = ? AND sc.name = ? AND si.display_name = ?`,
        [guildId, serverOption, categoryOption, itemOption]
      );

      if (itemResult.rows.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('Item Not Found', 'The specified item was not found.')],
          ephemeral: TRUE
        });
      }

      const item = itemResult.rows[0];

      // Create modal for editing
      const modal = new ModalBuilder()
        .setCustomId(`edit_item_modal_${item.id}`)
        .setTitle('Edit Shop Item');

      const displayNameInput = new TextInputBuilder()
        .setCustomId('display_name')
        .setLabel('Display Name')
        .setStyle(TextInputStyle.Short)
        .setValue(item.display_name)
        .setRequired(TRUE)
        .setMaxLength(100);

      const shortNameInput = new TextInputBuilder()
        .setCustomId('short_name')
        .setLabel('Short Name (Item ID)')
        .setStyle(TextInputStyle.Short)
        .setValue(item.short_name)
        .setRequired(TRUE)
        .setMaxLength(50);

      const priceInput = new TextInputBuilder()
        .setCustomId('price')
        .setLabel('Price (coins)')
        .setStyle(TextInputStyle.Short)
        .setValue(item.price.toString())
        .setRequired(TRUE)
        .setMaxLength(10);

      const quantityInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel('Quantity')
        .setStyle(TextInputStyle.Short)
        .setValue(item.quantity.toString())
        .setRequired(TRUE)
        .setMaxLength(5);

      const timerInput = new TextInputBuilder()
        .setCustomId('timer')
        .setLabel('Cooldown Timer (minutes, optional)')
        .setStyle(TextInputStyle.Short)
        .setValue(item.timer ? item.timer.toString() : '')
        .setRequired(FALSE)
        .setMaxLength(5);

      const firstActionRow = new ActionRowBuilder().addComponents(displayNameInput);
      const secondActionRow = new ActionRowBuilder().addComponents(shortNameInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(priceInput);
      const fourthActionRow = new ActionRowBuilder().addComponents(quantityInput);
      const fifthActionRow = new ActionRowBuilder().addComponents(timerInput);

      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Error creating edit modal:', error);
      await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to create edit modal. Please try again.')],
        ephemeral: TRUE
      });
    }
  },
}; 