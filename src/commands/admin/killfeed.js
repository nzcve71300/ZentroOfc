const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');
const { sendRconCommand } = require('../../rcon');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killfeed')
    .setDescription('Toggle killfeed on/off for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Enable or disable killfeed')
        .setRequired(true)
        .addChoices(
          { name: 'On', value: 'on' },
          { name: 'Off', value: 'off' }
        )),

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

      // Check if killfeed config exists
      let [killfeedResult] = await pool.query(
        'SELECT id, enabled, format_string FROM killfeed_configs WHERE server_id = ?',
        [serverId]
      );

      if (killfeedResult.length === 0) {
        // Create new killfeed config with default format
        const defaultFormat = '{Killer} ☠️ {Victim}';
        await pool.query(
          'INSERT INTO killfeed_configs (server_id, enabled, format_string) VALUES (?, ?, ?)',
          [serverId, option === 'on', defaultFormat]
        );
        [killfeedResult] = await pool.query(
          'SELECT id, enabled, format_string FROM killfeed_configs WHERE server_id = ?',
          [serverId]
        );
      }

      const killfeed = killfeedResult[0];
      const enabled = option === 'on';

      // Update killfeed status
      await pool.query(
        'UPDATE killfeed_configs SET enabled = ? WHERE id = ?',
        [enabled, killfeed.id]
      );

      // Get server connection info for RCON
      const [serverInfo] = await pool.query(
        'SELECT ip, port, password FROM rust_servers WHERE id = ?',
        [serverId]
      );

      if (serverInfo.length > 0) {
        const { ip, port, password } = serverInfo[0];
        
        if (enabled) {
          // Enable custom killfeed - disable game's default killfeed
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Hide"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Off"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Stop"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "false"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Disable"');
          console.log(`✅ Disabled game's default killfeed for ${serverName}`);
        } else {
          // Disable custom killfeed - enable game's default killfeed
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Show"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "On"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Start"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "true"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
          sendRconCommand(ip, port, password, 'oxide.call KillFeed "Enable"');
          console.log(`✅ Enabled game's default killfeed for ${serverName}`);
        }
      }

      const embed = successEmbed(
        'Killfeed Updated',
        `**${serverName}** killfeed has been **${enabled ? 'enabled' : 'disabled'}**.`
      );

      embed.addFields({
        name: '📋 Current Configuration',
        value: `**Status:** ${enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Format:** ${killfeed.format_string}`,
        inline: false
      });

      embed.addFields({
        name: '💡 Configuration',
        value: 'Use `/killfeed-setup` to customize the killfeed format.',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error updating killfeed:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to update killfeed. Please try again.')]
      });
    }
  },
}; 