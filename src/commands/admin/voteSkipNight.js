const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vote-skip-night')
    .setDescription('Configure night skip voting settings for a server')
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
          { name: 'Minimum Voters', value: 'minimum_voters' },
          { name: 'Toggle On/Off', value: 'toggle' }
        ))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Value for the configuration (number for minimum voters, on/off for toggle)')
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
      console.error('Error in vote-skip-night autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has admin permissions (Zentro Admin role or Administrator)
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

      // Check if night skip settings exist
      const [existingResult] = await pool.query(
        'SELECT * FROM night_skip_settings WHERE server_id = ?',
        [serverId]
      );

      let currentSettings = {
        minimum_voters: 5,
        enabled: true
      };

      if (existingResult.length > 0) {
        currentSettings = {
          minimum_voters: existingResult[0].minimum_voters || 5,
          enabled: existingResult[0].enabled !== 0
        };
      }

      if (configType === 'minimum_voters') {
        // Validate minimum voters value
        const minVoters = parseInt(optionValue);
        if (isNaN(minVoters) || minVoters < 1 || minVoters > 50) {
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Value', 'Minimum voters must be a number between 1 and 50.')]
          });
        }

        if (existingResult.length > 0) {
          // Update existing setting
          await pool.query(
            'UPDATE night_skip_settings SET minimum_voters = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ?',
            [minVoters, serverId]
          );
        } else {
          // Create new setting
          await pool.query(
            'INSERT INTO night_skip_settings (server_id, minimum_voters, enabled, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [serverId, minVoters, true]
          );
        }

        await interaction.editReply({
          embeds: [successEmbed(
            'Minimum Voters Updated',
            `**${serverName}** night skip minimum voters has been set to **${minVoters}**.\n\nPrevious setting: ${currentSettings.minimum_voters}`
          )]
        });

      } else if (configType === 'toggle') {
        // Validate toggle value
        const enabled = optionValue.toLowerCase() === 'on' || optionValue.toLowerCase() === 'true';
        
        if (!['on', 'off', 'true', 'false'].includes(optionValue.toLowerCase())) {
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Value', 'Toggle value must be "on", "off", "true", or "false".')]
          });
        }

        if (existingResult.length > 0) {
          // Update existing setting
          await pool.query(
            'UPDATE night_skip_settings SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ?',
            [enabled ? 1 : 0, serverId]
          );
        } else {
          // Create new setting
          await pool.query(
            'INSERT INTO night_skip_settings (server_id, minimum_voters, enabled, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [serverId, 5, enabled ? 1 : 0]
          );
        }

        const statusText = enabled ? '**enabled**' : '**disabled**';
        const previousStatus = currentSettings.enabled ? 'enabled' : 'disabled';

        await interaction.editReply({
          embeds: [successEmbed(
            'Night Skip Toggle Updated',
            `**${serverName}** night skip voting has been ${statusText}.\n\nPrevious status: ${previousStatus}`
          )]
        });
      }

    } catch (error) {
      console.error('Error in vote-skip-night command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', `Failed to update night skip settings: ${error.message}`)]
      });
    }
  }
}; 