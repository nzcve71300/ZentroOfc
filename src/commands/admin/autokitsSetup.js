const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autokits-setup')
    .setDescription('Configure autokits for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(TRUE)
        .setAutocomplete(TRUE))
    .addStringOption(option =>
      option.setName('setup')
        .setDescription('Select a kit to configure')
        .setRequired(TRUE)
        .addChoices(
          { name: 'FREEkit1', value: 'FREEkit1' },
          { name: 'FREEkit2', value: 'FREEkit2' },
          { name: 'VIPkit', value: 'VIPkit' },
          { name: 'ELITEkit1', value: 'ELITEkit1' },
          { name: 'ELITEkit2', value: 'ELITEkit2' },
          { name: 'ELITEkit3', value: 'ELITEkit3' },
          { name: 'ELITEkit4', value: 'ELITEkit4' },
          { name: 'ELITEkit5', value: 'ELITEkit5' }
        ))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('What to configure')
        .setRequired(TRUE)
        .addChoices(
          { name: 'Toggle On/Off', value: 'toggle' },
          { name: 'Set Cooldown (minutes)', value: 'cooldown' },
          { name: 'Set Kit Name', value: 'name' }
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('Value for the option (on/off, minutes, or kit name)')
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
    const value = interaction.options.getString('value');
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

      // Check if autokit exists
      let autokitResult = await pool.query(
        'SELECT id, enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
        [serverId, setup]
      );

      if (autokitResult.rows.length === 0) {
        // Create new autokit
        await pool.query(
          'INSERT INTO autokits (server_id, kit_name, enabled, cooldown, game_name) VALUES (?, ?, FALSE, 0, ?)',
          [serverId, setup]
        );
        autokitResult = await pool.query(
          'SELECT id, enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
          [serverId, setup]
        );
      }

      const autokit = autokitResult.rows[0];

      // Handle different options
      let updateField = '';
      let updateValue = null;
      let message = '';

      switch (option) {
        case 'toggle':
          const enabled = value.toLowerCase() === 'on' || value.toLowerCase() === 'TRUE' || value === '1';
          updateField = 'enabled';
          updateValue = enabled;
          message = `**${setup}** has been ${enabled ? 'enabled' : 'disabled'} on **${serverName}**.`;
          break;

        case 'cooldown':
          const cooldown = parseInt(value);
          if (isNaN(cooldown) || cooldown < 0) {
            return interaction.editReply({
              embeds: [errorEmbed('Invalid Cooldown', 'Cooldown must be a positive number in minutes.')]
            });
          }
          updateField = 'cooldown';
          updateValue = cooldown;
          message = `**${setup}** cooldown has been set to **${cooldown} minutes** on **${serverName}**.`;
          break;

        case 'name':
          if (value.trim().length === 0) {
            return interaction.editReply({
              embeds: [errorEmbed('Invalid Name', 'Kit name cannot be empty.')]
            });
          }
          updateField = 'game_name';
          updateValue = value.trim();
          message = `**${setup}** kit name has been set to **${value}** on **${serverName}**.`;
          break;

        default:
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Option', 'Invalid option specified.')]
          });
      }

      // Update the autokit
      await pool.query(
        `UPDATE autokits SET ${updateField} = ? WHERE id = ?`,
        [updateValue, autokit.id]
      );

      // Get updated autokit info
      const updatedResult = await pool.query(
        'SELECT enabled, cooldown, game_name FROM autokits WHERE id = ?',
        [autokit.id]
      );

      const updated = updatedResult.rows[0];

      const embed = successEmbed(
        'Autokit Configured',
        message
      );

      embed.addFields({
        name: '📋 Current Configuration',
        value: `**Status:** ${updated.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Cooldown:** ${updated.cooldown} minutes\n**Kit Name:** ${updated.game_name}`,
        inline: FALSE
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error configuring autokit:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to configure autokit. Please try again.')]
      });
    }
  },
}; 