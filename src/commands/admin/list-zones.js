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
        WHERE g.discord_id = ?
        ORDER BY z.created_at DESC
      `, [interaction.guildId]);

      if (!zonesResult || zonesResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed('Active ZORP Zones', 'No active ZORP zones found in this guild.')]
        });
      }

      const embed = orangeEmbed(
        'Active ZORP Zones',
        `Total zones: **${zonesResult.rows.length}**`
      );

      // Group zones by server
      const zonesByServer = {};
      for (const zone of zonesResult.rows) {
        const serverName = zone.nickname || 'Unknown Server';
        if (!zonesByServer[serverName]) zonesByServer[serverName] = [];
        zonesByServer[serverName].push(zone);
      }

      for (const [serverName, zones] of Object.entries(zonesByServer)) {
        let serverZones = '';

        for (const zone of zones) {
          let teamSize = 1;
          try {
            teamSize = zone.team ? JSON.parse(zone.team).length : 1;
          } catch {
            teamSize = 1;
          }

          const createdTime = zone.created_at ? Math.floor(new Date(zone.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
          const expireTime = createdTime + (zone.expire || 115200);
          const owner = zone.owner || 'Unknown';
          const size = zone.size || 75;
          const maxTeam = zone.max_team || 8;
          const colorOnline = zone.color_online || '0,255,0';
          const colorOffline = zone.color_offline || '255,0,0';

          serverZones += `• **${zone.name}** — Owner: ${owner} (Team: ${teamSize}/${maxTeam})\n`;
          serverZones += `  Created: <t:${createdTime}:R> | Expires: <t:${expireTime}:R>\n`;
          serverZones += `  Size: ${size} | Colors: Online(${colorOnline}) / Offline(${colorOffline})\n\n`;
        }

        // Split into multiple fields if too long
        const parts = serverZones.match(/[\s\S]{1,1024}/g) || [];
        parts.forEach((part, i) => {
          embed.addFields({
            name: i === 0 ? serverName : `${serverName} (continued)`,
            value: part,
            inline: false
          });
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error listing zones:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to fetch ZORP zones. Please try again later.')]
      });
    }
  },
};
