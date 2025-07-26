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
    await interaction.deferReply();

    const serverNickname = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Get server ID
      const serverResult = await pool.query(
        'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverNickname]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply(orangeEmbed('Error', 'Server not found.'));
      }

      const serverId = serverResult.rows[0].id;

      // Get all autokits for this server
      const autokitsResult = await pool.query(
        'SELECT kit_name, enabled, cooldown, game_name FROM autokits WHERE server_id = $1 ORDER BY kit_name',
        [serverId]
      );

      if (autokitsResult.rows.length === 0) {
        return interaction.editReply(orangeEmbed(
          '🔧 Autokit Configurations',
          `No autokits configured for **${serverNickname}**.\n\nUse \`/autokits-setup\` to configure autokits.`
        ));
      }

      // Create configuration display
      let configText = `**${serverNickname}** Autokit Configurations:\n\n`;

      autokitsResult.rows.forEach(autokit => {
        const status = autokit.enabled ? '🟢' : '🔴';
        configText += `${status} **${autokit.kit_name}**\n`;
        configText += `   • **Status:** ${autokit.enabled ? 'Enabled' : 'Disabled'}\n`;
        configText += `   • **Cooldown:** ${autokit.cooldown} minutes\n`;
        configText += `   • **Kit Name:** ${autokit.game_name}\n\n`;
      });

      await interaction.editReply(orangeEmbed('🔧 Autokit Configurations', configText));

    } catch (error) {
      console.error('Error viewing autokit configs:', error);
      await interaction.editReply(orangeEmbed('Error', 'Failed to view autokit configurations. Please try again.'));
    }
  },
}; 