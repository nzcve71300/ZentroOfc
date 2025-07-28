const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');
const { sendRconCommand } = require('../../rcon');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-zone')
    .setDescription('Edit a ZORP zone configuration')
    .addStringOption(option =>
      option.setName('zone_name')
        .setDescription('Name of the zone to edit')
        .setRequired(true))
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

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const zoneName = interaction.options.getString('zone_name');
      const size = interaction.options.getInteger('size');
      const colorOnline = interaction.options.getString('color_online');
      const colorOffline = interaction.options.getString('color_offline');
      const radiation = interaction.options.getInteger('radiation');
      const delay = interaction.options.getInteger('delay');
      const expire = interaction.options.getInteger('expire');
      const minTeam = interaction.options.getInteger('min_team');
      const maxTeam = interaction.options.getInteger('max_team');

      // Validate zoneName is provided
      if (!zoneName || zoneName.trim() === '') {
        return interaction.editReply({
          embeds: [errorEmbed('**Error:** Zone name is required.')]
        });
      }

      // Get zone from database
      const zoneResult = await pool.query(`
        SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
        FROM zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = $1 AND z.name = $2
      `, [interaction.guildId, zoneName]);

      if (zoneResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed(`**Error:** Zone "${zoneName}" not found or missing.`)]
        });
      }

      const zone = zoneResult.rows[0];

      // Build update query
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (size !== null) {
        updates.push(`size = $${paramCount++}`);
        values.push(size);
      }
      if (colorOnline !== null) {
        updates.push(`color_online = $${paramCount++}`);
        values.push(colorOnline);
      }
      if (colorOffline !== null) {
        updates.push(`color_offline = $${paramCount++}`);
        values.push(colorOffline);
      }
      if (radiation !== null) {
        updates.push(`radiation = $${paramCount++}`);
        values.push(radiation);
      }
      if (delay !== null) {
        updates.push(`delay = $${paramCount++}`);
        values.push(delay);
      }
      if (expire !== null) {
        updates.push(`expire = $${paramCount++}`);
        values.push(expire);
      }
      if (minTeam !== null) {
        updates.push(`min_team = $${paramCount++}`);
        values.push(minTeam);
      }
      if (maxTeam !== null) {
        updates.push(`max_team = $${paramCount++}`);
        values.push(maxTeam);
      }

      if (updates.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('**Error:** No changes specified.')]
        });
      }

      // Update database
      values.push(zone.id);
      await pool.query(`
        UPDATE zones 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
      `, values);

      // Update zone in-game if size changed
      if (size !== null) {
        try {
          const position = zone.position;
          if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
            const newZoneCommand = `zones.createcustomzone "${zoneName}" (${position.x},${position.y},${position.z}) 0 Sphere ${size} 0 0 0 0 0`;
            await sendRconCommand(zone.ip, zone.port, zone.password, newZoneCommand);
          }
        } catch (rconError) {
          console.error('RCON error updating zone size:', rconError);
          // Continue with the response even if RCON fails
        }
      }

      // Update color if changed
      if (colorOnline !== null || colorOffline !== null) {
        try {
          const newColor = colorOnline || zone.color_online || '0,255,0';
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zoneName}" color (${newColor})`);
        } catch (rconError) {
          console.error('RCON error updating zone color:', rconError);
          // Continue with the response even if RCON fails
        }
      }

      const embed = successEmbed(`**Success:** Zone **${zoneName}** has been updated.`);
      
      if (updates.length > 0) {
        embed.addFields({
          name: 'Updated Fields',
          value: updates.map(update => `• ${update.split(' = ')[0]}`).join('\n'),
          inline: true
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error editing zone:', error);
      await interaction.editReply({
        embeds: [errorEmbed('**Error:** Failed to execute this command. Please try again later.')]
      });
    }
  },
}; 