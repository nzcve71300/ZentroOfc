const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

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
      option.setName('action')
        .setDescription('Enable or disable killfeed')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guildId;

    try {
      if (focusedOption.name === 'server') {
        const value = focusedOption.value.toLowerCase();
        
        // Get servers for this guild
        const result = await pool.query(
          `SELECT rs.id, rs.nickname 
           FROM rust_servers rs 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = $1 AND rs.nickname ILIKE $2 
           ORDER BY rs.nickname 
           LIMIT 25`,
          [guildId, `%${value}%`]
        );

        const choices = result.rows.map(row => ({
          name: row.nickname,
          value: row.id.toString()
        }));

        await interaction.respond(choices);
      }
    } catch (error) {
      console.error('Error in autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    const serverId = interaction.options.getString('server');
    const option = interaction.options.getString('action');
    const guildId = interaction.guildId;

    console.log('All options:', interaction.options.data);
    console.log('Option value:', option);
    console.log('Option type:', typeof option);
    console.log('Raw option data:', JSON.stringify(interaction.options.data));

    try {
      // Verify server exists and belongs to this guild
      const serverResult = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = $1 AND rs.id = $2`,
        [guildId, serverId]
      );

      if (serverResult.rows.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found.')]
        });
      }

             const { nickname } = serverResult.rows[0];
       const enabled = option === 'on' || option === 'enable';

      console.log('Killfeed command - option:', option, 'enabled:', enabled);

      // Check if killfeed config already exists
      const existingResult = await pool.query(
        'SELECT id FROM killfeed_configs WHERE server_id = $1',
        [serverId]
      );

      if (existingResult.rows.length > 0) {
        // Update existing config
        await pool.query(
          'UPDATE killfeed_configs SET enabled = $1 WHERE server_id = $2',
          [enabled, serverId]
        );
        console.log('Updated existing killfeed config - enabled:', enabled);
             } else {
         // Create new config with default format
         await pool.query(
           'INSERT INTO killfeed_configs (server_id, format_string, enabled) VALUES ($1, $2, $3)',
           [serverId, '<color=#ff0000> {Killer} {KillerKD}<color=#99aab5> Killed<color=green> {Victim} {VictimKD}', enabled]
         );
         console.log('Created new killfeed config - enabled:', enabled);
       }

      // Verify the update worked
      const verifyResult = await pool.query(
        'SELECT enabled FROM killfeed_configs WHERE server_id = $1',
        [serverId]
      );
      console.log('Verification - database enabled value:', verifyResult.rows[0]?.enabled);

      const status = enabled ? '🟢 Enabled' : '🔴 Disabled';
      const embed = successEmbed(
        '🔫 Killfeed Status Updated',
        `**Server:** ${nickname}\n**Status:** ${status}\n\n${enabled ? '✅ Killfeed is now active and will show kill messages with K/D tracking!' : '❌ Killfeed is now disabled and will not show kill messages.'}`
      );

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error updating killfeed status:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to update killfeed status. Please try again.')]
      });
    }
  },
}; 