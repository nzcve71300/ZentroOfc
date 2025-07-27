const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage-positions')
    .setDescription('Manage position coordinates')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true)),

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
      console.error('Error in manage-positions autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    const serverId = parseInt(interaction.options.getString('server'));
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

      // Create dropdown menu
      const row = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`position_select_${serverId}`)
            .setPlaceholder('Select a position to manage')
            .addOptions([
              {
                label: 'Outpost',
                description: 'Manage Outpost coordinates',
                value: 'outpost',
                emoji: '🏰'
              },
              {
                label: 'Bandit Camp',
                description: 'Manage Bandit Camp coordinates',
                value: 'banditcamp',
                emoji: '🏕️'
              }
            ])
        );

      await interaction.editReply({
        embeds: [orangeEmbed(
          'Position Management',
          `Select a position to manage coordinates for **${serverName}**`
        )],
        components: [row]
      });

    } catch (error) {
      console.error('Error in manage-positions command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to load position management. Please try again.')]
      });
    }
  }
}; 