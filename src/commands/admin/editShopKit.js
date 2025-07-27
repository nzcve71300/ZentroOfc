const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-shop-kit')
    .setDescription('Edit a shop kit using a modal')
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
      option.setName('kit_name')
        .setDescription('Select a kit to edit')
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
      } else if (focusedOption.name === 'kit_name') {
        const serverOption = interaction.options.getString('server');
        const categoryOption = interaction.options.getString('category');
        
        const result = await pool.query(
          `SELECT sk.kit_name FROM shop_kits sk 
           JOIN shop_categories sc ON sk.category_id = sc.id 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = $1 AND rs.nickname = $2 AND sc.name = $3 AND sk.kit_name ILIKE $4 
           LIMIT 25`,
          [guildId, serverOption, categoryOption, `%${focusedOption.value}%`]
        );

        const choices = result.rows.map(row => ({
          name: row.kit_name,
          value: row.kit_name
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
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({
        embeds: [errorEmbed('Access Denied', 'You need administrator permissions to use this command.')],
        ephemeral: true
      });
    }

    const serverOption = interaction.options.getString('server');
    const categoryOption = interaction.options.getString('category');
    const kitNameOption = interaction.options.getString('kit_name');
    const guildId = interaction.guildId;

    try {
      // Get the kit details
      const kitResult = await pool.query(
        `SELECT sk.id, sk.display_name, sk.kit_name, sk.price, sk.quantity, sk.timer 
         FROM shop_kits sk 
         JOIN shop_categories sc ON sk.category_id = sc.id 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = $1 AND rs.nickname = $2 AND sc.name = $3 AND sk.kit_name = $4`,
        [guildId, serverOption, categoryOption, kitNameOption]
      );

      if (kitResult.rows.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('Kit Not Found', 'The specified kit was not found.')],
          ephemeral: true
        });
      }

      const kit = kitResult.rows[0];

      // Create modal for editing
      const modal = new ModalBuilder()
        .setCustomId(`edit_kit_modal_${kit.id}`)
        .setTitle('Edit Shop Kit');

      const displayNameInput = new TextInputBuilder()
        .setCustomId('display_name')
        .setLabel('Display Name')
        .setStyle(TextInputStyle.Short)
        .setValue(kit.display_name)
        .setRequired(true)
        .setMaxLength(100);

      const kitNameInput = new TextInputBuilder()
        .setCustomId('kit_name')
        .setLabel('Kit Name (in-game kit name)')
        .setStyle(TextInputStyle.Short)
        .setValue(kit.kit_name)
        .setRequired(true)
        .setMaxLength(50);

      const priceInput = new TextInputBuilder()
        .setCustomId('price')
        .setLabel('Price (coins)')
        .setStyle(TextInputStyle.Short)
        .setValue(kit.price.toString())
        .setRequired(true)
        .setMaxLength(10);

      const quantityInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel('Quantity')
        .setStyle(TextInputStyle.Short)
        .setValue(kit.quantity.toString())
        .setRequired(true)
        .setMaxLength(5);

      const timerInput = new TextInputBuilder()
        .setCustomId('timer')
        .setLabel('Cooldown Timer (minutes, optional)')
        .setStyle(TextInputStyle.Short)
        .setValue(kit.timer ? kit.timer.toString() : '')
        .setRequired(false)
        .setMaxLength(5);

      const firstActionRow = new ActionRowBuilder().addComponents(displayNameInput);
      const secondActionRow = new ActionRowBuilder().addComponents(kitNameInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(priceInput);
      const fourthActionRow = new ActionRowBuilder().addComponents(quantityInput);
      const fifthActionRow = new ActionRowBuilder().addComponents(timerInput);

      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Error creating edit modal:', error);
      await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to create edit modal. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 