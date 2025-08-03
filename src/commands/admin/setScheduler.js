const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-scheduler')
    .setDescription('Set scheduled message pairs for in-game display')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('pair')
        .setDescription('Select message pair number')
        .setRequired(true)
        .addChoices(
          { name: 'Pair 1', value: '1' },
          { name: 'Pair 2', value: '2' },
          { name: 'Pair 3', value: '3' },
          { name: 'Pair 4', value: '4' },
          { name: 'Pair 5', value: '5' },
          { name: 'Pair 6', value: '6' }
        ))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Select which message to set')
        .setRequired(true)
        .addChoices(
          { name: 'Message 1', value: '1' },
          { name: 'Message 2', value: '2' }
        ))
    .addStringOption(option =>
      option.setName('input')
        .setDescription('Enter your message (supports color tags)')
        .setRequired(true)),

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
    await interaction.deferReply({ flags: 64 });
    if (!hasAdminPermissions(interaction.member)) return sendAccessDeniedMessage(interaction, false);

    const guildId = interaction.guildId;
    const serverName = interaction.options.getString('server');
    const pairNumber = interaction.options.getString('pair');
    const messageNumber = interaction.options.getString('message');
    const messageText = interaction.options.getString('input');

    try {
      const server = await getServerByNickname(guildId, serverName);
      if (!server) {
        return interaction.editReply({ embeds: [errorEmbed('Server Not Found', 'This server does not exist.')] });
      }

      // Check if this pair already exists
      const [existingResult] = await pool.query(
        'SELECT * FROM scheduler_messages WHERE server_id = ? AND pair_number = ?',
        [server.id, pairNumber]
      );

      if (existingResult.length > 0) {
        // Update existing pair
        const updateField = messageNumber === '1' ? 'message1' : 'message2';
        await pool.query(
          `UPDATE scheduler_messages SET ${updateField} = ? WHERE server_id = ? AND pair_number = ?`,
          [messageText, server.id, pairNumber]
        );

        await interaction.editReply({
          embeds: [successEmbed(
            'Message Updated',
            `Updated Message ${messageNumber} for Pair ${pairNumber} on ${server.nickname}`
          )]
        });
      } else {
        // Create new pair
        const message1 = messageNumber === '1' ? messageText : '';
        const message2 = messageNumber === '2' ? messageText : '';
        
        await pool.query(
          'INSERT INTO scheduler_messages (server_id, pair_number, message1, message2) VALUES (?, ?, ?, ?)',
          [server.id, pairNumber, message1, message2]
        );

        await interaction.editReply({
          embeds: [successEmbed(
            'Message Pair Created',
            `Created Pair ${pairNumber} with Message ${messageNumber} on ${server.nickname}`
          )]
        });
      }
    } catch (err) {
      console.error('Error in set-scheduler:', err);
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Failed to set scheduler message. Please try again.')] });
    }
  }
}; 