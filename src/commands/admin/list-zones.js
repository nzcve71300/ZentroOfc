const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-zones')
    .setDescription('List all active ZORP zones')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to list zones for')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    
    try {
      // Get all servers for this guild
      const [servers] = await pool.query(`
        SELECT rs.nickname 
        FROM rust_servers rs
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = ?
        ORDER BY rs.nickname
      `, [interaction.guildId]);

      const filtered = servers
        .filter(server => server.nickname.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25)
        .map(server => ({
          name: server.nickname,
          value: server.nickname
        }));

      await interaction.respond(filtered);
    } catch (error) {
      console.error('Error in list-zones autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const serverName = interaction.options.getString('server');
      
      // Get zones for the specific server
      const [zonesResult] = await pool.query(`
        SELECT z.*, rs.nickname
        FROM zorp_zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = ? AND rs.nickname = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
        ORDER BY z.created_at DESC
      `, [interaction.guildId, serverName]);

      if (!zonesResult || zonesResult.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed('Active ZORP Zones', `No active ZORP zones found on **${serverName}**.`)]
        });
      }

      const embed = orangeEmbed(
        `Active ZORP Zones - ${serverName}`,
        `Total zones: **${zonesResult.length}**`
      );

      // Format zones for display
      let serverZones = '';

      for (const zone of zonesResult) {
        let teamSize = 1;
        try {
          teamSize = zone.team ? JSON.parse(zone.team).length : 1;
        } catch {
          teamSize = 1;
        }

        const createdTime = zone.created_at ? Math.floor(new Date(zone.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
        const expireTime = createdTime + (zone.expire || 126000); // Default to 35 hours (126000 seconds) if not set
        
        // Calculate time remaining in a more user-friendly format
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = expireTime - now;
        let timeDisplay = '';
        
        if (timeRemaining > 0) {
          const hours = Math.floor(timeRemaining / 3600);
          const minutes = Math.floor((timeRemaining % 3600) / 60);
          if (hours > 0) {
            timeDisplay = `${hours}h ${minutes}m remaining`;
          } else {
            timeDisplay = `${minutes}m remaining`;
          }
        } else {
          timeDisplay = 'Expired';
        }
        const owner = zone.owner || 'Unknown';
        const size = zone.size || 75;
        const maxTeam = zone.max_team || 8;
        const colorOnline = zone.color_online || '0,255,0';
        const colorOffline = zone.color_offline || '255,0,0';

        serverZones += `• **${zone.name}** — Owner: ${owner} (Team: ${teamSize}/${maxTeam})\n`;
        serverZones += `  Created: <t:${createdTime}:R> | ${timeDisplay}\n`;
        serverZones += `  Size: ${size} | Colors: Online(${colorOnline}) / Offline(${colorOffline})\n\n`;
      }

      // Split into larger chunks to reduce field count (Discord limit is 25 fields)
      const maxChunkSize = 2000; // Larger chunks to reduce field count
      const parts = serverZones.match(new RegExp(`[\\s\\S]{1,${maxChunkSize}}`, 'g')) || [];
      
      // Limit to 20 fields to be safe (leaving room for other potential fields)
      const maxFields = Math.min(parts.length, 20);
      
      for (let i = 0; i < maxFields; i++) {
        embed.addFields({
          name: i === 0 ? 'Zones' : `Zones (continued ${i})`,
          value: parts[i],
          inline: false
        });
      }
      
      // If we had to truncate, add a note
      if (parts.length > 20) {
        embed.addFields({
          name: 'Note',
          value: `Showing first ${maxFields * Math.floor(maxChunkSize / 100)} zones. Total zones: ${zonesResult.length}`,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error listing zones:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        guildId: interaction.guildId,
        serverName: interaction.options.getString('server')
      });
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to fetch ZORP zones. Please try again later.')]
      });
    }
  },
};
