const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force-link')
    .setDescription('Forcefully link a Discord user to an in-game player name (Admin only)')
    .addUserOption(option =>
      option.setName('member')
        .setDescription('The Discord member to link (@ mention)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('The in-game player name')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const discordUser = interaction.options.getUser('member');
      const playerName = interaction.options.getString('ign');

      // Get server information from the current guild
      const guildId = interaction.guildId;
      
      // Find the server by guild ID
      const [servers] = await pool.query(
        'SELECT * FROM rust_servers WHERE guild_id = ?',
        [guildId]
      );

      if (servers.length === 0) {
        return interaction.reply({
          content: '❌ **Server not found!** This Discord server is not linked to any Rust server.',
          ephemeral: true
        });
      }

      const server = servers[0];
      const serverId = server.id; // This is the string ID for players table

      // Check if player already exists in the database
      const [existingPlayers] = await pool.query(
        'SELECT * FROM players WHERE LOWER(ign) = LOWER(?) AND server_id = ?',
        [playerName, serverId]
      );

      if (existingPlayers.length > 0) {
        // Update existing player record
        await pool.query(
          'UPDATE players SET discord_id = ?, updated_at = NOW() WHERE id = ?',
          [discordUser.id, existingPlayers[0].id]
        );

        // Update or create economy record with guild_id
        const [economyRecords] = await pool.query(
          'SELECT * FROM economy WHERE player_id = ?',
          [existingPlayers[0].id]
        );

        if (economyRecords.length > 0) {
          await pool.query(
            'UPDATE economy SET guild_id = ? WHERE player_id = ?',
            [guildId, existingPlayers[0].id]
          );
        } else {
          await pool.query(
            'INSERT INTO economy (player_id, balance, guild_id) VALUES (?, 5000, ?)',
            [existingPlayers[0].id, guildId]
          );
        }

        return interaction.reply({
          content: `✅ **Successfully force-linked!**\n\n**Player:** ${playerName}\n**Discord User:** ${discordUser}\n**Server:** ${server.nickname}\n\n*Updated existing player record.*`,
          ephemeral: true
        });
      } else {
        // Create new player record
        const [result] = await pool.query(
          'INSERT INTO players (ign, discord_id, server_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [playerName, discordUser.id, serverId]
        );

        const playerId = result.insertId;

        // Create economy record with guild_id
        await pool.query(
          'INSERT INTO economy (player_id, balance, guild_id) VALUES (?, 5000, ?)',
          [playerId, guildId]
        );

        return interaction.reply({
          content: `✅ **Successfully force-linked!**\n\n**Player:** ${playerName}\n**Discord User:** ${discordUser}\n**Server:** ${server.nickname}\n\n*Created new player record.*`,
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Force link error:', error);
      return interaction.reply({
        content: '❌ **Force link failed!** An error occurred while processing the request.',
        ephemeral: true
      });
    }
  },
}; 