const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-shop-vehicle')
    .setDescription('Remove a vehicle from the shop')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Select a vehicle category')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('vehicle')
        .setDescription('Select a vehicle to remove')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guildId;

    try {
      if (focusedOption.name === 'server') {
        // Server autocomplete
        const [result] = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
          [guildId, `%${focusedOption.value}%`]
        );

        const choices = result.map(row => ({
          name: row.nickname,
          value: row.nickname
        }));

        await interaction.respond(choices);
      } else if (focusedOption.name === 'category') {
        // Category autocomplete - only show vehicle categories
        const serverNickname = interaction.options.getString('server');
        
        if (!serverNickname) {
          await interaction.respond([]);
          return;
        }

        // Get vehicle categories for the selected server
        const [result] = await pool.query(
          `SELECT sc.name FROM shop_categories sc 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND rs.nickname = ? 
           AND sc.type = 'vehicles' AND sc.name LIKE ? LIMIT 25`,
          [guildId, serverNickname, `%${focusedOption.value}%`]
        );

        const choices = result.map(row => ({
          name: row.name,
          value: row.name
        }));

        await interaction.respond(choices);
      } else if (focusedOption.name === 'vehicle') {
        // Vehicle autocomplete
        const serverNickname = interaction.options.getString('server');
        const categoryName = interaction.options.getString('category');
        
        if (!serverNickname || !categoryName) {
          await interaction.respond([]);
          return;
        }

        // Get vehicles for the selected category
        const [result] = await pool.query(
          `SELECT sv.id, sv.display_name, sv.short_name, sv.price 
           FROM shop_vehicles sv
           JOIN shop_categories sc ON sv.category_id = sc.id
           JOIN rust_servers rs ON sc.server_id = rs.id
           WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND rs.nickname = ? AND sc.name = ? 
           AND sv.display_name LIKE ? 
           ORDER BY sv.display_name LIMIT 25`,
          [guildId, serverNickname, categoryName, `%${focusedOption.value}%`]
        );

        const choices = result.map(row => ({
          name: `${row.display_name} - ${row.price} coins`,
          value: row.id.toString()
        }));

        await interaction.respond(choices);
      } else {
        // For any other field, return empty array
        await interaction.respond([]);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const categoryName = interaction.options.getString('category');
    const vehicleId = interaction.options.getString('vehicle');
    const guildId = interaction.guildId;

    try {
      // Get vehicle details
      const [result] = await pool.query(
        `SELECT sv.id, sv.display_name, sv.short_name, sv.price, rs.nickname as server_name
         FROM shop_vehicles sv
         JOIN shop_categories sc ON sv.category_id = sc.id
         JOIN rust_servers rs ON sc.server_id = rs.id
         WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND rs.nickname = ? AND sc.name = ? AND sv.id = ?`,
        [guildId, serverNickname, categoryName, vehicleId]
      );

      if (result.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Vehicle Not Found', 'The specified vehicle was not found.')]
        });
      }

      const vehicle = result[0];

      // Remove the vehicle
      await pool.query(
        'DELETE FROM shop_vehicles WHERE id = ?',
        [vehicleId]
      );

      await interaction.editReply({
        embeds: [successEmbed(
          'Vehicle Removed',
          `**${vehicle.display_name}** has been removed from **${categoryName}** in **${vehicle.server_name}**'s shop.\n\n**Vehicle Details:**\n• **Display Name:** ${vehicle.display_name}\n• **Short Name:** ${vehicle.short_name}\n• **Price:** ${vehicle.price} coins\n\n💡 **To see the updated shop, use:** \`/shop server:${serverNickname}\``
        )]
      });

    } catch (error) {
      console.error('Error removing shop vehicle:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to remove shop vehicle. Please try again.')]
      });
    }
  },
};
