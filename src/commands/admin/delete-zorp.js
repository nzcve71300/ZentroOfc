const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');
const { sendRconCommand } = require('../../rcon');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-zorp')
    .setDescription('Delete a ZORP zone by player name')
    .addStringOption(option =>
      option.setName('player_name')
        .setDescription('Name of the player whose Zorp to delete')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const playerName = interaction.options.getString('player_name');
      
      // Debug logging
      console.log(`[DELETE-ZORP] Received player name: "${playerName}"`);
      console.log(`[DELETE-ZORP] Type: ${typeof playerName}`);
      console.log(`[DELETE-ZORP] Length: ${playerName ? playerName.length : 'null'}`);
      console.log(`[DELETE-ZORP] Trimmed: "${playerName ? playerName.trim() : 'null'}"`);

      // Validate playerName
      if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
        console.log(`[DELETE-ZORP] Validation failed: playerName is invalid`);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Please provide a valid player name.')]
        });
      }

      // Trim the player name
      const trimmedPlayerName = playerName.trim();
      
      if (trimmedPlayerName.length > 32) {
        console.log(`[DELETE-ZORP] Validation failed: player name too long (${trimmedPlayerName.length} chars)`);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Player name is too long (max 32 characters).')]
        });
      }
      
      console.log(`[DELETE-ZORP] Using trimmed player name: "${trimmedPlayerName}"`);

      // Get zone by player name
      let zoneResult;
      try {
        console.log(`[DELETE-ZORP] Searching for zone with guild_id: ${interaction.guildId}, owner: "${trimmedPlayerName}"`);
        
        [zoneResult] = await pool.query(`
          SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
          FROM zorp_zones z
          JOIN rust_servers rs ON z.server_id = rs.id
          JOIN guilds g ON rs.guild_id = g.id
          WHERE g.discord_id = ? AND LOWER(z.owner) = LOWER(?)
        `, [interaction.guildId, trimmedPlayerName]);
        
        console.log(`[DELETE-ZORP] Database query returned ${zoneResult.length} results`);
        if (zoneResult.length > 0) {
          console.log(`[DELETE-ZORP] Found zone: ${zoneResult[0].name} owned by ${zoneResult[0].owner}`);
        }
      } catch (dbError) {
        console.error('Database error fetching zone:', dbError);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Failed to access database. Please try again later.')]
        });
      }

      if (!zoneResult || zoneResult.length === 0) {
        console.log(`[DELETE-ZORP] No zone found for player: "${trimmedPlayerName}" in guild: ${interaction.guildId}`);
        
        // Get all active Zorps in this guild to show what's available
        const [availableZorps] = await pool.query(`
          SELECT z.owner, rs.nickname
          FROM zorp_zones z
          JOIN rust_servers rs ON z.server_id = rs.id
          JOIN guilds g ON rs.guild_id = g.id
          WHERE g.discord_id = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
          ORDER BY z.owner
        `, [interaction.guildId]);
        
        let errorMessage = `No Zorp found for player "${trimmedPlayerName}".`;
        
        if (availableZorps.length > 0) {
          const zorpList = availableZorps.map(z => `• ${z.owner} (${z.nickname})`).join('\n');
          errorMessage += `\n\n**Available Zorps in this server:**\n${zorpList}`;
        } else {
          errorMessage += '\n\n**No active Zorps found in this server.**';
        }
        
        return interaction.editReply({
          embeds: [errorEmbed('Error', errorMessage)]
        });
      }

      const zone = zoneResult[0];

      // Delete from game via RCON
      let rconSuccess = false;
      try {
        if (zone.ip && zone.port && zone.password) {
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zone.name}"`);
          rconSuccess = true;
        } else {
          console.warn('Missing RCON credentials for zone deletion:', zone.name);
        }
      } catch (rconError) {
        console.error('RCON error deleting zone:', rconError);
        // Still proceed to DB deletion
      }

      // Clear offline expiration timer if it exists
      try {
        const { clearOfflineExpirationTimer } = require('../../rcon');
        await clearOfflineExpirationTimer(zone.name);
      } catch (timerError) {
        console.error('Error clearing offline timer:', timerError);
        // Continue with deletion even if timer cleanup fails
      }

      // Delete from database
      try {
        await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
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

      const embed = successEmbed('Success', `Zorp for **${trimmedPlayerName}** has been deleted.`);
      embed.addFields({
        name: 'Zone Details',
        value: `**Owner:** ${owner}\n**Server:** ${serverName}\n**Created:** <t:${createdAt}:R>`,
        inline: false
      });

      if (!rconSuccess) {
        embed.addFields({
          name: 'Note',
          value: 'Zone was deleted from the database but the RCON command failed. Zone may still exist in-game.',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Unexpected error in delete-zorp command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An unexpected error occurred while deleting the zone.')]
      });
    }
  },
};
