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
          { name: 'BanditCamp', value: 'banditcamp' },
          { name: 'Crate-event-1', value: 'crate-event-1' },
          { name: 'Crate-event-2', value: 'crate-event-2' },
          { name: 'Crate-event-3', value: 'crate-event-3' },
          { name: 'Crate-event-4', value: 'crate-event-4' },
          { name: 'Prison-Cell-1', value: 'prison-cell-1' },
          { name: 'Prison-Cell-2', value: 'prison-cell-2' },
          { name: 'Prison-Cell-3', value: 'prison-cell-3' },
          { name: 'Prison-Cell-4', value: 'prison-cell-4' },
          { name: 'Prison-Cell-5', value: 'prison-cell-5' },
          { name: 'Prison-Cell-6', value: 'prison-cell-6' },
          { name: 'Prison Zone', value: 'prison-zone' }
        ))
    .addStringOption(option =>
      option.setName('coordinates')
        .setDescription('Enter coordinates (format: X,Y,Z)')
        .setRequired(true)),

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

    const serverId = interaction.options.getString('server');
    const positionType = interaction.options.getString('position');
    const coordinates = interaction.options.getString('coordinates');
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const [serverResult] = await pool.query(
        `SELECT rs.nickname, rs.ip, rs.port, rs.password
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.id = ? AND g.discord_id = ?`,
        [parseInt(serverId), guildId]
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
            server_id VARCHAR(32) NOT NULL,
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
            server_id VARCHAR(32) NOT NULL,
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
        // Parse coordinates - remove all spaces and split by comma
        const cleanCoordinates = coordinates.replace(/\s/g, ''); // Remove all spaces
        const coordParts = cleanCoordinates.split(',');
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

        // Handle prison cell positions differently
        if (positionType.startsWith('prison-cell-')) {
          const cellNumber = parseInt(positionType.replace('prison-cell-', ''));
          
          // Check if prison_positions table exists, create if not
          try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS prison_positions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                server_id VARCHAR(32) NOT NULL,
                cell_number INT NOT NULL,
                x_pos DECIMAL(10,2) NOT NULL,
                y_pos DECIMAL(10,2) NOT NULL,
                z_pos DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_server_cell (server_id, cell_number)
              )
            `);
          } catch (error) {
            console.error('Error creating prison_positions table:', error);
          }

          // Check if prison cell position exists
          const [existingPrisonResult] = await pool.query(
            'SELECT * FROM prison_positions WHERE server_id = ? AND cell_number = ?',
            [serverId, cellNumber]
          );

          if (existingPrisonResult.length > 0) {
            // Update existing prison cell coordinates
            await pool.query(
              'UPDATE prison_positions SET x_pos = ?, y_pos = ?, z_pos = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND cell_number = ?',
              [xNum, yNum, zNum, serverId, cellNumber]
            );
          } else {
            // Create new prison cell coordinates
            await pool.query(
              'INSERT INTO prison_positions (server_id, cell_number, x_pos, y_pos, z_pos, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
              [serverId, cellNumber, xNum, yNum, zNum]
            );
          }
        } else if (positionType === 'prison-zone') {
          // Handle prison zone position
          // Check if prison_configs table exists, create if not
          try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS prison_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                server_id VARCHAR(32) NOT NULL,
                enabled BOOLEAN DEFAULT FALSE,
                zone_size INT DEFAULT 50,
                zone_color VARCHAR(20) DEFAULT '255,0,0',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_server (server_id)
              )
            `);
          } catch (error) {
            console.error('Error creating prison_configs table:', error);
          }

          // Check if prison config exists
          const [existingPrisonConfigResult] = await pool.query(
            'SELECT * FROM prison_configs WHERE server_id = ?',
            [serverId]
          );

          if (existingPrisonConfigResult.length > 0) {
            // Update existing prison zone coordinates
            await pool.query(
              'UPDATE prison_configs SET zone_position = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ?',
              [`${xNum},${yNum},${zNum}`, serverId]
            );
          } else {
            // Create new prison config with zone coordinates
            await pool.query(
              'INSERT INTO prison_configs (server_id, zone_position, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
              [serverId, `${xNum},${yNum},${zNum}`]
            );
          }
        } else {
          // Handle regular position coordinates
          // Check if position coordinates exist
          const [existingResult] = await pool.query(
            'SELECT * FROM position_coordinates WHERE server_id = ? AND position_type = ?',
            [serverId, positionType]
          );

                     if (existingResult.length > 0) {
             // Update existing coordinates
             await pool.query(
               'UPDATE position_coordinates SET x_pos = ?, y_pos = ?, z_pos = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND position_type = ?',
               [xNum, yNum, zNum, serverId, positionType]
             );
           } else {
             // Create new coordinates
             await pool.query(
               'INSERT INTO position_coordinates (server_id, position_type, x_pos, y_pos, z_pos, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
               [serverId, positionType, xNum, yNum, zNum]
             );
           }
        }
      }





      // Get current coordinates for display
      let currentCoords = [];
      let positionDisplayName = positionType;

      if (positionType.startsWith('prison-cell-')) {
        const cellNumber = parseInt(positionType.replace('prison-cell-', ''));
        positionDisplayName = `Prison Cell ${cellNumber}`;
        
        const [prisonCoords] = await pool.query(
          'SELECT x_pos, y_pos, z_pos FROM prison_positions WHERE server_id = ? AND cell_number = ?',
          [serverId, cellNumber]
        );
        currentCoords = prisonCoords;
      } else if (positionType === 'prison-zone') {
        positionDisplayName = 'Prison Zone';
        
        const [prisonZoneCoords] = await pool.query(
          'SELECT zone_position FROM prison_configs WHERE server_id = ?',
          [serverId]
        );
        
        if (prisonZoneCoords.length > 0 && prisonZoneCoords[0].zone_position) {
          const [x, y, z] = prisonZoneCoords[0].zone_position.split(',').map(coord => parseFloat(coord.trim()));
          currentCoords = [{ x_pos: x, y_pos: y, z_pos: z }];
        }
      } else {
        const [regularCoords] = await pool.query(
          'SELECT x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = ? AND position_type = ?',
          [serverId, positionType]
        );
        currentCoords = regularCoords;
        
        positionDisplayName = positionType === 'outpost' ? 'Outpost' : 
                             positionType === 'banditcamp' ? 'Bandit Camp' :
                             positionType === 'crate-event-1' ? 'Crate Event 1' :
                             positionType === 'crate-event-2' ? 'Crate Event 2' :
                             positionType === 'crate-event-3' ? 'Crate Event 3' :
                             positionType === 'crate-event-4' ? 'Crate Event 4' : positionType;
      }
      
      const coords = currentCoords.length > 0 ? currentCoords[0] : null;

      // Show confirmation message
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle(`Position Coordinates Updated`)
        .setDescription(`**${positionDisplayName}** coordinates for **${serverName}**`)
        .addFields(
          { name: 'Coordinates', value: `X: ${coords.x_pos} | Y: ${coords.y_pos} | Z: ${coords.z_pos}`, inline: false }
        )
        .addFields(
          { name: 'Usage', value: 'Use `/set` command to configure settings for this position. For crate events, use Crate-1, Crate-2, Crate-3, or Crate-4 options.', inline: false }
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