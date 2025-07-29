const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-events')
    .setDescription('Configure Bradley and Helicopter event settings')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(TRUE)
        .setAutocomplete(TRUE))
    .addStringOption(option =>
      option.setName('event')
        .setDescription('Select an event type')
        .setRequired(TRUE)
        .addChoices(
          { name: 'Bradley APC', value: 'bradley' },
          { name: 'Patrol Helicopter', value: 'helicopter' }
        ))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Select configuration option')
        .setRequired(TRUE)
        .addChoices(
          { name: 'Brad Scout (On/Off)', value: 'bradscout' },
          { name: 'Brad Kill Message', value: 'bradkillmsg' },
          { name: 'Brad Respawn Message', value: 'bradrespawnmsg' },
          { name: 'Heli Scout (On/Off)', value: 'heliscout' },
          { name: 'Heli Kill Message', value: 'helikillmsg' },
          { name: 'Heli Respawn Message', value: 'helirespawnmsg' }
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('Value for the option (on/off for scouts, text for messages)')
        .setRequired(TRUE)
        .setMaxLength(200)),

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

      // Add "All" option
      choices.unshift({
        name: 'All Servers',
        value: 'ALL'
      });

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
    const eventType = interaction.options.getString('event');
    const option = interaction.options.getString('option');
    const value = interaction.options.getString('value');
    const guildId = interaction.guildId;

    try {
      // Handle "ALL" servers option
      if (serverOption === 'ALL') {
        const allServersResult = await pool.query(
          'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ?',
          [guildId]
        );

        if (allServersResult.rows.length === 0) {
          return interaction.editReply({
            embeds: [errorEmbed('No Servers Found', 'No servers found in this guild.')]
          });
        }

        const results = [];
        let totalUpdated = 0;

        for (const server of allServersResult.rows) {
          const result = await updateEventConfig(server.id, eventType, option, value);
          results.push(`**${server.nickname}**: ${result}`);
          if (result.includes('updated')) totalUpdated++;
        }

        return interaction.editReply({
          embeds: [successEmbed(
            'Events Configuration Updated',
            `Updated **${totalUpdated}** out of **${allServersResult.rows.length}** servers.\n\n**Results:**\n${results.join('\n')}`
          )]
        });
      }

      // Single server
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

      const result = await updateEventConfig(serverId, eventType, option, value);

      await interaction.editReply({
        embeds: [successEmbed(
          'Event Configuration Updated',
          `**Server:** ${serverName}\n**Event:** ${eventType}\n**Option:** ${option}\n**Value:** ${value}\n\n${result}`
        )]
      });

    } catch (error) {
      console.error('Error setting event configuration:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to set event configuration. Please try again.')]
      });
    }
  },
};

async function updateEventConfig(serverId, eventType, option, value) {
  // Check if event config exists
  let configResult = await pool.query(
    'SELECT id FROM event_configs WHERE server_id = ? AND event_type = ?',
    [serverId, eventType]
  );

  if (configResult.rows.length === 0) {
    // Create default config
    await pool.query(
      'INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message) VALUES (?, ?, ?, ?, ?)',
      [
        serverId,
        eventType,
        FALSE,
        eventType === 'bradley' ? '<color=#00ffff>Brad got taken</color>' : '<color=#00ffff>Heli got taken</color>',
        eventType === 'bradley' ? '<color=#00ffff>Bradley APC has respawned</color>' : '<color=#00ffff>Patrol Helicopter has respawned</color>'
      ]
    );
  }

  // Update based on option
  switch (option) {
    case 'bradscout':
    case 'heliscout':
      const enabled = value.toLowerCase() === 'on' || value.toLowerCase() === 'TRUE' || value === '1';
      await pool.query(
        'UPDATE event_configs SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND event_type = ?',
        [enabled, serverId, eventType]
      );
      return `Scout ${enabled ? 'enabled' : 'disabled'} successfully.`;

    case 'bradkillmsg':
    case 'helikillmsg':
      await pool.query(
        'UPDATE event_configs SET kill_message = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND event_type = ?',
        [value, serverId, eventType]
      );
      return `Kill message updated successfully.`;

    case 'bradrespawnmsg':
    case 'helirespawnmsg':
      await pool.query(
        'UPDATE event_configs SET respawn_message = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND event_type = ?',
        [value, serverId, eventType]
      );
      return `Respawn message updated successfully.`;

    default:
      throw new Error('Invalid option');
  }
} 