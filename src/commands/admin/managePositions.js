const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage-positions')
    .setDescription('Manage position coordinates')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = $1 AND rs.nickname ILIKE $2 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
        name: row.nickname,
        value: row.id.toString()
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in manage-positions autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const serverId = parseInt(interaction.options.getString('server'));
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const serverResult = await pool.query(
        `SELECT rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.id = $1 AND g.discord_id = $2`,
        [serverId, guildId]
      );

      if (serverResult.rows.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')],
          ephemeral: true
        });
      }

      const serverName = serverResult.rows[0].nickname;

      // Create modal with position type selection and coordinates
      const modal = new ModalBuilder()
        .setCustomId(`position_modal_${serverId}`)
        .setTitle(`Position Coordinates - ${serverName}`);

      // Position type input (Outpost or BanditCamp)
      const positionTypeInput = new TextInputBuilder()
        .setCustomId('position_type')
        .setLabel('Position Type')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter: outpost OR banditcamp')
        .setRequired(true);

      // X coordinate input
      const xInput = new TextInputBuilder()
        .setCustomId('x_position')
        .setLabel('X Position')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter X coordinate')
        .setRequired(false);

      // Y coordinate input
      const yInput = new TextInputBuilder()
        .setCustomId('y_position')
        .setLabel('Y Position')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter Y coordinate')
        .setRequired(false);

      // Z coordinate input
      const zInput = new TextInputBuilder()
        .setCustomId('z_position')
        .setLabel('Z Position')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter Z coordinate')
        .setRequired(false);

      const firstActionRow = new ActionRowBuilder().addComponents(positionTypeInput);
      const secondActionRow = new ActionRowBuilder().addComponents(xInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(yInput);
      const fourthActionRow = new ActionRowBuilder().addComponents(zInput);

      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

      // Show modal immediately
      await interaction.showModal(modal);

    } catch (error) {
      console.error('Error in manage-positions command:', error);
      await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to load position management. Please try again.')],
        ephemeral: true
      });
    }
  }
}; 