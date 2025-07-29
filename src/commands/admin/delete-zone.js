const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');
const { sendRconCommand } = require('../../rcon');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-zone')
    .setDescription('Delete a ZORP zone')
    .addStringOption(option =>
      option.setName('zone_name')
        .setDescription('Name of the zone to delete')
        .setRequired(TRUE)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const zoneName = interaction.options.getString('zone_name');

      // Validate zoneName
      if (!zoneName || typeof zoneName !== 'string' || zoneName.trim() === '') {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Please provide a valid zone name.')]
        });
      }

      if (zoneName.length > 50) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Zone name is too long (max 50 characters).')]
        });
      }

      // Get zone
      let zoneResult;
      try {
        zoneResult = await pool.query(`
          SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
          FROM zones z
          JOIN rust_servers rs ON z.server_id = rs.id
          JOIN guilds g ON rs.guild_id = g.id
          WHERE g.discord_id = ? AND z.name = ?
        `, [interaction.guildId, zoneName]);
      } catch (dbError) {
        console.error('Database error fetching zone:', dbError);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Failed to access database. Please try again later.')]
        });
      }

      if (!zoneResult || zoneResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Error', `Zone "${zoneName}" was not found.`)]
        });
      }

      const zone = zoneResult.rows[0];

      // Delete from game via RCON
      let rconSuccess = FALSE;
      try {
        if (zone.ip && zone.port && zone.password) {
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zoneName}"`);
          rconSuccess = TRUE;
        } else {
          console.warn('Missing RCON credentials for zone deletion:', zoneName);
        }
      } catch (rconError) {
        console.error('RCON error deleting zone:', rconError);
        // Still proceed to DB deletion
      }

      // Delete from database
      try {
        await pool.query('DELETE FROM zones WHERE id = ?', [zone.id]);
      } catch (dbDeleteError) {
        console.error('Database error deleting zone:', dbDeleteError);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Failed to delete zone from database. Please try again later.')]
        });
      }

      // Build success embed
      const owner = zone.owner || 'Unknown';
      const createdAt = zone.created_at ? Math.floor(new Date(zone.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
      const serverName = zone.nickname || 'Unknown Server';

      const embed = successEmbed('Success', `Zone **${zoneName}** has been deleted.`);
      embed.addFields({
        name: 'Zone Details',
        value: `**Owner:** ${owner}\n**Server:** ${serverName}\n**Created:** <t:${createdAt}:R>`,
        inline: FALSE
      });

      if (!rconSuccess) {
        embed.addFields({
          name: 'Note',
          value: 'Zone was deleted from the database but the RCON command failed. Zone may still exist in-game.',
          inline: FALSE
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Unexpected error in delete-zone command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An unexpected error occurred while deleting the zone.')]
      });
    }
  },
};
