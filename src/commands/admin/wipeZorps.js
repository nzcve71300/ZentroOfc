const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { sendRconCommand } = require('../../rcon');
const pool = require('../../db');

// Helper function to get server number based on creation order
async function getServerNumber(guildId, serverName) {
  try {
    // Get all servers for this guild ordered by creation (id is timestamp-based)
    const [servers] = await pool.query(
      `SELECT rs.nickname, rs.id 
       FROM rust_servers rs 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = ? 
       ORDER BY rs.id ASC`,
      [guildId]
    );

    // Find the index of the current server (1-based numbering)
    const serverIndex = servers.findIndex(server => server.nickname === serverName);
    return serverIndex >= 0 ? serverIndex + 1 : '?';
  } catch (error) {
    console.error('Error getting server number:', error);
    return '?';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wipe-zorps')
    .setDescription('Delete all zorp zones on a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to wipe zorps from')
        .setRequired(true)
        .setAutocomplete(true)),

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
      console.error('Wipe zorps autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check admin permissions
    if (!interaction.member) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Unable to verify permissions. Please try again.')]
      });
    }
    
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction);
    }

    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');

    try {
      // Get server info
      const [serverResult] = await pool.query(
        'SELECT id, nickname, ip, port, password FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, serverOption]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const server = serverResult[0];

      // Get all zorp zones for this server
      const [zonesResult] = await pool.query(
        'SELECT name, owner FROM zorp_zones WHERE server_id = ?',
        [server.id]
      );

      if (zonesResult.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed('No Zorps Found', `No zorp zones found on **${server.nickname}**`)]
        });
      }

      console.log(`[ZORP WIPE] Starting wipe of ${zonesResult.length} zorp zones on ${server.nickname}`);

      let deletedCount = 0;
      let failedCount = 0;
      const deletedZones = [];

      // Delete each zone
      for (const zone of zonesResult) {
        try {
          console.log(`[ZORP WIPE] Attempting to delete zone: ${zone.name} owned by ${zone.owner}`);
          console.log(`[ZORP WIPE] Server connection: ${server.ip}:${server.port}`);
          
          // Delete zone from game server
          const deleteCommand = `zones.deletecustomzone "${zone.name}"`;
          console.log(`[ZORP WIPE] Sending RCON command: ${deleteCommand}`);
          
          await sendRconCommand(server.ip, server.port, server.password, deleteCommand);
          console.log(`[ZORP WIPE] RCON command sent successfully for zone: ${zone.name}`);
          
          // Send in-game deletion message
          await sendRconCommand(server.ip, server.port, server.password, `say <color=#FF69B4>[ZORP]${zone.owner}</color> <color=white>Zorp successfully deleted!</color>`);
          
          // Clear offline expiration timer if it exists (import the function from rcon)
          const { clearOfflineExpirationTimer } = require('../../rcon');
          await clearOfflineExpirationTimer(zone.name);
          
          // Delete from database
          await pool.query('DELETE FROM zorp_zones WHERE name = ?', [zone.name]);
          console.log(`[ZORP WIPE] Deleted zone from database: ${zone.name}`);
          
          deletedCount++;
          deletedZones.push(`${zone.name} (${zone.owner})`);
          
          console.log(`[ZORP WIPE] Successfully deleted zone: ${zone.name} owned by ${zone.owner}`);
        } catch (error) {
          console.error(`[ZORP WIPE] Failed to delete zone ${zone.name}:`, error);
          failedCount++;
        }
      }

      // Send notification to zorp feed channel if configured
      try {
        const [channelResult] = await pool.query(
          `SELECT cs.channel_id 
           FROM channel_settings cs 
           JOIN rust_servers rs ON cs.server_id = rs.id 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = ? AND rs.nickname = ? AND cs.channel_type = 'zorpfeed'`,
          [guildId, server.nickname]
        );

        if (channelResult.length > 0) {
          const channelId = channelResult[0].channel_id;
          const channel = await interaction.client.channels.fetch(channelId);
          
          if (channel) {
            // Get server number for this guild
            const serverNumber = await getServerNumber(interaction.guild.id, server.nickname);

            const feedEmbed = new EmbedBuilder()
              .setColor(0xFF8C00)
              .setTitle(`Zorpfeed Feed - (Server: ${serverNumber})`)
              .setDescription(`[ZORP WIPE] All zorp zones deleted from ${server.nickname} (${deletedCount} zones)`)
              .setTimestamp();

            await channel.send({ embeds: [feedEmbed] });
          }
        }
      } catch (feedError) {
        console.error('Error sending feed notification:', feedError);
      }

      // Create response embed
      const embed = successEmbed(
        'Zorp Zones Wiped',
        `Successfully deleted **${deletedCount}** zorp zones from **${server.nickname}**`
      );

      if (deletedZones.length > 0) {
        embed.addFields({
          name: '🗑️ Deleted Zones',
          value: deletedZones.slice(0, 10).join('\n') + (deletedZones.length > 10 ? '\n...and more' : ''),
          inline: false
        });
      }

      if (failedCount > 0) {
        embed.addFields({
          name: '⚠️ Failed Deletions',
          value: `${failedCount} zones failed to delete`,
          inline: false
        });
      }

      embed.setFooter({ text: '💎 Admin Command • All zorp zones have been removed' });

      await interaction.editReply({ embeds: [embed] });

      // Send summary message to game
      if (deletedCount > 0) {
        await sendRconCommand(server.ip, server.port, server.password, `say <color=#FF69B4>[ZORP WIPE]</color> <color=white>All zorp zones have been deleted from ${server.nickname} (${deletedCount} zones)</color>`);
      }

      console.log(`[ZORP WIPE] Completed wipe on ${server.nickname}: ${deletedCount} deleted, ${failedCount} failed`);

    } catch (error) {
      console.error('Error wiping zorp zones:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to wipe zorp zones. Please try again.')]
      });
    }
  }
}; 