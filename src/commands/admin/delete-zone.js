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
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const zoneName = interaction.options.getString('zone_name');

      // Validate zoneName is provided and not empty
      if (!zoneName || zoneName.trim() === '') {
        return interaction.editReply({
          embeds: [errorEmbed('**Error:** Zone name is required.')]
        });
      }

      // Validate zoneName length and format
      if (zoneName.length > 50) {
        return interaction.editReply({
          embeds: [errorEmbed('**Error:** Zone name is too long. Maximum 50 characters allowed.')]
        });
      }

      // Get zone from database with proper error handling
      let zoneResult;
      try {
        zoneResult = await pool.query(`
          SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
          FROM zones z
          JOIN rust_servers rs ON z.server_id = rs.id
          JOIN guilds g ON rs.guild_id = g.id
          WHERE g.discord_id = $1 AND z.name = $2
        `, [interaction.guildId, zoneName]);
      } catch (dbError) {
        console.error('Database error fetching zone:', dbError);
        return interaction.editReply({
          embeds: [errorEmbed('**Error:** Failed to access database. Please try again later.')]
        });
      }

      // Validate that zone exists
      if (!zoneResult || zoneResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed(`**Error:** Zone "${zoneName}" not found or missing.`)]
        });
      }

      const zone = zoneResult.rows[0];

      // Validate zone data integrity
      if (!zone.id || !zone.name) {
        return interaction.editReply({
          embeds: [errorEmbed('**Error:** Invalid zone data. Please try again later.')]
        });
      }

      // Delete from game with proper error handling
      let rconSuccess = false;
      try {
        if (zone.ip && zone.port && zone.password) {
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zoneName}"`);
          rconSuccess = true;
        } else {
          console.warn('Missing RCON credentials for zone deletion:', zoneName);
        }
      } catch (rconError) {
        console.error('RCON error deleting zone:', rconError);
        // Continue with database deletion even if RCON fails
      }
      
      // Delete from database with proper error handling
      try {
        await pool.query('DELETE FROM zones WHERE id = $1', [zone.id]);
      } catch (dbDeleteError) {
        console.error('Database error deleting zone:', dbDeleteError);
        return interaction.editReply({
          embeds: [errorEmbed('**Error:** Failed to delete zone from database. Please try again later.')]
        });
      }

      // Create success embed
      const embed = successEmbed(`**Success:** Zone **${zoneName}** has been deleted.`);
      
      // Ensure all values are valid strings before adding to embed
      const owner = zone.owner || 'Unknown';
      const createdAt = zone.created_at ? Math.floor(new Date(zone.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
      const serverName = zone.nickname || 'Unknown Server';
      
      embed.addFields({
        name: 'Zone Details',
        value: `**Owner:** ${owner}\n**Server:** ${serverName}\n**Created:** <t:${createdAt}:R>`,
        inline: true
      });

      if (!rconSuccess) {
        embed.addFields({
          name: 'Note',
          value: 'Zone was deleted from database but RCON command failed. Zone may still exist in-game.',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Unexpected error in delete-zone command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('**Error:** Failed to execute this command. Please try again later.')]
      });
    }
  },
}; 