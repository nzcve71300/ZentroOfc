const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allow-link')
    .setDescription('Allow a player to relink their Discord account')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Discord ID or in-game name')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const playerName = interaction.options.getString('name');
    const guildId = interaction.guildId;

    try {
      // Check if input is a Discord ID
      const isDiscordId = /^\d{17,}$/.test(playerName);
      
      let query;
      let params;
      
      if (isDiscordId) {
        // Allow relink by Discord ID - find any player with this Discord ID
        query = `
          UPDATE players 
          SET discord_id = NULL 
          WHERE id IN (
            SELECT p.id 
            FROM players p 
            JOIN rust_servers rs ON p.server_id = rs.id 
            JOIN guilds g ON rs.guild_id = g.id 
            WHERE g.discord_id = $1 AND p.discord_id = $2
          ) RETURNING ign, discord_id`;
        params = [guildId, playerName];
      } else {
        // Allow relink by IGN - find any player with this IGN
        query = `
          UPDATE players 
          SET discord_id = NULL 
          WHERE id IN (
            SELECT p.id 
            FROM players p 
            JOIN rust_servers rs ON p.server_id = rs.id 
            JOIN guilds g ON rs.guild_id = g.id 
            WHERE g.discord_id = $1 AND p.ign ILIKE $2
          ) RETURNING ign, discord_id`;
        params = [guildId, playerName];
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        // If no players were updated, let's check if any players exist with this name
        let checkQuery;
        if (isDiscordId) {
          checkQuery = `
            SELECT p.ign, p.discord_id 
            FROM players p 
            JOIN rust_servers rs ON p.server_id = rs.id 
            JOIN guilds g ON rs.guild_id = g.id 
            WHERE g.discord_id = $1 AND p.discord_id = $2`;
        } else {
          checkQuery = `
            SELECT p.ign, p.discord_id 
            FROM players p 
            JOIN rust_servers rs ON p.server_id = rs.id 
            JOIN guilds g ON rs.guild_id = g.id 
            WHERE g.discord_id = $1 AND p.ign ILIKE $2`;
        }
        
        const checkResult = await pool.query(checkQuery, params);
        
        if (checkResult.rows.length === 0) {
          return interaction.editReply({
            embeds: [orangeEmbed('Player Not Found', `No player found with name "${playerName}".`)]
          });
        } else {
          // Players exist but are not linked
          const playerList = checkResult.rows.map(row => row.ign).join(', ');
          return interaction.editReply({
            embeds: [orangeEmbed('Already Unlinked', `**${checkResult.rows.length} player(s)** found but they are not currently linked: **${playerList}**`)]
          });
        }
      }

      const linkedPlayers = result.rows.filter(row => row.discord_id !== null);
      const unlinkedPlayers = result.rows.filter(row => row.discord_id === null);
      
      let message;
      if (linkedPlayers.length > 0) {
        const playerList = linkedPlayers.map(row => row.ign).join(', ');
        message = `**${linkedPlayers.length} player(s)** can now relink: **${playerList}**`;
      } else {
        const playerList = unlinkedPlayers.map(row => row.ign).join(', ');
        message = `**${unlinkedPlayers.length} player(s)** found but they were not linked: **${playerList}**`;
      }

      await interaction.editReply({
        embeds: [successEmbed('Relink Status', message)]
      });

    } catch (err) {
      console.error('Allow-link error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to allow relink.')]
      });
    }
  }
};
