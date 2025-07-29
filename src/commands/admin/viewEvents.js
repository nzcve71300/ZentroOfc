const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-events')
    .setDescription('View Bradley and Helicopter event configurations')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true)),

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
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const serverOption = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Handle "ALL" servers option
      if (serverOption === 'ALL') {
        const [allServersResult] = await pool.query(
          'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ?',
          [guildId]
        );

        if (allServersResult.length === 0) {
          return interaction.editReply({
            embeds: [errorEmbed('No Servers Found', 'No servers found in this guild.')]
          });
        }

        const embed = orangeEmbed(
          '🎯 Event Configurations Overview',
          `**Total Servers:** ${allServersResult.length}\n\n**Server Configurations:**`
        );

        for (const server of allServersResult.rows) {
          const [configsResult] = await pool.query(
            'SELECT event_type, enabled, kill_message, respawn_message FROM event_configs WHERE server_id = ? ORDER BY event_type',
            [server.id]
          );

          let serverConfig = `**${server.nickname}**:\n`;
          
          if (configsResult.length === 0) {
            serverConfig += 'No event configurations found.\n';
          } else {
            for (const config of configsResult.rows) {
              const status = config.enabled ? '🟢 ON' : '🔴 OFF';
              const eventName = config.event_type === 'bradley' ? 'Bradley APC' : 'Patrol Helicopter';
              serverConfig += `• **${eventName}**: ${status}\n`;
              serverConfig += `  Kill: \`${config.kill_message}\`\n`;
              serverConfig += `  Respawn: \`${config.respawn_message}\`\n`;
            }
          }
          
          embed.addFields({
            name: server.nickname,
            value: serverConfig,
            inline: false
          });
        }

        embed.addFields({
          name: '📋 Instructions',
          value: 'Use `/set-events` to configure event settings for each server.',
          inline: false
        });

        await interaction.editReply({
          embeds: [embed]
        });
        return;
      }

      // Single server
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

      // Get event configurations
      const [configsResult] = await pool.query(
        'SELECT event_type, enabled, kill_message, respawn_message FROM event_configs WHERE server_id = ? ORDER BY event_type',
        [serverId]
      );

      const embed = orangeEmbed(
        '🎯 Event Configurations',
        `**Server:** ${serverName}\n\n**Current Settings:**`
      );

      if (configsResult.length === 0) {
        embed.addFields({
          name: 'No Configurations',
          value: 'No event configurations found for this server. Use `/set-events` to create configurations.',
          inline: false
        });
      } else {
        for (const config of configsResult.rows) {
          const status = config.enabled ? '🟢 ON' : '🔴 OFF';
          const eventName = config.event_type === 'bradley' ? 'Bradley APC' : 'Patrol Helicopter';
          
          embed.addFields({
            name: `${eventName} (${status})`,
            value: `**Kill Message:** \`${config.kill_message}\`\n**Respawn Message:** \`${config.respawn_message}\``,
            inline: false
          });
        }
      }

      embed.addFields({
        name: '📋 Configuration Options',
        value: '• **bradscout/heliscout**: `on` or `off`\n• **bradkillmsg/helikillmsg**: Custom kill message\n• **bradrespawnmsg/helirespawnmsg**: Custom respawn message',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error viewing event configurations:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to view event configurations. Please try again.')]
      });
    }
  },
}; 