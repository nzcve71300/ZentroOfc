const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');
const { sendRconCommand } = require('../../rcon');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-zone')
    .setDescription('Edit ZORP zone configuration for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server to update zones for')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('size')
        .setDescription('Zone size (default: 75)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('color_online')
        .setDescription('Online color (R,G,B format, default: 0,255,0)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('color_offline')
        .setDescription('Offline color (R,G,B format, default: 255,0,0)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('radiation')
        .setDescription('Radiation level (default: 0)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('delay')
        .setDescription('Delay in seconds (default: 0)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('expire')
        .setDescription('Expiration time in seconds (default: 115200)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('min_team')
        .setDescription('Minimum team size (default: 1)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('max_team')
        .setDescription('Maximum team size (default: 8)')
        .setRequired(false)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    
    try {
      // Get servers for this guild
      const serversResult = await pool.query(`
        SELECT rs.id, rs.nickname
        FROM rust_servers rs
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = $1
        ORDER BY rs.nickname
      `, [interaction.guildId]);

      const choices = serversResult.rows.map(server => ({
        name: server.nickname,
        value: server.id.toString()
      }));

      const filtered = choices.filter(choice => 
        choice.name.toLowerCase().includes(focusedValue.toLowerCase())
      );

      await interaction.respond(
        filtered.slice(0, 25)
      );
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const serverId = interaction.options.getString('server');
      const size = interaction.options.getInteger('size');
      const colorOnline = interaction.options.getString('color_online');
      const colorOffline = interaction.options.getString('color_offline');
      const radiation = interaction.options.getInteger('radiation');
      const delay = interaction.options.getInteger('delay');
      const expire = interaction.options.getInteger('expire');
      const minTeam = interaction.options.getInteger('min_team');
      const maxTeam = interaction.options.getInteger('max_team');

      // Validate serverId
      if (!serverId || isNaN(parseInt(serverId))) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Please select a valid server.')]
        });
      }

      // Get server details
      let serverResult;
      try {
        serverResult = await pool.query(`
          SELECT rs.*, g.discord_id
          FROM rust_servers rs
          JOIN guilds g ON rs.guild_id = g.id
          WHERE g.discord_id = $1 AND rs.id = $2
        `, [interaction.guildId, serverId]);
      } catch (dbError) {
        console.error('Database error fetching server:', dbError);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Failed to access database. Please try again later.')]
        });
      }

      if (!serverResult || serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Server not found or not accessible in this guild.')]
        });
      }

      const server = serverResult.rows[0];

      // Check if any parameters were provided
      const hasUpdates = size !== null || colorOnline !== null || colorOffline !== null || 
                        radiation !== null || delay !== null || expire !== null || 
                        minTeam !== null || maxTeam !== null;

      if (!hasUpdates) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'No changes specified. Please provide at least one parameter to update.')]
        });
      }

      // Get all zones for this server
      let zonesResult;
      try {
        zonesResult = await pool.query(`
          SELECT * FROM zones WHERE server_id = $1
        `, [serverId]);
      } catch (dbError) {
        console.error('Database error fetching zones:', dbError);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Failed to fetch zones from database. Please try again later.')]
        });
      }

      const zones = zonesResult.rows;
      const updatedFields = [];
      const rconErrors = [];

      // Update each zone in database and game
      for (const zone of zones) {
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (size !== null) {
          updates.push(`size = $${paramCount++}`);
          values.push(size);
          updatedFields.push('size');
        }
        if (colorOnline !== null) {
          updates.push(`color_online = $${paramCount++}`);
          values.push(colorOnline);
          updatedFields.push('color_online');
        }
        if (colorOffline !== null) {
          updates.push(`color_offline = $${paramCount++}`);
          values.push(colorOffline);
          updatedFields.push('color_offline');
        }
        if (radiation !== null) {
          updates.push(`radiation = $${paramCount++}`);
          values.push(radiation);
          updatedFields.push('radiation');
        }
        if (delay !== null) {
          updates.push(`delay = $${paramCount++}`);
          values.push(delay);
          updatedFields.push('delay');
        }
        if (expire !== null) {
          updates.push(`expire = $${paramCount++}`);
          values.push(expire);
          updatedFields.push('expire');
        }
        if (minTeam !== null) {
          updates.push(`min_team = $${paramCount++}`);
          values.push(minTeam);
          updatedFields.push('min_team');
        }
        if (maxTeam !== null) {
          updates.push(`max_team = $${paramCount++}`);
          values.push(maxTeam);
          updatedFields.push('max_team');
        }

        if (updates.length > 0) {
          // Update database
          values.push(zone.id);
          try {
            await pool.query(`
              UPDATE zones 
              SET ${updates.join(', ')}, updated_at = NOW()
              WHERE id = $${paramCount}
            `, values);
          } catch (dbUpdateError) {
            console.error('Database error updating zone:', dbUpdateError);
            rconErrors.push(`Failed to update zone ${zone.name} in database`);
            continue;
          }

          // Update in-game if needed
          try {
            if (server.ip && server.port && server.password) {
              // Update size by recreating zone
              if (size !== null && zone.position) {
                const position = zone.position;
                if (position.x !== undefined && position.y !== undefined && position.z !== undefined) {
                  const newZoneCommand = `zones.createcustomzone "${zone.name}" (${position.x},${position.y},${position.z}) 0 Sphere ${size} 0 0 0 0 0`;
                  await sendRconCommand(server.ip, server.port, server.password, newZoneCommand);
                }
              }

              // Update color
              if (colorOnline !== null) {
                const newColor = colorOnline;
                await sendRconCommand(server.ip, server.port, server.password, `zones.editcustomzone "${zone.name}" color (${newColor})`);
              }
            }
          } catch (rconError) {
            console.error('RCON error updating zone:', rconError);
            rconErrors.push(`Failed to update zone ${zone.name} in-game`);
          }
        }
      }

      // Update or create server defaults
      try {
        const defaultsUpdates = [];
        const defaultsValues = [];
        let paramCount = 1;

        if (size !== null) {
          defaultsUpdates.push(`size = $${paramCount++}`);
          defaultsValues.push(size);
        }
        if (colorOnline !== null) {
          defaultsUpdates.push(`color_online = $${paramCount++}`);
          defaultsValues.push(colorOnline);
        }
        if (colorOffline !== null) {
          defaultsUpdates.push(`color_offline = $${paramCount++}`);
          defaultsValues.push(colorOffline);
        }
        if (radiation !== null) {
          defaultsUpdates.push(`radiation = $${paramCount++}`);
          defaultsValues.push(radiation);
        }
        if (delay !== null) {
          defaultsUpdates.push(`delay = $${paramCount++}`);
          defaultsValues.push(delay);
        }
        if (expire !== null) {
          defaultsUpdates.push(`expire = $${paramCount++}`);
          defaultsValues.push(expire);
        }
        if (minTeam !== null) {
          defaultsUpdates.push(`min_team = $${paramCount++}`);
          defaultsValues.push(minTeam);
        }
        if (maxTeam !== null) {
          defaultsUpdates.push(`max_team = $${paramCount++}`);
          defaultsValues.push(maxTeam);
        }

        if (defaultsUpdates.length > 0) {
          // Check if defaults exist for this server
          const existingDefaults = await pool.query(`
            SELECT id FROM zorp_defaults WHERE server_id = $1
          `, [serverId]);

          if (existingDefaults.rows.length > 0) {
            // Update existing defaults
            defaultsValues.push(serverId);
            await pool.query(`
              UPDATE zorp_defaults 
              SET ${defaultsUpdates.join(', ')}, updated_at = NOW()
              WHERE server_id = $${paramCount}
            `, defaultsValues);
          } else {
            // Create new defaults
            defaultsValues.push(serverId);
            await pool.query(`
              INSERT INTO zorp_defaults (server_id, ${defaultsUpdates.map(u => u.split(' = ')[0]).join(', ')}, created_at, updated_at)
              VALUES ($${paramCount}, ${defaultsValues.slice(0, -1).map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())
            `, defaultsValues);
          }
        }
      } catch (defaultsError) {
        console.error('Error updating server defaults:', defaultsError);
        // Continue even if defaults update fails
      }

      // Create success embed
      const uniqueUpdatedFields = [...new Set(updatedFields)];
      const embed = successEmbed('Success', `Updated **${zones.length}** zones on server **${server.nickname}**.`);
      
      embed.addFields({
        name: 'Updated Fields',
        value: uniqueUpdatedFields.map(field => `• ${field}`).join('\n'),
        inline: true
      });

      embed.addFields({
        name: 'Server Defaults',
        value: 'These settings will now apply to new ZORP zones created on this server.',
        inline: false
      });

      if (rconErrors.length > 0) {
        embed.addFields({
          name: 'Warnings',
          value: rconErrors.slice(0, 5).join('\n') + (rconErrors.length > 5 ? '\n... and more' : ''),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Unexpected error in edit-zone command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An unexpected error occurred while updating zones.')]
      });
    }
  },
};
