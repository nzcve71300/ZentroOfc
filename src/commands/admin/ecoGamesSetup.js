const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eco-configs')
    .setDescription('Configure economy settings for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('setup')
        .setDescription('Select a setting to configure')
        .setRequired(true)
        .addChoices(
          { name: 'Blackjack On/Off', value: 'blackjack_toggle' },
          { name: 'Coinflip On/Off', value: 'coinflip_toggle' },
          { name: 'Daily Rewards Amount', value: 'daily_amount' },
          { name: 'Starting Balance', value: 'starting_balance' },
          { name: 'Blackjack Min Bet', value: 'blackjack_min' },
          { name: 'Blackjack Max Bet', value: 'blackjack_max' },
          { name: 'Coinflip Min Bet', value: 'coinflip_min' },
          { name: 'Coinflip Max Bet', value: 'coinflip_max' }
        ))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Value for the setting (on/off, amount, or bet limit)')
        .setRequired(true)),

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
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverOption = interaction.options.getString('server');
    const setup = interaction.options.getString('setup');
    const option = interaction.options.getString('option');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const [serverResult] = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
        [guildId, serverOption]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult[0].id;
      const serverName = serverResult[0].nickname;

      // Store configuration in database
      let message = '';
      let value = '';
      let settingValue = '';

      switch (setup) {
        case 'blackjack_toggle':
          const blackjackEnabled = option.toLowerCase() === 'on' || option.toLowerCase() === 'true' || option === '1';
          settingValue = blackjackEnabled ? 'true' : 'false';
          message = `Blackjack has been ${blackjackEnabled ? 'enabled' : 'disabled'} on ${serverName}.`;
          value = blackjackEnabled ? '🟢 Enabled' : '🔴 Disabled';
          break;

        case 'coinflip_toggle':
          const coinflipEnabled = option.toLowerCase() === 'on' || option.toLowerCase() === 'true' || option === '1';
          settingValue = coinflipEnabled ? 'true' : 'false';
          message = `Coinflip has been ${coinflipEnabled ? 'enabled' : 'disabled'} on ${serverName}.`;
          value = coinflipEnabled ? '🟢 Enabled' : '🔴 Disabled';
          break;

        case 'daily_amount':
          const dailyAmount = parseInt(option);
          if (isNaN(dailyAmount) || dailyAmount < 0) {
            return interaction.editReply({
              embeds: [errorEmbed('Invalid Amount', 'Daily reward amount must be a positive number.')]
            });
          }
          settingValue = dailyAmount.toString();
          message = `Daily reward amount has been set to ${dailyAmount} coins on ${serverName}.`;
          value = `${dailyAmount} coins`;
          break;

        case 'starting_balance':
          const startingBalance = parseInt(option);
          if (isNaN(startingBalance) || startingBalance < 0) {
            return interaction.editReply({
              embeds: [errorEmbed('Invalid Amount', 'Starting balance must be a positive number.')]
            });
          }
          settingValue = startingBalance.toString();
          message = `Starting balance has been set to ${startingBalance} coins on ${serverName}.`;
          value = `${startingBalance} coins`;
          break;

        case 'blackjack_min':
        case 'blackjack_max':
        case 'coinflip_min':
        case 'coinflip_max':
          const betLimit = parseInt(option);
          if (isNaN(betLimit) || betLimit < 0) {
            return interaction.editReply({
              embeds: [errorEmbed('Invalid Bet Limit', 'Bet limit must be a positive number.')]
            });
          }
          settingValue = betLimit.toString();
          const gameType = setup.includes('blackjack') ? 'Blackjack' : 'Coinflip';
          const limitType = setup.includes('min') ? 'minimum' : 'maximum';
          message = `${gameType} ${limitType} bet has been set to ${betLimit} coins on ${serverName}.`;
          value = `${betLimit} coins`;
          break;

        default:
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Setting', 'Invalid setting specified.')]
          });
      }

      // Insert or update the configuration
      await pool.query(
        `INSERT INTO eco_games_config (server_id, setting_name, setting_value) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [serverId, setup, settingValue]
      );

      const embed = successEmbed(
        'Economy Games Configured',
        message
      );

      embed.addFields({
        name: '📋 Current Setting',
        value: `**${setup.replace(/_/g, ' ').toUpperCase()}:** ${value}`,
        inline: false
      });

      embed.addFields({
        name: '💡 Available Settings',
        value: '• Blackjack On/Off\n• Coinflip On/Off\n• Daily Rewards Amount\n• Starting Balance\n• Blackjack Min/Max Bet\n• Coinflip Min/Max Bet',
        inline: false
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