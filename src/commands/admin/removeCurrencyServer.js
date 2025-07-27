const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-currency-server')
    .setDescription('Remove currency from all players on a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of currency to remove')
        .setRequired(true)
        .setMinValue(1)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
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
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'You need administrator permissions to use this command.')]
      });
    }

    const serverOption = interaction.options.getString('server');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const serverResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverOption]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult.rows[0].id;
      const serverName = serverResult.rows[0].nickname;

      // Get all players on this server
      const playersResult = await pool.query(
        `SELECT p.id as player_id, p.ign, p.discord_id, e.balance
         FROM players p
         LEFT JOIN economy e ON p.id = e.player_id
         WHERE p.server_id = $1
         ORDER BY p.ign`,
        [serverId]
      );

      if (playersResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'No Players Found',
            `No players found on **${serverName}**.\n\nPlayers need to use \`/link <in-game-name>\` to create their accounts first.`
          )]
        });
      }

      let updatedPlayers = [];
      let totalRemoved = 0;
      let playersWithInsufficientFunds = [];

      // Update each player's balance
      for (const player of playersResult.rows) {
        const currentBalance = player.balance || 0;
        const newBalance = Math.max(0, currentBalance - amount); // Don't go below 0
        const actualRemoved = currentBalance - newBalance;

        // Update balance
        await pool.query(
          'UPDATE economy SET balance = $1 WHERE player_id = $2',
          [newBalance, player.player_id]
        );

        // Record transaction
        await pool.query(
          'INSERT INTO transactions (player_id, amount, type, timestamp) VALUES ($1, $2, $3, NOW())',
          [player.player_id, -actualRemoved, 'admin_remove']
        );

        updatedPlayers.push({
          ign: player.ign || 'Unknown',
          discordId: player.discord_id,
          oldBalance: currentBalance,
          newBalance: newBalance,
          removed: actualRemoved
        });

        totalRemoved += actualRemoved;

        if (actualRemoved < amount) {
          playersWithInsufficientFunds.push(player.ign || 'Unknown');
        }
      }

      // Create success embed
      const embed = successEmbed(
        '💰 Currency Removed from Server',
        `**Server:** ${serverName}\n**Amount Requested:** ${amount} coins\n**Players Affected:** ${updatedPlayers.length}\n**Total Removed:** ${totalRemoved} coins`
      );

      // Add player details (limit to first 10 to avoid embed field limits)
      const playersToShow = updatedPlayers.slice(0, 10);
      for (const player of playersToShow) {
        const status = player.removed < amount ? ' (Insufficient funds)' : '';
        embed.addFields({
          name: `👤 ${player.ign}${status}`,
          value: `${player.oldBalance} → ${player.newBalance} coins (-${player.removed})`,
          inline: true
        });
      }

      if (updatedPlayers.length > 10) {
        embed.addFields({
          name: '📋 And More...',
          value: `${updatedPlayers.length - 10} more players were also updated.`,
          inline: false
        });
      }

      if (playersWithInsufficientFunds.length > 0) {
        embed.addFields({
          name: '⚠️ Insufficient Funds',
          value: `${playersWithInsufficientFunds.length} players had insufficient funds and were reduced to 0 coins.`,
          inline: false
        });
      }

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error removing currency from server:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to remove currency from server. Please try again.')]
      });
    }
  },
}; 