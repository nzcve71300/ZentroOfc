const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-home-tp')
    .setDescription('Configure home teleport settings for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('config')
        .setDescription('Select configuration option')
        .setRequired(true)
        .addChoices(
          { name: 'Whitelist Option', value: 'whitelist' },
          { name: 'Cooldown Option', value: 'cooldown' }
        ))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Value for the configuration (on/off for whitelist, number for cooldown)')
        .setRequired(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname LIKE ? 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in setup-home-tp autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverNickname = interaction.options.getString('server');
    const configType = interaction.options.getString('config');
    const optionValue = interaction.options.getString('option');
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const [serverResult] = await pool.query(
        `SELECT rs.id, rs.nickname
         FROM rust_servers rs
         JOIN guilds g ON rs.guild_id = g.id
         WHERE rs.nickname = ? AND g.discord_id = ?`,
        [serverNickname, guildId]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const serverId = serverResult[0].id;
      const serverName = serverResult[0].nickname;

      // Check if home teleport config exists
      const [existingResult] = await pool.query(
        'SELECT * FROM home_teleport_configs WHERE server_id = ?',
        [serverId]
      );

      let currentSettings = {
        whitelist_enabled: false,
        cooldown_minutes: 5
      };

      if (existingResult.length > 0) {
        currentSettings = {
          whitelist_enabled: existingResult[0].whitelist_enabled !== 0,
          cooldown_minutes: existingResult[0].cooldown_minutes || 5
        };
      }

      if (configType === 'whitelist') {
        // Validate whitelist value
        const enabled = optionValue.toLowerCase() === 'on' || optionValue.toLowerCase() === 'true';
        
        if (!['on', 'off', 'true', 'false'].includes(optionValue.toLowerCase())) {
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Value', 'Whitelist value must be "on", "off", "true", or "false".')]
          });
        }

        if (existingResult.length > 0) {
          // Update existing setting
          await pool.query(
            'UPDATE home_teleport_configs SET whitelist_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ?',
            [enabled ? 1 : 0, serverId]
          );
        } else {
          // Create new setting
          await pool.query(
            'INSERT INTO home_teleport_configs (server_id, whitelist_enabled, cooldown_minutes, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [serverId, enabled ? 1 : 0, 5]
          );
        }

        const statusText = enabled ? '**enabled**' : '**disabled**';
        const previousStatus = currentSettings.whitelist_enabled ? 'enabled' : 'disabled';

        await interaction.editReply({
          embeds: [successEmbed(
            'Home Teleport Whitelist Updated',
            `**${serverName}** home teleport whitelist has been ${statusText}.\n\nPrevious status: ${previousStatus}`
          )]
        });

      } else if (configType === 'cooldown') {
        // Validate cooldown value
        const cooldown = parseInt(optionValue);
        if (isNaN(cooldown) || cooldown < 1 || cooldown > 60) {
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Value', 'Cooldown must be a number between 1 and 60 minutes.')]
          });
        }

        if (existingResult.length > 0) {
          // Update existing setting
          await pool.query(
            'UPDATE home_teleport_configs SET cooldown_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ?',
            [cooldown, serverId]
          );
        } else {
          // Create new setting
          await pool.query(
            'INSERT INTO home_teleport_configs (server_id, whitelist_enabled, cooldown_minutes, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [serverId, false, cooldown]
          );
        }

        await interaction.editReply({
          embeds: [successEmbed(
            'Home Teleport Cooldown Updated',
            `**${serverName}** home teleport cooldown has been set to **${cooldown} minutes**.\n\nPrevious setting: ${currentSettings.cooldown_minutes} minutes`
          )]
        });
      }

    } catch (error) {
      console.error('Error in setup-home-tp command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', `Failed to update home teleport settings: ${error.message}`)]
      });
    }
  }
}; 