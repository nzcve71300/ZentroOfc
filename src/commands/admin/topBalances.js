const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top-balances')
    .setDescription('Show top 10 players with the most coins (Admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');

    try {
      // Get server info
      const [serverResult] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, serverName]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const server = serverResult[0];

      // Get currency name for this server
      const { getCurrencyName } = require('../../utils/economy');
      const currencyName = await getCurrencyName(server.id);

      // Get top 10 players by balance
      const [topPlayers] = await pool.query(
        `SELECT p.ign, p.discord_id, e.balance, p.linked_at
         FROM players p
         JOIN economy e ON p.id = e.player_id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
         AND p.server_id = ?
         AND p.is_active = true
         ORDER BY e.balance DESC
         LIMIT 10`,
        [guildId, server.id]
      );

      if (topPlayers.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'No Players Found',
            `No players with balances found on **${serverName}**.\n\nPlayers need to link their accounts and have currency to appear on the leaderboard.`
          )]
        });
      }

      // Create embed
      const embed = successEmbed(
        `🏆 Top 10 Richest Players - ${serverName}`,
        `**Currency:** ${currencyName}\n\nHere are the top 10 players with the most coins:`
      );

      // Add each player to the embed
      for (let i = 0; i < topPlayers.length; i++) {
        const player = topPlayers[i];
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        
        let discordInfo = '';
        if (player.discord_id) {
          try {
            const discordUser = await interaction.client.users.fetch(player.discord_id);
            discordInfo = ` (${discordUser.username})`;
          } catch (error) {
            discordInfo = ' (Unknown Discord)';
          }
        }

        embed.addFields({
          name: `${medal} ${player.ign}${discordInfo}`,
          value: `${player.balance.toLocaleString()} ${currencyName}`,
          inline: false
        });
      }

      // Add total players count
      const [totalPlayers] = await pool.query(
        `SELECT COUNT(*) as count
         FROM players p
         JOIN economy e ON p.id = e.player_id
         WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
         AND p.server_id = ?
         AND p.is_active = true`,
        [guildId, server.id]
      );

      embed.setFooter({ 
        text: `Total players with balances: ${totalPlayers[0].count} • Last updated: ${new Date().toLocaleString()}` 
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in top-balances:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to fetch top balances. Please try again.')]
      });
    }
  }
}; 