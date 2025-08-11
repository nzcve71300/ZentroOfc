const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { decrementActiveServers } = require('../../utils/subscriptionSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-server')
    .setDescription('Remove a Rust server from the bot')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server to remove')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.respond([]);
    }

    const focusedValue = interaction.options.getFocused();

    try {
      // Show all servers that match the search term
      const [result] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE nickname LIKE ? ORDER BY nickname LIMIT 25',
        [`%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: `${row.nickname}`,
        value: row.id.toString()
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Check if user has admin permissions (Zentro Admin role or Administrator)
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, true);
    }

    const serverId = interaction.options.getString('server');
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    try {
      // Get server details
      const [serverResult] = await pool.query(
        'SELECT id, nickname, ip, port, guild_id FROM rust_servers WHERE id = ?',
        [serverId]
      );

      if (serverResult.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('Error', 'Server not found.')],
          ephemeral: true
        });
      }

      const server = serverResult[0];
      const serverName = server.nickname;

      // Check if user has permission to remove this server
      const serverGuildId = server.guild_id;
      if (serverGuildId) {
        // Get the Discord guild ID for this server
        const [guildResult] = await pool.query(
          'SELECT discord_id FROM guilds WHERE id = ?',
          [serverGuildId]
        );
        
        if (guildResult.length > 0 && guildResult[0].discord_id !== guildId) {
          return interaction.reply({
            embeds: [errorEmbed('Permission Denied', 'You can only remove servers from your own guild.')],
            ephemeral: true
          });
        }
      }

      // Create confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⚠️ Confirm Server Removal')
        .setDescription(`Are you sure you want to remove **${serverName}**?`)
                          .addFields(
            { name: 'Server ID', value: server.id.toString(), inline: true },
            { name: 'Guild ID', value: (server.guild_id ? server.guild_id.toString() : 'Global'), inline: true },
            { name: '⚠️ Warning', value: 'This action will permanently delete:\n• Server configuration\n• All player data\n• Economy data\n• Shop items\n• All associated data', inline: false }
          )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

      // Create confirmation buttons
      const confirmRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_remove_${serverId}`)
            .setLabel('✅ Confirm Removal')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`cancel_remove_${serverId}`)
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({
        embeds: [confirmEmbed],
        components: [confirmRow],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in remove-server command:', error);
      await interaction.reply({
        embeds: [errorEmbed('Error', 'Failed to process server removal. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 