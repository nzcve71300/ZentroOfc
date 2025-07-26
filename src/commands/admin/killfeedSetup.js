const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killfeed-setup')
    .setDescription('Customize killfeed format for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('format')
        .setDescription('Killfeed format string (use {Victim}, {Killer}, {VictimKD}, {KillerKD}, etc.)')
        .setRequired(true))
    // Temporarily removed randomizer option until database is fixed
    // .addStringOption(option =>
    //   option.setName('randomizer')
    //     .setDescription('Enable or disable kill phrase randomizer')
    //     .setRequired(true)
    //     .addChoices(
    //       { name: 'Enable', value: 'enable' },
    //       { name: 'Disable', value: 'disable' }
    //     )),

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
    const formatString = interaction.options.getString('format');
    // const randomizer = interaction.options.getString('randomizer'); // Temporarily removed
    const guildId = interaction.guildId;

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

      // Check if killfeed config already exists
      const existingResult = await pool.query(
        'SELECT id FROM killfeed_configs WHERE server_id = $1',
        [serverId]
      );

      // const randomizerEnabled = randomizer === 'enable'; // Temporarily removed
      
      if (existingResult.rows.length > 0) {
        // Update existing config (without randomizer for now)
        await pool.query(
          'UPDATE killfeed_configs SET format_string = $1, enabled = true WHERE server_id = $2',
          [formatString, serverId]
        );
      } else {
        // Create new config (without randomizer for now)
        await pool.query(
          'INSERT INTO killfeed_configs (server_id, format_string, enabled) VALUES ($1, $2, true)',
          [serverId, formatString]
        );
      }

      // Create success embed with format preview
      const embed = successEmbed(
        '🔫 Killfeed Setup Complete',
        `**Server:** ${nickname}\n**Format:** ${formatString}\n\n**Available Variables:**\n• \`{Victim}\` - Victim's name\n• \`{Killer}\` - Killer's name\n• \`{VictimKD}\` - Victim's K/D ratio\n• \`{KillerKD}\` - Killer's K/D ratio\n• \`{KillerStreak}\` - Killer's current kill streak\n• \`{VictimStreak}\` - Victim's current kill streak\n• \`{VictimHighest}\` - Victim's highest kill streak\n• \`{KillerHighest}\` - Killer's highest kill streak\n\n**Example Formats:**\n• \`{Killer} killed {Victim} (KD: {KillerKD})\`\n• \`💀 {Killer} → {Victim} (Streak: {KillerStreak})\`\n• \`{Victim} was killed by {Killer} (Highest: {KillerHighest})\`\n\n✅ Killfeed has been configured and enabled!\n\n**Note:** NPC/Animal kills decrease K/D and reset streaks!`
      );

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Error setting up killfeed:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to setup killfeed. Please try again.')]
      });
    }
  },
}; 