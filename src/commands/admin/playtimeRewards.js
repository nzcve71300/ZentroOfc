const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playtime-rewards')
    .setDescription('Configure playtime reward system for a server (Admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('config')
        .setDescription('Configuration option')
        .setRequired(true)
        .addChoices(
          { name: 'On', value: 'on' },
          { name: 'Off', value: 'off' },
          { name: 'Amount', value: 'amount' }
        ))
    .addIntegerOption(option =>
      option.setName('option')
        .setDescription('Amount of coins to give every 30 minutes (only for Amount config)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(10000)),

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
    const config = interaction.options.getString('config');
    const option = interaction.options.getInteger('option');

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

      // Handle different config options
      if (config === 'amount') {
        if (option === null || option === undefined) {
          return interaction.editReply({
            embeds: [errorEmbed('Missing Amount', 'Please specify the amount of coins to give every 30 minutes.')]
          });
        }

        // Update or insert the amount
        await pool.query(
          `INSERT INTO playtime_rewards_config (server_id, amount_per_30min) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE amount_per_30min = VALUES(amount_per_30min)`,
          [server.id, option]
        );

        const embed = successEmbed(
          `Playtime Rewards Updated - ${serverName}`,
          `**Reward Amount:** ${option.toLocaleString()} ${currencyName} every 30 minutes\n\n` +
          `Players will receive ${option.toLocaleString()} ${currencyName} for every 30 minutes of playtime while online on the server.`
        );

        embed.setFooter({ 
          text: `Updated by ${interaction.user.username} • ${new Date().toLocaleString()}` 
        });

        await interaction.editReply({ embeds: [embed] });

      } else if (config === 'on' || config === 'off') {
        const enabled = config === 'on';

        // Update or insert the enabled status
        await pool.query(
          `INSERT INTO playtime_rewards_config (server_id, enabled) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
          [server.id, enabled]
        );

        // Get current config to show in response
        const [configResult] = await pool.query(
          'SELECT enabled, amount_per_30min FROM playtime_rewards_config WHERE server_id = ?',
          [server.id]
        );

        const currentConfig = configResult[0] || { enabled: false, amount_per_30min: 0 };

        const statusText = enabled ? '🟢 **ENABLED**' : '🔴 **DISABLED**';
        const embed = successEmbed(
          `Playtime Rewards ${enabled ? 'Enabled' : 'Disabled'} - ${serverName}`,
          `**Status:** ${statusText}\n` +
          `**Reward Amount:** ${currentConfig.amount_per_30min.toLocaleString()} ${currencyName} every 30 minutes\n\n` +
          (enabled 
            ? `Players will now receive ${currencyName} rewards for every 30 minutes of playtime while online.`
            : 'Playtime rewards have been disabled. Players will not receive any rewards.')
        );

        embed.setFooter({ 
          text: `Updated by ${interaction.user.username} • ${new Date().toLocaleString()}` 
        });

        await interaction.editReply({ embeds: [embed] });
      }

      console.log(`[PLAYTIME-REWARDS] ${interaction.user.username} updated ${serverName}: ${config} = ${config === 'amount' ? option : config}`);

    } catch (error) {
      console.error('Error in playtime-rewards:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to update playtime rewards configuration. Please try again.')]
      });
    }
  }
};
