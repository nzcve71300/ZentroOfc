const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-positions')
    .setDescription('Configure position teleport settings')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('configs')
        .setDescription('Select the configuration to set')
        .setRequired(true)
        .addChoices(
          { name: 'Outpost - Set TP to work or not', value: 'outpost_enabled' },
          { name: 'Outpost - Add delay in seconds', value: 'outpost_delay' },
          { name: 'Outpost - Set time in minutes', value: 'outpost_time' },
          { name: 'Banditcamp - Set TP to work or not', value: 'banditcamp_enabled' },
          { name: 'Banditcamp - Add delay in seconds', value: 'banditcamp_delay' },
          { name: 'Banditcamp - Set time in minutes', value: 'banditcamp_time' }
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('Enter the value (on/off for enabled, number for delay/time)')
        .setRequired(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = $1 AND rs.nickname ILIKE $2 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
        name: row.nickname,
        value: row.id.toString()
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in set-positions autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    // Check if user has administrator permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'You need administrator permissions to use this command.')]
      });
    }

    const serverId = parseInt(interaction.options.getString('server'));
    const configs = interaction.options.getString('configs');
    const value = interaction.options.getString('value');
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const serverResult = await pool.query(
        `SELECT rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.id = $1 AND g.discord_id = $2`,
        [serverId, guildId]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const serverName = serverResult.rows[0].nickname;

      // Parse the config type and setting
      const [positionType, setting] = configs.split('_');
      
      // Validate and parse the value
      let parsedValue;
      if (setting === 'enabled') {
        const lowerValue = value.toLowerCase();
        if (lowerValue !== 'on' && lowerValue !== 'off') {
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Value', 'For enabled setting, use "on" or "off"')]
          });
        }
        parsedValue = lowerValue === 'on';
      } else if (setting === 'delay' || setting === 'time') {
        parsedValue = parseInt(value);
        if (isNaN(parsedValue) || parsedValue < 0) {
          return interaction.editReply({
            embeds: [errorEmbed('Invalid Value', `Please enter a valid number for ${setting}`)]
          });
        }
      }

      // Check if position config exists for this server
      const existingResult = await pool.query(
        'SELECT * FROM position_configs WHERE server_id = $1 AND position_type = $2',
        [serverId, positionType]
      );

      if (existingResult.rows.length > 0) {
        // Update existing config
        let updateQuery;
        let updateValue;

        if (setting === 'enabled') {
          updateQuery = 'UPDATE position_configs SET enabled = $1, updated_at = NOW() WHERE server_id = $2 AND position_type = $3';
          updateValue = parsedValue;
        } else if (setting === 'delay') {
          updateQuery = 'UPDATE position_configs SET delay_seconds = $1, updated_at = NOW() WHERE server_id = $2 AND position_type = $3';
          updateValue = parsedValue;
        } else if (setting === 'time') {
          updateQuery = 'UPDATE position_configs SET cooldown_minutes = $1, updated_at = NOW() WHERE server_id = $2 AND position_type = $3';
          updateValue = parsedValue;
        }

        await pool.query(updateQuery, [updateValue, serverId, positionType]);
      } else {
        // Create new config
        await pool.query(
          `INSERT INTO position_configs 
           (server_id, position_type, enabled, delay_seconds, cooldown_minutes, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            serverId, 
            positionType, 
            setting === 'enabled' ? parsedValue : true,
            setting === 'delay' ? parsedValue : 5,
            setting === 'time' ? parsedValue : 10
          ]
        );
      }

      const positionDisplayName = positionType === 'outpost' ? 'Outpost' : 'Bandit Camp';
      const settingDisplayName = setting === 'enabled' ? 'Teleport' : 
                                setting === 'delay' ? 'Delay (seconds)' : 'Cooldown Time (minutes)';

      await interaction.editReply({
        embeds: [successEmbed(
          'Position Configuration Updated',
          `**${positionDisplayName}** ${settingDisplayName} has been set to **${value}** for **${serverName}**`
        )]
      });

    } catch (error) {
      console.error('Error in set-positions command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to update position configuration. Please try again.')]
      });
    }
  }
}; 