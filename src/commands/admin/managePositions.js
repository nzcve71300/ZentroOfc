const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { sendRconCommand } = require('../../rcon');

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
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('enabled')
        .setDescription('Enable/disable position teleport')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('delay')
        .setDescription('Teleport delay in seconds (0 for instant)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('cooldown')
        .setDescription('Cooldown in minutes')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('test_player')
        .setDescription('Test teleport for a player (optional)')
        .setRequired(false)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
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

    await interaction.deferReply({ ephemeral: true });

    const serverId = parseInt(interaction.options.getString('server'));
    const positionType = interaction.options.getString('position');
    const coordinates = interaction.options.getString('coordinates');
    const enabled = interaction.options.getBoolean('enabled');
    const delay = interaction.options.getInteger('delay');
    const cooldown = interaction.options.getInteger('cooldown');
    const testPlayer = interaction.options.getString('test_player');
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const [serverResult] = await pool.query(
        `SELECT rs.nickname, rs.ip, rs.port, rs.password
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.id = ? AND g.discord_id = ?`,
        [serverId, guildId]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const server = serverResult[0];
      const serverName = server.nickname;

      // Check if position configs table exists, create if not
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS position_configs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            server_id INT NOT NULL,
            position_type VARCHAR(50) NOT NULL,
            enabled BOOLEAN DEFAULT TRUE,
            delay_seconds INT DEFAULT 0,
            cooldown_minutes INT DEFAULT 5,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_server_position (server_id, position_type)
          )
        `);
      } catch (error) {
        console.error('Error creating position_configs table:', error);
      }

      // Check if position coordinates table exists, create if not
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS position_coordinates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            server_id INT NOT NULL,
            position_type VARCHAR(50) NOT NULL,
            x_pos DECIMAL(10,2) NOT NULL,
            y_pos DECIMAL(10,2) NOT NULL,
            z_pos DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_server_position (server_id, position_type)
          )
        `);
      } catch (error) {
        console.error('Error creating position_coordinates table:', error);
      }

      // Handle coordinates update
      if (coordinates) {
        // Parse coordinates
        const coordParts = coordinates.split(',').map(coord => coord.trim());
        if (coordParts.length !== 3) {
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Coordinates', 'Coordinates must be in format: X,Y,Z (e.g., 100.5,200.3,300.7)')]
          });
        }

        const [xPos, yPos, zPos] = coordParts;

        // Validate coordinates are valid numbers (including decimals)
        const xNum = parseFloat(xPos);
        const yNum = parseFloat(yPos);
        const zNum = parseFloat(zPos);

        if (isNaN(xNum) || isNaN(yNum) || isNaN(zNum)) {
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Coordinates', 'All coordinates must be valid numbers (can include decimals).')]
          });
        }

        // Check if position coordinates exist
        const [existingResult] = await pool.query(
          'SELECT * FROM position_coordinates WHERE server_id = ? AND position_type = ?',
          [serverId, positionType]
        );

        if (existingResult.length > 0) {
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
      }

      // Handle config updates
      if (enabled !== null || delay !== null || cooldown !== null) {
        // Check if position config exists
        const [configResult] = await pool.query(
          'SELECT * FROM position_configs WHERE server_id = ? AND position_type = ?',
          [serverId, positionType]
        );

        if (configResult.length > 0) {
          // Update existing config
          const updates = [];
          const values = [];
          
          if (enabled !== null) {
            updates.push('enabled = ?');
            values.push(enabled);
          }
          if (delay !== null) {
            updates.push('delay_seconds = ?');
            values.push(delay);
          }
          if (cooldown !== null) {
            updates.push('cooldown_minutes = ?');
            values.push(cooldown);
          }
          
          if (updates.length > 0) {
            values.push(serverId, positionType);
            await pool.query(
              `UPDATE position_configs SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND position_type = ?`,
              values
            );
          }
        } else {
          // Create new config
          await pool.query(
            'INSERT INTO position_configs (server_id, position_type, enabled, delay_seconds, cooldown_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [serverId, positionType, enabled !== null ? enabled : true, delay !== null ? delay : 0, cooldown !== null ? cooldown : 5]
          );
        }
      }

      // Handle test teleport
      if (testPlayer && server.ip && server.port && server.password) {
        try {
          // Get coordinates
          const [coordResult] = await pool.query(
            'SELECT x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = ? AND position_type = ?',
            [serverId, positionType]
          );

          if (coordResult.length === 0) {
            return interaction.editReply({
              embeds: [errorEmbed('No Coordinates', 'No coordinates set for this position. Please set coordinates first.')]
            });
          }

          const coords = coordResult[0];
          const positionDisplayName = positionType === 'outpost' ? 'Outpost' : 'Bandit Camp';

          // Execute teleport
          const teleportCommand = `global.teleportposrot "${coords.x_pos},${coords.y_pos},${coords.z_pos}" "${testPlayer}" "1"`;
          await sendRconCommand(server.ip, server.port, server.password, teleportCommand);
          
          // Send success message
          await sendRconCommand(server.ip, server.port, server.password, `say <color=#FF69B4>${testPlayer}</color> <color=white>teleported to</color> <color=#800080>${positionDisplayName}</color> <color=white>successfully</color>`);
          
          return interaction.editReply({
            embeds: [successEmbed(
              'Test Teleport Successful',
              `**${testPlayer}** has been teleported to **${positionDisplayName}** on **${serverName}**!\n\n**Coordinates:** X: ${coords.x_pos} | Y: ${coords.y_pos} | Z: ${coords.z_pos}`
            )]
          });

        } catch (error) {
          console.error('Error during test teleport:', error);
          return interaction.editReply({
            embeds: [errorEmbed('Teleport Error', 'Failed to execute test teleport. Please check server connection and try again.')]
          });
        }
      }

      // Get current config for display
      const [currentConfig] = await pool.query(
        'SELECT enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ? AND position_type = ?',
        [serverId, positionType]
      );

      const [currentCoords] = await pool.query(
        'SELECT x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = ? AND position_type = ?',
        [serverId, positionType]
      );

      const positionDisplayName = positionType === 'outpost' ? 'Outpost' : 'Bandit Camp';
      const config = currentConfig.length > 0 ? currentConfig[0] : { enabled: true, delay_seconds: 0, cooldown_minutes: 5 };
      const coords = currentCoords.length > 0 ? currentCoords[0] : null;

      // Show confirmation message
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle(`Position Settings Updated`)
        .setDescription(`**${positionDisplayName}** configuration for **${serverName}**`)
        .addFields(
          { name: 'Status', value: config.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
          { name: 'Delay', value: `${config.delay_seconds} seconds`, inline: true },
          { name: 'Cooldown', value: `${config.cooldown_minutes} minutes`, inline: true }
        );

      if (coords) {
        embed.addFields(
          { name: 'Coordinates', value: `X: ${coords.x_pos} | Y: ${coords.y_pos} | Z: ${coords.z_pos}`, inline: false }
        );
      } else {
        embed.addFields(
          { name: 'Coordinates', value: '❌ Not set', inline: false }
        );
      }

      embed.addFields(
        { name: 'Usage', value: 'Players can use emotes to teleport to this position when enabled.', inline: false }
      );

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in manage-positions command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to update position settings. Please try again.')]
      });
    }
  }
}; 