const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getServerByNickname, updateBalance, recordTransaction, getServersForGuild } = require('../../utils/economy');
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
      const choices = await getServersForGuild(guildId, focusedValue);
      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverOption = interaction.options.getString('server');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    try {
      // Get server info using shared helper
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Get all players on this server
      const playersResult = await pool.query(
        `SELECT p.id as player_id, p.ign, p.discord_id, e.balance
         FROM players p
         LEFT JOIN economy e ON p.id = e.player_id
         WHERE p.server_id = $1
         ORDER BY p.ign`,
        [server.id]
      );

      if (playersResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            'No Players Found',
            `No players found on **${server.nickname}**.\n\nPlayers need to use \`/link <in-game-name>\` to create their accounts first.`
          )]
        });
      }

      let updatedPlayers = [];
      let totalRemoved = 0;
      let playersWithInsufficientFunds = [];

      // Update each player's balance using shared helper
      for (const player of playersResult.rows) {
        const balanceResult = await updateBalance(player.player_id, -amount);
        
        if (balanceResult.success) {
          const actualRemoved = balanceResult.oldBalance - balanceResult.newBalance;
          
          updatedPlayers.push({
            ign: player.ign || 'Unknown',
            discordId: player.discord_id,
            oldBalance: balanceResult.oldBalance,
            newBalance: balanceResult.newBalance,
            removed: actualRemoved
          });

          totalRemoved += actualRemoved;

          // Record transaction using shared helper
          await recordTransaction(player.player_id, -actualRemoved, 'admin_remove');

          if (actualRemoved < amount) {
            playersWithInsufficientFunds.push(player.ign || 'Unknown');
          }
        }
      }

      // Create success embed with structured format
      const embed = successEmbed(
        'Currency Removed from Server',
        `**Server:** ${server.nickname}\n**Amount Requested:** -${amount}\n**Players Affected:** ${updatedPlayers.length}\n**Total Removed:** ${totalRemoved}`
      );

      // Add player details (limit to first 10 to avoid embed field limits)
      const playersToShow = updatedPlayers.slice(0, 10);
      for (const player of playersToShow) {
        const status = player.removed < amount ? ' (Insufficient funds)' : '';
        embed.addFields({
          name: `👤 ${player.ign}${status}`,
          value: `${player.oldBalance} → ${player.newBalance} (-${player.removed})`,
          inline: true
        });
      }

      if (updatedPlayers.length > 10) {
        embed.addFields({
          name: '📋 And More...',
          value: `+${updatedPlayers.length - 10} more players were also updated.`,
          inline: false
        });
      }

      if (playersWithInsufficientFunds.length > 0) {
        embed.addFields({
          name: '⚠️ Insufficient Funds',
          value: `${playersWithInsufficientFunds.length} players had insufficient funds and were reduced to 0.`,
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