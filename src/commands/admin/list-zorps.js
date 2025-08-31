const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-zorps')
    .setDescription('List all active ZORP zones in this server'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      // Get all active Zorps in this guild
      const [zorpResult] = await pool.query(`
        SELECT z.name, z.owner, z.created_at, z.expire, rs.nickname
        FROM zorp_zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        JOIN guilds g ON rs.guild_id = g.id
        WHERE g.discord_id = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
        ORDER BY z.created_at DESC
      `, [interaction.guildId]);

      if (!zorpResult || zorpResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Active Zorps', 'There are no active Zorp zones in this server.')]
        });
      }

      // Calculate remaining time for each Zorp
      const now = new Date();
      const zorpList = zorpResult.map(zorp => {
        const createdAt = new Date(zorp.created_at);
        const expireTime = new Date(createdAt.getTime() + (zorp.expire * 1000));
        const remainingMs = expireTime.getTime() - now.getTime();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        
        const timeString = remainingHours > 0 
          ? `${remainingHours}h ${remainingMinutes}m`
          : `${remainingMinutes}m`;
        
        return `• **${zorp.owner}** (${zorp.nickname}) - Expires in ${timeString}`;
      });

      const embed = successEmbed('Active Zorp Zones', `Found **${zorpResult.length}** active Zorp zone(s) in this server:`);
      embed.addFields({
        name: 'Zorp List',
        value: zorpList.join('\n'),
        inline: false
      });

      // Add usage hint
      embed.addFields({
        name: 'Usage',
        value: 'Use `/delete-zorp player_name:PlayerName` to delete a specific Zorp.',
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Unexpected error in list-zorps command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An unexpected error occurred while fetching Zorp zones.')]
      });
    }
  },
};
