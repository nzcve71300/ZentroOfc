const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');
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
          { name: 'TPN-BANLIST', value: 'TPN-BANLIST' }
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

  async execute(interaction) {
    try {
      const listName = interaction.options.getString('list-name');
      const playerName = interaction.options.getString('name');
      const serverName = interaction.options.getString('server');

      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      // Get server ID
      const [servers] = await connection.execute(
        'SELECT id FROM rust_servers WHERE nickname = ?',
        [serverName]
      );
      if (servers.length === 0) {
        await connection.end();
        return await interaction.reply({
          content: `❌ Server "${serverName}" not found.`,
          ephemeral: true
        });
      }
      const serverId = servers[0].id;

      // Determine if it's a Discord ID or IGN
      const isDiscordId = /^\d+$/.test(playerName);
      const discordId = isDiscordId ? playerName : null;
      const ign = isDiscordId ? null : playerName;

      // Check if player exists in players table
      if (discordId) {
        const [players] = await connection.execute(
          'SELECT ign FROM players WHERE discord_id = ? AND server_id = ?',
          [discordId, serverId]
        );
        if (players.length === 0) {
          await connection.end();
          return await interaction.reply({
            content: `❌ Player with Discord ID ${discordId} not found on this server.`,
            ephemeral: true
          });
        }
      }

      // Add to appropriate list
      if (listName === 'TPN-LIST') {
        await connection.execute(`
          INSERT INTO teleport_allowed_users (server_id, teleport_name, discord_id, ign, added_by)
          VALUES (?, 'default', ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          added_by = VALUES(added_by)
        `, [serverId.toString(), discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **TPN-LIST** for **${serverName}**`,
          ephemeral: true
        });
      } else if (listName === 'TPN-BANLIST') {
        await connection.execute(`
          INSERT INTO teleport_banned_users (server_id, teleport_name, discord_id, ign, banned_by)
          VALUES (?, 'default', ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          discord_id = VALUES(discord_id),
          ign = VALUES(ign),
          banned_by = VALUES(banned_by)
        `, [serverId.toString(), discordId, ign, interaction.user.id]);

        await interaction.reply({
          content: `✅ **${playerName}** added to **TPN-BANLIST** for **${serverName}**`,
          ephemeral: true
        });
      }

      await connection.end();

    } catch (error) {
      console.error('Error in add-to-list command:', error);
      await interaction.reply({
        content: '❌ An error occurred while adding to the list.',
        ephemeral: true
      });
    }
  },

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    
    if (interaction.options.getFocused(true).name === 'server') {
      try {
        const connection = await mysql.createConnection({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          port: process.env.DB_PORT || 3306
        });

        const [servers] = await connection.execute(
          'SELECT nickname FROM rust_servers WHERE nickname LIKE ? ORDER BY nickname LIMIT 25',
          [`%${focusedValue}%`]
        );

        await connection.end();

        const choices = servers.map(server => ({
          name: server.nickname,
          value: server.nickname
        }));

        await interaction.respond(choices);
      } catch (error) {
        console.error('Error in add-to-list autocomplete:', error);
        await interaction.respond([]);
      }
    }
  },
};
