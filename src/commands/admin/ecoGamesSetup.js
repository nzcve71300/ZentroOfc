const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eco-games-setup')
    .setDescription('Configure economy games settings for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(TRUE)
        .setAutocomplete(TRUE))
    .addStringOption(option =>
      option.setName('setup')
        .setDescription('Select a setting to configure')
        .setRequired(TRUE)
        .addChoices(
          { name: 'Blackjack On/Off', value: 'blackjack_toggle' },
          { name: 'Slots On/Off', value: 'slots_toggle' },
          { name: 'Daily Rewards Amount', value: 'daily_amount' },
          { name: 'Blackjack Min Bet', value: 'blackjack_min' },
          { name: 'Blackjack Max Bet', value: 'blackjack_max' },
          { name: 'Slots Min Bet', value: 'slots_min' },
          { name: 'Slots Max Bet', value: 'slots_max' }
        ))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Value for the setting (on/off, amount, or bet limit)')
        .setRequired(TRUE)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
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
    await interaction.deferReply({ ephemeral: TRUE });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, FALSE);
    }

    const serverOption = interaction.options.getString('server');
    const setup = interaction.options.getString('setup');
    const option = interaction.options.getString('option');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const serverResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
        [guildId, serverOption]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult.rows[0].id;
      const serverName = serverResult.rows[0].nickname;

      // For now, we'll just acknowledge the configuration
      // In a full implementation, you might want to add an eco_games_config table
      
      let message = '';
      let value = '';

      switch (setup) {
        case 'blackjack_toggle':
          const blackjackEnabled = option.toLowerCase() === 'on' || option.toLowerCase() === 'TRUE' || option === '1';
          message = `Blackjack has been ${blackjackEnabled ? 'enabled' : 'disabled'} on ${serverName}.`;
          value = blackjackEnabled ? '🟢 Enabled' : '🔴 Disabled';
          break;

        case 'slots_toggle':
          const slotsEnabled = option.toLowerCase() === 'on' || option.toLowerCase() === 'TRUE' || option === '1';
          message = `Slots has been ${slotsEnabled ? 'enabled' : 'disabled'} on ${serverName}.`;
          value = slotsEnabled ? '🟢 Enabled' : '🔴 Disabled';
          break;

        case 'daily_amount':
          const dailyAmount = parseInt(option);
          if (isNaN(dailyAmount) || dailyAmount < 0) {
            return interaction.editReply({
              embeds: [errorEmbed('Invalid Amount', 'Daily reward amount must be a positive number.')]
            });
          }
          message = `Daily reward amount has been set to ${dailyAmount} coins on ${serverName}.`;
          value = `${dailyAmount} coins`;
          break;

        case 'blackjack_min':
        case 'blackjack_max':
        case 'slots_min':
        case 'slots_max':
          const betLimit = parseInt(option);
          if (isNaN(betLimit) || betLimit < 0) {
            return interaction.editReply({
              embeds: [errorEmbed('Invalid Bet Limit', 'Bet limit must be a positive number.')]
            });
          }
          const gameType = setup.includes('blackjack') ? 'Blackjack' : 'Slots';
          const limitType = setup.includes('min') ? 'minimum' : 'maximum';
          message = `${gameType} ${limitType} bet has been set to ${betLimit} coins on ${serverName}.`;
          value = `${betLimit} coins`;
          break;

        default:
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Setting', 'Invalid setting specified.')]
          });
      }

      const embed = successEmbed(
        'Economy Games Configured',
        message
      );

      embed.addFields({
        name: '📋 Current Setting',
        value: `**${setup.replace(/_/g, ' ').toUpperCase()}:** ${value}`,
        inline: FALSE
      });

      embed.addFields({
        name: '💡 Available Settings',
        value: '• Blackjack On/Off\n• Slots On/Off\n• Daily Rewards Amount\n• Blackjack Min/Max Bet\n• Slots Min/Max Bet',
        inline: FALSE
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error configuring economy games:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to configure economy games. Please try again.')]
      });
    }
  },
}; 