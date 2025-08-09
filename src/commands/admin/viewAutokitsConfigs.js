const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-autokits-configs')
    .setDescription('View all autokit configurations for all servers')
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number to view (default: 1)')
        .setRequired(false)
        .setMinValue(1)),



  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, false);
    }

    const page = interaction.options.getInteger('page') || 1;
    const guildId = interaction.guildId;
    const itemsPerPage = 3; // Show 3 servers per page

    try {
      // Get all servers for this guild
      const [serversResult] = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? ORDER BY rs.nickname',
        [guildId]
      );

      if (serversResult.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            '📋 Autokit Configurations',
            'No servers found in this guild.\n\nUse `/setup-server` to add servers first.'
          )]
        });
      }

      // Calculate pagination
      const totalServers = serversResult.length;
      const totalPages = Math.ceil(totalServers / itemsPerPage);
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
             const serversOnPage = serversResult.slice(startIndex, endIndex);

      if (page > totalPages) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Page', `Page ${page} does not exist. There are ${totalPages} total pages.`)]
        });
      }

      // Create embed
      const embed = orangeEmbed(
        '📋 Autokit Configurations',
        `**Page ${page} of ${totalPages}**\n**Total Servers:** ${totalServers}\n\n**Server Configurations:**`
      );

      // Process each server on this page
      for (const server of serversOnPage) {
        // Get all autokit configurations for this server
        const [autokitsResult] = await pool.query(
          'SELECT kit_name, enabled, cooldown, game_name FROM autokits WHERE server_id = ? ORDER BY kit_name',
          [server.id]
        );

        // Define expected kit names in order
        const expectedKits = ['FREEkit1', 'FREEkit2', 'VIPkit', 'ELITEkit1', 'ELITEkit2', 'ELITEkit3', 'ELITEkit4', 'ELITEkit5', 'ELITEkit6', 'ELITEkit7', 'ELITEkit8', 'ELITEkit9', 'ELITEkit10', 'ELITEkit11', 'ELITEkit12', 'ELITEkit13'];
        
        // Create a map of existing configurations
        const configMap = {};
        autokitsResult.forEach(row => {
          configMap[row.kit_name] = row;
        });

        // Count configured kits
        let configuredCount = 0;
        let enabledCount = 0;
        for (const kitName of expectedKits) {
          if (configMap[kitName]) {
            configuredCount++;
            if (configMap[kitName].enabled) {
              enabledCount++;
            }
          }
        }

        // Add server summary
        embed.addFields({
          name: `🏠 ${server.nickname}`,
          value: `**Configured:** ${configuredCount}/16 kits\n**Enabled:** ${enabledCount} kits\n**Status:** ${configuredCount > 0 ? '🟢 Configured' : '⚪ Not configured'}`,
          inline: false
        });

        // Add detailed kit information for this server
        for (const kitName of expectedKits) {
          const config = configMap[kitName];
          
          if (config) {
            const status = config.enabled ? '🟢' : '🔴';
            const cooldownText = config.cooldown > 0 ? `${config.cooldown}m` : 'No cooldown';
            
            embed.addFields({
              name: `${status} ${kitName}`,
              value: `**Server:** ${server.nickname}\n**Status:** ${config.enabled ? 'Enabled' : 'Disabled'}\n**Cooldown:** ${cooldownText}\n**Kit Name:** ${config.game_name}`,
              inline: true
            });
          }
        }

        // Add separator between servers
        if (server !== serversOnPage[serversOnPage.length - 1]) {
          embed.addFields({
            name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            value: '',
            inline: false
          });
        }
      }

      // Add pagination info
      embed.addFields({
        name: '📄 Navigation',
        value: `Use \`/view-autokits-configs page:${page > 1 ? page - 1 : 1}\` for previous page\nUse \`/view-autokits-configs page:${page < totalPages ? page + 1 : totalPages}\` for next page`,
        inline: false
      });

      embed.addFields({
        name: '💡 Configuration',
        value: 'Use `/autokits-setup` to configure kits for specific servers.',
        inline: false
      });

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error viewing autokit configs:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to view autokit configurations. Please try again.')]
      });
    }
  },
}; 