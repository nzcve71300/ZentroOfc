const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-zones')
    .setDescription('List all active ZORP zones'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      // Get all zones for this guild
      const zonesResult = await pool.query(`
        SELECT z.*, rs.nickname
        FROM zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = $1
        ORDER BY z.created_at DESC
      `, [interaction.guildId]);

      if (zonesResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed('No active ZORP zones found in this guild.')]
        });
      }

      const embed = orangeEmbed(`**Active ZORP Zones** (${zonesResult.rows.length} total)`);
      
      // Group zones by server
      const zonesByServer = {};
      for (const zone of zonesResult.rows) {
        const serverName = zone.nickname || 'Unknown Server';
        if (!zonesByServer[serverName]) {
          zonesByServer[serverName] = [];
        }
        zonesByServer[serverName].push(zone);
      }

      for (const [serverName, zones] of Object.entries(zonesByServer)) {
        let serverZones = `**${serverName}** (${zones.length} zones):\n`;
        
        for (const zone of zones) {
          const createdTime = zone.created_at ? Math.floor(new Date(zone.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
          const expireTime = createdTime + (zone.expire || 115200);
          const teamSize = zone.team ? JSON.parse(zone.team).length : 1;
          const maxTeam = zone.max_team || 8;
          const owner = zone.owner || 'Unknown';
          const size = zone.size || 75;
          const colorOnline = zone.color_online || '0,255,0';
          const colorOffline = zone.color_offline || '255,0,0';
          
          serverZones += `• **${zone.name}** - Owner: ${owner} (Team: ${teamSize}/${maxTeam})\n`;
          serverZones += `  Created: <t:${createdTime}:R> | Expires: <t:${expireTime}:R>\n`;
          serverZones += `  Size: ${size} | Colors: ${colorOnline}/${colorOffline}\n\n`;
        }
        
        // Split if too long
        if (serverZones.length > 1024) {
          const parts = serverZones.match(/.{1,1024}/g) || [];
          for (let i = 0; i < parts.length; i++) {
            embed.addFields({
              name: i === 0 ? serverName : `${serverName} (continued)`,
              value: parts[i],
              inline: false
            });
          }
        } else {
          embed.addFields({
            name: serverName,
            value: serverZones,
            inline: false
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error listing zones:', error);
      await interaction.editReply({
        embeds: [errorEmbed('**Error:** Failed to execute this command. Please try again later.')]
      });
    }
  },
}; 