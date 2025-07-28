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
      option.setName('size').setDescription('Zone size (default: 75)'))
    .addStringOption(option =>
      option.setName('color_online').setDescription('Online color (R,G,B)'))
    .addStringOption(option =>
      option.setName('color_offline').setDescription('Offline color (R,G,B)'))
    .addIntegerOption(option =>
      option.setName('radiation').setDescription('Radiation level (default: 0)'))
    .addIntegerOption(option =>
      option.setName('delay').setDescription('Delay in seconds (default: 0)'))
    .addIntegerOption(option =>
      option.setName('expire').setDescription('Expiration time in seconds (default: 115200)'))
    .addIntegerOption(option =>
      option.setName('min_team').setDescription('Minimum team size (default: 1)'))
    .addIntegerOption(option =>
      option.setName('max_team').setDescription('Maximum team size (default: 8)')),

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

      // Validate zone name
      if (!zoneName || typeof zoneName !== 'string' || zoneName.trim() === '') {
        return interaction.editReply({ embeds: [errorEmbed('Error', 'Zone name is required.')] });
      }

      // Fetch zone
      const zoneResult = await pool.query(`
        SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
        FROM zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = $1 AND z.name = $2
      `, [interaction.guildId, zoneName]);

      if (zoneResult.rows.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Error', `Zone "${zoneName}" not found.`)] });
      }

      const zone = zoneResult.rows[0];

      // Prepare DB updates
      const updates = [];
      const values = [];
      let paramCount = 1;

      const addUpdate = (field, value) => {
        if (value !== null && value !== undefined) {
          updates.push(`${field} = $${paramCount++}`);
          values.push(value);
        }
      };

      addUpdate('size', size);
      addUpdate('color_online', colorOnline);
      addUpdate('color_offline', colorOffline);
      addUpdate('radiation', radiation);
      addUpdate('delay', delay);
      addUpdate('expire', expire);
      addUpdate('min_team', minTeam);
      addUpdate('max_team', maxTeam);

      if (updates.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Error', 'No changes were specified.')] });
      }

      // Apply DB updates
      values.push(zone.id);
      await pool.query(`
        UPDATE zones
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
      `, values);

      // Update in-game size if changed
      if (size !== null) {
        try {
          const position = zone.position;
          if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
            const newZoneCommand = `zones.createcustomzone "${zoneName}" (${position.x},${position.y},${position.z}) 0 Sphere ${size} 0 0 0 0 0`;
            await sendRconCommand(zone.ip, zone.port, zone.password, newZoneCommand);
          }
        } catch (err) {
          console.error('RCON error updating zone size:', err);
        }
      }

      // Update in-game color if changed
      if (colorOnline !== null) {
        try {
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zoneName}" color (${colorOnline})`);
        } catch (err) {
          console.error('RCON error updating zone color:', err);
        }
      }

      const embed = successEmbed('Success', `Zone **${zoneName}** has been updated.`);
      embed.addFields({
        name: 'Updated Fields',
        value: updates.map(u => `• ${u.split(' = ')[0]}`).join('\n'),
        inline: true
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error editing zone:', error);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'An unexpected error occurred while editing the zone.')] });
    }
  },
};
