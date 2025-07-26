const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-autokits-configs')
    .setDescription('View autokit configurations for a server')
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
    const guildId = interaction.guildId;

    try {
      // Get all servers in this guild
      const serversResult = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1',
        [guildId]
      );

      if (serversResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed('Error', 'No servers found in this guild.')],
          ephemeral: true
        });
      }

      // Get autokits configs for all servers
      const configsResult = await pool.query(
        `SELECT ac.id, ac.name, ac.cooldown_hours, ac.role, rs.nickname as server_name
         FROM autokits_configs ac
         JOIN rust_servers rs ON ac.server_id = rs.id
         JOIN guilds g ON rs.guild_id = g.id
         WHERE g.discord_id = $1
         ORDER BY rs.nickname, ac.name`,
        [guildId]
      );

      if (configsResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed(
            '🔧 Autokits Configs',
            'No autokits configurations found.\n\nUse `/autokits-setup` to create configurations.'
          )],
          ephemeral: true
        });
      }

      // Group configs by server
      const configsByServer = {};
      configsResult.rows.forEach(row => {
        if (!configsByServer[row.server_name]) {
          configsByServer[row.server_name] = [];
        }
        configsByServer[row.server_name].push(row);
      });

      // Create response
      let response = '**🔧 Autokits Configurations:**\n\n';
      
      Object.keys(configsByServer).forEach(serverName => {
        response += `**${serverName}:**\n`;
        configsByServer[serverName].forEach(config => {
          const roleText = config.role ? ` (Role: <@&${config.role}>)` : '';
          response += `• **${config.name}:** ${config.cooldown_hours}h cooldown${roleText}\n`;
        });
        response += '\n';
      });

      await interaction.reply({
        embeds: [orangeEmbed('🔧 Autokits Configs', response)],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error fetching autokits configs:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to fetch autokits configurations. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 