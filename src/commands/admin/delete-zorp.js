const { SlashCommandBuilder } = require('@discordjs/builders');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');
const { sendRconCommand } = require('../../rcon');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-zorp')
    .setDescription('Delete a ZORP zone by player name')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to search for the Zorp')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('player_name')
        .setDescription('Name of the player whose Zorp to delete')
        .setRequired(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [servers] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ?',
        [guildId, `%${focusedValue}%`]
      );

      await interaction.respond(
        servers.map(server => ({ name: server.nickname, value: server.nickname }))
      );
    } catch (error) {
      console.error('Delete zorp autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const guildId = interaction.guildId;
      const serverOption = interaction.options.getString('server');
      const playerName = interaction.options.getString('player_name');
      
      // Debug logging
      console.log(`[DELETE-ZORP] Received server: "${serverOption}", player name: "${playerName}"`);

      // Validate inputs
      if (!serverOption || !playerName || typeof serverOption !== 'string' || typeof playerName !== 'string' || 
          serverOption.trim() === '' || playerName.trim() === '') {
        console.log(`[DELETE-ZORP] Validation failed: invalid server or player name`);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Please provide valid server and player names.')]
        });
      }

      // Trim the inputs
      const trimmedServer = serverOption.trim();
      const trimmedPlayerName = playerName.trim();
      
      if (trimmedPlayerName.length > 32) {
        console.log(`[DELETE-ZORP] Validation failed: player name too long (${trimmedPlayerName.length} chars)`);
        return interaction.editReply({
          embeds: [errorEmbed('Error', 'Player name is too long (max 32 characters).')]
        });
      }
      
      console.log(`[DELETE-ZORP] Using server: "${trimmedServer}", player: "${trimmedPlayerName}"`);

      // Get server info first
      const [serverResult] = await pool.query(
        'SELECT id, nickname, ip, port, password FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, trimmedServer]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', `The server "${trimmedServer}" was not found.`)]
        });
      }

      const server = serverResult[0];
      console.log(`[DELETE-ZORP] Found server: ${server.nickname} (ID: ${server.id})`);

      // Get zone by player name on the specific server
      let zoneResult;
      try {
        console.log(`[DELETE-ZORP] Searching for zone with server_id: ${server.id}, owner: "${trimmedPlayerName}"`);
        
        [zoneResult] = await pool.query(`
          SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
          FROM zorp_zones z
          JOIN rust_servers rs ON z.server_id = rs.id
          WHERE z.server_id = ? AND LOWER(z.owner) = LOWER(?)
        `, [server.id, trimmedPlayerName]);
        
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
        console.log(`[DELETE-ZORP] No zone found for player: "${trimmedPlayerName}" on server: "${trimmedServer}"`);
        
        // Get all active Zorps on this specific server to show what's available
        const [availableZorps] = await pool.query(`
          SELECT z.owner
          FROM zorp_zones z
          WHERE z.server_id = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
          ORDER BY z.owner
        `, [server.id]);
        
        let errorMessage = `No Zorp found for player "${trimmedPlayerName}" on server "${trimmedServer}".`;
        
        if (availableZorps.length > 0) {
          const zorpList = availableZorps.map(z => `• ${z.owner}`).join('\n');
          errorMessage += `\n\n**Available Zorps on ${trimmedServer}:**\n${zorpList}`;
        } else {
          errorMessage += `\n\n**No active Zorps found on ${trimmedServer}.**`;
        }
        
        return interaction.editReply({
          embeds: [errorEmbed('Error', errorMessage)]
        });
      }

      const zone = zoneResult[0];

      // Delete from game via RCON
      let rconSuccess = false;
      try {
        if (server.ip && server.port && server.password) {
          await sendRconCommand(server.ip, server.port, server.password, `zones.deletecustomzone "${zone.name}"`);
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

      const embed = successEmbed('Success', `Zorp for **${trimmedPlayerName}** has been deleted from **${trimmedServer}**.`);
      embed.addFields({
        name: 'Zone Details',
        value: `**Owner:** ${owner}\n**Server:** ${trimmedServer}\n**Created:** <t:${createdAt}:R>`,
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
