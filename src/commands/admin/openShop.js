const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('open-shop')
    .setDescription('Create a shop on a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server or "All" for all servers')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      // Add "All" option
      const choices = [{ name: 'All Servers', value: 'All' }];

      if (focusedValue.toLowerCase() !== 'all') {
        const result = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 24',
          [guildId, `%${focusedValue}%`]
        );

        result.rows.forEach(row => {
          choices.push({
            name: row.nickname,
            value: row.nickname
          });
        });
      }

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const serverOption = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      if (serverOption === 'All') {
        // Get all servers in this guild
        const serversResult = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)',
          [guildId]
        );

        if (serversResult.rows.length === 0) {
          return interaction.editReply({
            embeds: [errorEmbed('No Servers', 'No servers found in this guild.')]
          });
        }

        const serverList = serversResult.rows.map(row => row.nickname).join(', ');

        await interaction.editReply({
          embeds: [successEmbed(
            'Shop Created',
            `You successfully created shops on all servers:\n\n**${serverList}**\n\nPlayers can now use \`/shop\` to browse and purchase items.`
          )]
        });
      } else {
        // Get specific server
        const serverResult = await pool.query(
          'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
          [guildId, serverOption]
        );

        if (serverResult.rows.length === 0) {
          return interaction.editReply({
            embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
          });
        }

        await interaction.editReply({
          embeds: [successEmbed(
            'Shop Created',
            `You successfully created a shop on server: **${serverOption}**\n\nPlayers can now use \`/shop\` to browse and purchase items.`
          )]
        });
      }

    } catch (error) {
      console.error('Error opening shop:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to create shop. Please try again.')]
      });
    }
  },
}; 