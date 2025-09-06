const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');
const { sendRconCommand, sendFeedEmbed } = require('../../rcon');
const zorpManager = require('../../systems/zorpManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-zorp')
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
        .setDescription('Delay in MINUTES before zone goes from yellow to red when offline (default: 5)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('expire')
        .setDescription('Expiration time in hours (default: 35 hours)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('min_team')
        .setDescription('Minimum team size (default: 1)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('max_team')
        .setDescription('Maximum team size (default: 8)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('zorp')
        .setDescription('Enable or disable ZORP system (default: true)')
        .setRequired(false)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const serverOption = interaction.options.getString('server');
      const size = interaction.options.getInteger('size');
      const colorOnline = interaction.options.getString('color_online');
      const colorOffline = interaction.options.getString('color_offline');
      const radiation = interaction.options.getInteger('radiation');
      const delay = interaction.options.getInteger('delay');
      const expire = interaction.options.getInteger('expire');
      const minTeam = interaction.options.getInteger('min_team');
      const maxTeam = interaction.options.getInteger('max_team');
      const zorpEnabled = interaction.options.getBoolean('zorp');

      // Validate serverOption
      if (!serverOption || typeof serverOption !== 'string' || serverOption.trim() === '') {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Please select a valid server.')]
        });
      }

      // Validate RGB color formats
      function validateRGBColor(colorString) {
        if (!colorString) return true; // Allow empty/null values
        const rgbPattern = /^(\d{1,3}),(\d{1,3}),(\d{1,3})$/;
        const match = colorString.match(rgbPattern);
        if (!match) return false;
        
        const [, r, g, b] = match;
        return parseInt(r) <= 255 && parseInt(g) <= 255 && parseInt(b) <= 255;
      }

      if (colorOnline && !validateRGBColor(colorOnline)) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Invalid online color format. Use R,G,B format (e.g., 0,255,0) with values 0-255.')]
        });
      }

      if (colorOffline && !validateRGBColor(colorOffline)) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Invalid offline color format. Use R,G,B format (e.g., 255,0,0) with values 0-255.')]
        });
      }

      // Get server details
      let serverResult;
      try {
        [serverResult] = await pool.query(`
          SELECT rs.*, g.discord_id
          FROM rust_servers rs
          JOIN guilds g ON rs.guild_id = g.id
          WHERE g.discord_id = ? AND rs.nickname = ?
        `, [interaction.guildId, serverOption]);
      } catch (dbError) {
        console.error('Database error fetching server:', dbError);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Failed to access database. Please try again later.')]
        });
      }

      if (!serverResult || serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Server not found or not accessible in this guild.')]
        });
      }

      const server = serverResult[0];
      const serverId = server.id;

      // Check if any parameters were provided
      const hasUpdates = size !== null || colorOnline !== null || colorOffline !== null || 
                        radiation !== null || delay !== null || expire !== null || 
                        minTeam !== null || maxTeam !== null || zorpEnabled !== null;

      if (!hasUpdates) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'No changes specified. Please provide at least one parameter to update.')]
        });
      }

      // Get all zones for this server
      let zonesResult;
      try {
        [zonesResult] = await pool.query(`
          SELECT * FROM zorp_zones WHERE server_id = ?
        `, [serverId]);
      } catch (dbError) {
        console.error('Database error fetching zones:', dbError);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Failed to fetch zones from database. Please try again later.')]
        });
      }

      const zones = zonesResult;
      const updatedFields = [];
      const rconErrors = [];

      // Update each zone in database and game
      for (const zone of zones) {
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (size !== null) {
          updates.push(`size = ?`);
          values.push(size);
          updatedFields.push('size');
        }
        if (colorOnline !== null) {
          updates.push(`color_online = ?`);
          values.push(colorOnline);
          updatedFields.push('color_online');
        }
        if (colorOffline !== null) {
          updates.push(`color_offline = ?`);
          values.push(colorOffline);
          updatedFields.push('color_offline');
        }
        if (radiation !== null) {
          updates.push(`radiation = ?`);
          values.push(radiation);
          updatedFields.push('radiation');
        }
        if (delay !== null) {
          updates.push(`delay = ?`);
          values.push(delay); // Store delay in minutes as entered by user
          updatedFields.push('delay');
        }
        if (expire !== null) {
          updates.push(`expire = ?`);
          values.push(expire * 3600); // Convert hours to seconds
          updatedFields.push('expire');
        }
        if (minTeam !== null) {
          updates.push(`min_team = ?`);
          values.push(minTeam);
          updatedFields.push('min_team');
        }
        if (maxTeam !== null) {
          updates.push(`max_team = ?`);
          values.push(maxTeam);
          updatedFields.push('max_team');
        }

        if (updates.length > 0) {
          // Update database
          values.push(zone.id);
          try {
            await pool.query(`
              UPDATE zorp_zones 
              SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
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

              // Update color based on current zone state using Zorp Manager
              if (colorOnline !== null || colorOffline !== null) {
                // Get current zone state from Zorp Manager
                const zones = zorpManager.getServerZones(serverId);
                const zoneData = zones.get(zone.name);
                
                if (zoneData) {
                  const currentState = zoneData.status;
                  const desiredState = zorpManager.desiredZoneState(currentState);
                  
                  // Apply zone state with custom colors
                  const customColors = {};
                  if (colorOnline !== null) customColors.color_online = colorOnline;
                  if (colorOffline !== null) customColors.color_offline = colorOffline;
                  
                  await zorpManager.applyZoneStateWithColors(server.ip, server.port, server.password, zone.name, desiredState, customColors);
                  console.log(`[EDIT-ZORP] Updated zone ${zone.name} color using Zorp Manager (state: ${currentState})`);
                } else {
                  // Fallback to direct RCON if zone not in memory
                  const [stateResult] = await pool.query(
                    'SELECT current_state, color_online, color_offline FROM zorp_zones WHERE name = ?',
                    [zone.name]
                  );
                  
                  if (stateResult.length > 0) {
                    const zoneState = stateResult[0];
                    let colorToApply;
                    
                    // Use the appropriate color based on current state
                    switch (zoneState.current_state) {
                      case 'active':
                        colorToApply = colorOnline || zoneState.color_online;
                        break;
                      case 'offline':
                        colorToApply = colorOffline || zoneState.color_offline;
                        break;
                      case 'pending':
                        colorToApply = '255,255,0';
                        break;
                      default:
                        colorToApply = colorOnline || zoneState.color_online;
                    }
                    
                    await sendRconCommand(server.ip, server.port, server.password, `zones.editcustomzone "${zone.name}" color (${colorToApply})`);
                    console.log(`[EDIT-ZORP] Updated zone ${zone.name} color to ${colorToApply} (state: ${zoneState.current_state})`);
                  }
                }
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
          defaultsUpdates.push(`size = ?`);
          defaultsValues.push(size);
        }
        if (colorOnline !== null) {
          defaultsUpdates.push(`color_online = ?`);
          defaultsValues.push(colorOnline);
        }
        if (colorOffline !== null) {
          defaultsUpdates.push(`color_offline = ?`);
          defaultsValues.push(colorOffline);
        }
        if (radiation !== null) {
          defaultsUpdates.push(`radiation = ?`);
          defaultsValues.push(radiation);
        }
        if (delay !== null) {
          defaultsUpdates.push(`delay = ?`);
          defaultsValues.push(delay); // Store delay in minutes as entered by user
        }
        if (expire !== null) {
          defaultsUpdates.push(`expire = ?`);
          defaultsValues.push(expire * 3600); // Convert hours to seconds
        }
        if (minTeam !== null) {
          defaultsUpdates.push(`min_team = ?`);
          defaultsValues.push(minTeam);
        }
        if (maxTeam !== null) {
          defaultsUpdates.push(`max_team = ?`);
          defaultsValues.push(maxTeam);
        }
        if (zorpEnabled !== null) {
          defaultsUpdates.push(`enabled = ?`);
          defaultsValues.push(zorpEnabled ? 1 : 0);
          
          // If disabling ZORPs, delete all existing zones
          if (!zorpEnabled) {
            console.log(`[ZORP] Disabling ZORPs for server ${server.nickname}, deleting all existing zones...`);
            
            // Delete all zones from database and game
            for (const zone of zones) {
              try {
                // Delete from game
                if (server.ip && server.port && server.password) {
                  await sendRconCommand(server.ip, server.port, server.password, `zones.deletecustomzone "${zone.name}"`);
                  console.log(`[ZORP] Deleted zone ${zone.name} from game`);
                }
                
                // Delete from database
                await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
                console.log(`[ZORP] Deleted zone ${zone.name} from database`);
                
              } catch (deleteError) {
                console.error(`Error deleting zone ${zone.name}:`, deleteError);
                rconErrors.push(`Failed to delete zone ${zone.name}`);
              }
            }
            
            // Send feed message about mass deletion
            try {
              await sendFeedEmbed(interaction.client, interaction.guildId, server.nickname, 'zorpfeed', `[ZORP] All ZORPs deleted - System disabled`);
            } catch (feedError) {
              console.error('Error sending feed message:', feedError);
            }
          }
        }

        if (defaultsUpdates.length > 0) {
          // Check if defaults exist for this server
          const [existingDefaults] = await pool.query(`
            SELECT id FROM zorp_defaults WHERE server_id = ?
          `, [serverId]);

          if (existingDefaults.length > 0) {
            // Update existing defaults
            defaultsValues.push(serverId);
            await pool.query(`
              UPDATE zorp_defaults 
              SET ${defaultsUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP
              WHERE server_id = ?
            `, defaultsValues);
          } else {
            // Create new defaults
            const insertColumns = ['server_id', ...defaultsUpdates.map(u => u.split(' = ')[0])];
            const insertValues = [serverId, ...defaultsValues];
            await pool.query(`
              INSERT INTO zorp_defaults (${insertColumns.join(', ')}, created_at, updated_at)
              VALUES (${insertValues.map(() => '?').join(', ')}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, insertValues);
          }
        }
      } catch (defaultsError) {
        console.error('Error updating server defaults:', defaultsError);
        // Continue even if defaults update fails
      }

      // Update Zorp Manager in-memory configuration
      if (updatedFields.length > 0) {
        const updates = {};
        if (size !== null) updates.size = size;
        if (colorOnline !== null) updates.color_online = colorOnline;
        if (colorOffline !== null) updates.color_offline = colorOffline;
        if (delay !== null) updates.delay = delay;
        if (expire !== null) updates.expire = expire * 3600; // Convert hours to seconds
        
        await zorpManager.updateZoneConfiguration(serverId, updates);
        console.log(`[EDIT-ZORP] Updated Zorp Manager configuration for server ${serverId}`);
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
      console.error('Unexpected error in edit-zorp command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An unexpected error occurred while updating zones.')]
      });
    }
  },
};
