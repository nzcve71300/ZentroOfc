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
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('positions')
        .setDescription('Select position type')
        .setRequired(true)
        .addChoices(
          { name: 'Outpost', value: 'outpost' },
          { name: 'BanditCamp', value: 'banditcamp' }
        )),

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
    const positionType = interaction.options.getString('positions');
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

      // Get current position data if it exists
      const currentDataResult = await pool.query(
        `SELECT x_pos, y_pos, z_pos 
         FROM position_coordinates 
         WHERE server_id = $1 AND position_type = $2`,
        [serverId, positionType]
      );

      const currentData = currentDataResult.rows[0] || { x_pos: '', y_pos: '', z_pos: '' };

      // Create modal
      const modal = new ModalBuilder()
        .setCustomId(`position_modal_${serverId}_${positionType}`)
        .setTitle(`${positionType === 'outpost' ? 'Outpost' : 'BanditCamp'} Coordinates`);

      const xInput = new TextInputBuilder()
        .setCustomId('x_position')
        .setLabel('X Position')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter X coordinate')
        .setValue(currentData.x_pos || '')
        .setRequired(false);

      const yInput = new TextInputBuilder()
        .setCustomId('y_position')
        .setLabel('Y Position')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter Y coordinate')
        .setValue(currentData.y_pos || '')
        .setRequired(false);

      const zInput = new TextInputBuilder()
        .setCustomId('z_position')
        .setLabel('Z Position')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter Z coordinate')
        .setValue(currentData.z_pos || '')
        .setRequired(false);

      const firstActionRow = new ActionRowBuilder().addComponents(xInput);
      const secondActionRow = new ActionRowBuilder().addComponents(yInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(zInput);

      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

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