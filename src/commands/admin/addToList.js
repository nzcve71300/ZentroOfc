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
        .setDescription('Select the list type')
        .setRequired(true)
        .addChoices(
          { name: 'TPN-LIST', value: 'TPN-LIST' },
          { name: 'TPN-BANLIST', value: 'TPN-BANLIST' },
          { name: 'TPNE-LIST', value: 'TPNE-LIST' },
          { name: 'TPNE-BANLIST', value: 'TPNE-BANLIST' },
          { name: 'TPE-LIST', value: 'TPE-LIST' },
          { name: 'TPE-BANLIST', value: 'TPE-BANLIST' },
          { name: 'TPSE-LIST', value: 'TPSE-LIST' },
          { name: 'TPSE-BANLIST', value: 'TPSE-BANLIST' },
          { name: 'TPS-LIST', value: 'TPS-LIST' },
          { name: 'TPS-BANLIST', value: 'TPS-BANLIST' },
          { name: 'TPSW-LIST', value: 'TPSW-LIST' },
          { name: 'TPSW-BANLIST', value: 'TPSW-BANLIST' },
          { name: 'TPW-LIST', value: 'TPW-LIST' },
          { name: 'TPW-BANLIST', value: 'TPW-BANLIST' },
          { name: 'TPNW-LIST', value: 'TPNW-LIST' },
          { name: 'TPNW-BANLIST', value: 'TPNW-BANLIST' }
        ))
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
    const guildId = interaction.guildId;
    
    try {
      const servers = await getServersForGuild(guildId);
      const filtered = servers.filter(s => s.nickname.toLowerCase().includes(focusedValue.toLowerCase()));
      await interaction.respond(filtered.map(s => ({ name: s.nickname, value: s.nickname })));
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
      const discordId = isDiscordId ? playerName : null;
      const ign = isDiscordId ? null : playerName;

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
      }

      // Add to appropriate list
      if (listName.endsWith('-LIST')) {
        await connection.execute(`
          INSERT INTO teleport_allowed_users (server_id, teleport_name, discord_id, ign, added_by)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          added_by = VALUES(added_by)
        `, [server.id.toString(), teleport, discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **${listName}** for **${teleport.toUpperCase()}** on **${server.nickname}**`,
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
          content: `✅ **${playerName}** added to **${listName}** for **${teleport.toUpperCase()}** on **${server.nickname}**`,
          ephemeral: true
        });
      }

      await connection.end();

    } catch (error) {
      console.error('Error in add-to-list command:', error);
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
