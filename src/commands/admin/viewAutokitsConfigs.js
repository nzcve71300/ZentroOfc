const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-autokits-configs')
    .setDescription('View all autokit configurations for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
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

    // Check if user has administrator permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.editReply({
        embeds: [errorEmbed('Access Denied', 'You need administrator permissions to use this command.')]
      });
    }

    const serverOption = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Get server info
      const serverResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverOption]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      const serverId = serverResult.rows[0].id;
      const serverName = serverResult.rows[0].nickname;

      // Get all autokit configurations for this server
      const autokitsResult = await pool.query(
        'SELECT kit_name, enabled, cooldown, game_name FROM autokits WHERE server_id = $1 ORDER BY kit_name',
        [serverId]
      );

      if (autokitsResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [orangeEmbed(
            '📋 Autokit Configurations',
            `**Server:** ${serverName}\n\nNo autokit configurations found.\n\nUse \`/autokits-setup\` to configure autokits.`
          )]
        });
      }

      // Create embed
      const embed = orangeEmbed(
        '📋 Autokit Configurations',
        `**Server:** ${serverName}\n\n**Configured Kits:**`
      );

      // Define expected kit names in order
      const expectedKits = ['FREEkit1', 'FREEkit2', 'VIPkit', 'ELITEkit1', 'ELITEkit2', 'ELITEkit3', 'ELITEkit4', 'ELITEkit5'];
      
      // Create a map of existing configurations
      const configMap = {};
      autokitsResult.rows.forEach(row => {
        configMap[row.kit_name] = row;
      });

      // Show all expected kits, even if not configured
      for (const kitName of expectedKits) {
        const config = configMap[kitName];
        
        if (config) {
          const status = config.enabled ? '🟢' : '🔴';
          const cooldownText = config.cooldown > 0 ? `${config.cooldown}m` : 'No cooldown';
          
          embed.addFields({
            name: `${status} ${kitName}`,
            value: `**Status:** ${config.enabled ? 'Enabled' : 'Disabled'}\n**Cooldown:** ${cooldownText}\n**Kit Name:** ${config.game_name}`,
            inline: true
          });
        } else {
          embed.addFields({
            name: `⚪ ${kitName}`,
            value: '**Status:** Not configured\n**Cooldown:** N/A\n**Kit Name:** N/A',
            inline: true
          });
        }
      }

      embed.addFields({
        name: '💡 Configuration',
        value: 'Use `/autokits-setup` to configure these kits.',
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