const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');

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
      option.setName('position')
        .setDescription('Select position type')
        .setRequired(true)
        .addChoices(
          { name: 'Outpost', value: 'outpost' },
          { name: 'BanditCamp', value: 'banditcamp' }
        ))
    .addStringOption(option =>
      option.setName('coordinates')
        .setDescription('Enter coordinates (format: X,Y,Z)')
        .setRequired(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname LIKE ? 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
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
    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, true);
    }

    const serverId = parseInt(interaction.options.getString('server'));
    const positionType = interaction.options.getString('position');
    const coordinates = interaction.options.getString('coordinates');
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const serverResult = await pool.query(
        `SELECT rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.id = ? AND g.discord_id = ?`,
        [serverId, guildId]
      );

      if (serverResult.rows.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')],
          ephemeral: true
        });
      }

      const serverName = serverResult.rows[0].nickname;

      // Parse coordinates
      const coordParts = coordinates.split(',').map(coord => coord.trim());
      if (coordParts.length !== 3) {
        return interaction.reply({
          embeds: [errorEmbed('Invalid Coordinates', 'Coordinates must be in format: X,Y,Z (e.g., 100.5,200.3,300.7)')],
          ephemeral: true
        });
      }

      const [xPos, yPos, zPos] = coordParts;

      // Validate coordinates are valid numbers (including decimals)
      const xNum = parseFloat(xPos);
      const yNum = parseFloat(yPos);
      const zNum = parseFloat(zPos);

      if (isNaN(xNum) || isNaN(yNum) || isNaN(zNum)) {
        return interaction.reply({
          embeds: [errorEmbed('Invalid Coordinates', 'All coordinates must be valid numbers (can include decimals).')],
          ephemeral: true
        });
      }

      // Check if position coordinates exist
      const existingResult = await pool.query(
        'SELECT * FROM position_coordinates WHERE server_id = ? AND position_type = ?',
        [serverId, positionType]
      );

      if (existingResult.rows.length > 0) {
        // Update existing coordinates
        await pool.query(
          'UPDATE position_coordinates SET x_pos = ?, y_pos = ?, z_pos = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND position_type = ?',
          [xPos, yPos, zPos, serverId, positionType]
        );
      } else {
        // Create new coordinates
        await pool.query(
          'INSERT INTO position_coordinates (server_id, position_type, x_pos, y_pos, z_pos, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [serverId, positionType, xPos, yPos, zPos]
        );
      }

      const positionDisplayName = positionType === 'outpost' ? 'Outpost' : 'BanditCamp';

      // Show confirmation message
      await interaction.reply({
        embeds: [successEmbed(
          'Coordinates Updated',
          `**${positionDisplayName}** coordinates have been set for **${serverName}**!\n\n**Coordinates:** X: ${xPos} | Y: ${yPos} | Z: ${zPos}\n\nCoordinates are now saved and will be used when players teleport to this position.`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in manage-positions command:', error);
      await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to save coordinates. Please try again.')],
        ephemeral: true
      });
    }
  }
}; 