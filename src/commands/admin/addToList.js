const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');
const { getServerByNickname, getServersForGuild } = require('../../utils/unifiedPlayerSystem');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-to-list')
    .setDescription('Add players to teleport lists')
    .addStringOption(option =>
      option.setName('list-name')
        .setDescription('Select the list type (type to search)')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Player name or Discord ID')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Server to add to')
        .setRequired(true)
        .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      if (focusedOption.name === 'server') {
        const guildId = interaction.guildId;
        const servers = await getServersForGuild(guildId);
        const filtered = servers.filter(s => s.nickname.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.map(s => ({ name: s.nickname, value: s.nickname })));
      } else if (focusedOption.name === 'list-name') {
        // Generate all teleport list options
        const teleports = ['TPN', 'TPNE', 'TPE', 'TPSE', 'TPS', 'TPSW', 'TPW', 'TPNW'];
        const listTypes = [
          { name: 'LIST (Allowed Users)', value: 'LIST' },
          { name: 'BANLIST (Banned Users)', value: 'BANLIST' }
        ];
        
        const allOptions = [];
        teleports.forEach(teleport => {
          listTypes.forEach(listType => {
            allOptions.push({
              name: `${teleport}-${listType.value}`,
              value: `${teleport}-${listType.value}`
            });
          });
        });
        
        // Add recycler list option
        allOptions.push({
          name: 'RECYCLERLIST (Recycler Allowed Users)',
          value: 'RECYCLERLIST'
        });
        
        // Add ZORP list options
        allOptions.push({
          name: 'ZORP-LIST (ZORP Allowed Users)',
          value: 'ZORP-LIST'
        });
        allOptions.push({
          name: 'ZORP-BANLIST (ZORP Banned Users)',
          value: 'ZORP-BANLIST'
        });
        
        // Add HOMETP list options
        allOptions.push({
          name: 'HOMETP-LIST (Home Teleport Allowed Users)',
          value: 'HOMETP-LIST'
        });
        allOptions.push({
          name: 'HOMETP-BANLIST (Home Teleport Banned Users)',
          value: 'HOMETP-BANLIST'
        });
        
        // Filter based on user input
        const filtered = allOptions.filter(option => 
          option.name.toLowerCase().includes(focusedValue.toLowerCase())
        );
        
        // Return first 25 results (Discord limit)
        await interaction.respond(filtered.slice(0, 25));
      }
    } catch (err) {
      console.error('Autocomplete error:', err);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    try {
      const listName = interaction.options.getString('list-name');
      const playerName = interaction.options.getString('name');
      const serverOption = interaction.options.getString('server');
      const guildId = interaction.guildId;

      // Extract teleport name from list name (e.g., "TPNE-LIST" -> "tpne")
      const teleportMatch = listName.match(/^(TPN|TPNE|TPE|TPSE|TPS|TPSW|TPW|TPNW)-/);
      const teleport = teleportMatch ? teleportMatch[1].toLowerCase() : 'default';
      
      // Check if it's a recycler list
      const isRecyclerList = listName === 'RECYCLERLIST';
      
      // Check if it's a ZORP list
      const isZorpList = listName === 'ZORP-LIST';
      const isZorpBanList = listName === 'ZORP-BANLIST';
      
      // Check if it's a HOMETP list
      const isHometpList = listName === 'HOMETP-LIST';
      const isHometpBanList = listName === 'HOMETP-BANLIST';

      // Get server using shared helper
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return await interaction.reply({
          content: `❌ Server not found: ${serverOption}`,
          ephemeral: true
        });
      }

      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      // Determine if it's a Discord ID or IGN
      const isDiscordId = /^\d+$/.test(playerName);
      let discordId = isDiscordId ? playerName : null;
      let ign = isDiscordId ? null : playerName;

      // Check if player exists in players table
      if (discordId) {
        const [players] = await connection.execute(
          'SELECT ign FROM players WHERE discord_id = ? AND server_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
          [discordId, server.id, guildId]
        );
        if (players.length === 0) {
          await connection.end();
          return await interaction.reply({
            content: `❌ Player with Discord ID ${discordId} not found on ${server.nickname}.`,
            ephemeral: true
          });
        }
        ign = players[0].ign;
      } else {
        // Check if IGN exists in players table
        const [players] = await connection.execute(
          'SELECT discord_id FROM players WHERE ign = ? AND server_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
          [ign, server.id, guildId]
        );
        if (players.length === 0) {
          await connection.end();
          return await interaction.reply({
            content: `❌ Player with IGN ${ign} not found on ${server.nickname}.`,
            ephemeral: true
          });
        }
        discordId = players[0].discord_id;
      }

      // Add to appropriate list
      if (isRecyclerList) {
        await connection.execute(`
          INSERT INTO recycler_allowed_users (server_id, discord_id, ign, added_by)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          added_by = VALUES(added_by)
        `, [server.id.toString(), discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **RECYCLERLIST** on **${server.nickname}**`,
          ephemeral: true
        });
      } else if (isZorpList) {
        await connection.execute(`
          INSERT INTO zorp_allowed_users (server_id, discord_id, ign, added_by)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          added_by = VALUES(added_by)
        `, [server.id.toString(), discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **ZORP-LIST** on **${server.nickname}**`,
          ephemeral: true
        });
      } else if (isZorpBanList) {
        await connection.execute(`
          INSERT INTO zorp_banned_users (server_id, discord_id, ign, banned_by)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          banned_by = VALUES(banned_by)
        `, [server.id.toString(), discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **ZORP-BANLIST** on **${server.nickname}**`,
          ephemeral: true
        });
      } else if (isHometpList) {
        await connection.execute(`
          INSERT INTO home_teleport_allowed_users (server_id, discord_id, ign, added_by)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          added_by = VALUES(added_by)
        `, [server.id.toString(), discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **HOMETP-LIST** on **${server.nickname}**`,
          ephemeral: true
        });
      } else if (isHometpBanList) {
        await connection.execute(`
          INSERT INTO home_teleport_banned_users (server_id, discord_id, ign, banned_by)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          banned_by = VALUES(banned_by)
        `, [server.id.toString(), discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **HOMETP-BANLIST** on **${server.nickname}**`,
          ephemeral: true
        });
      } else if (listName.endsWith('-LIST')) {
        await connection.execute(`
          INSERT INTO teleport_allowed_users (server_id, teleport_name, discord_id, ign, added_by)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          added_by = VALUES(added_by)
        `, [server.id.toString(), teleport, discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **${listName}** on **${server.nickname}**`,
          ephemeral: true
        });
      } else if (listName.endsWith('-BANLIST')) {
        await connection.execute(`
          INSERT INTO teleport_banned_users (server_id, teleport_name, discord_id, ign, banned_by)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          banned_by = VALUES(banned_by)
        `, [server.id.toString(), teleport, discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **${listName}** on **${server.nickname}**`,
          ephemeral: true
        });
      }

      await connection.end();

    } catch (error) {
      console.error('Error in add-to-list command:', error);
      await interaction.reply({
        content: `❌ An error occurred while adding to list: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
