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

      // Delete from game
      try {
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zoneName}"`);
      } catch (rconError) {
        console.error('RCON error deleting zone:', rconError);
        // Continue with database deletion even if RCON fails
      }
      
      // Delete from database
      await pool.query('DELETE FROM zones WHERE id = $1', [zone.id]);

      const embed = successEmbed(`**Success:** Zone **${zoneName}** has been deleted.`);
      
      // Ensure all values are valid strings before adding to embed
      const owner = zone.owner || 'Unknown';
      const createdAt = zone.created_at ? Math.floor(new Date(zone.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
      
      embed.addFields({
        name: 'Zone Details',
        value: `**Owner:** ${owner}\n**Created:** <t:${createdAt}:R>`,
        inline: true
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error deleting zone:', error);
      await interaction.editReply({
        embeds: [errorEmbed('**Error:** Failed to execute this command. Please try again later.')]
      });
    }
  },
}; 