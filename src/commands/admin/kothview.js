const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { getKothEventStatus } = require('../../systems/kothManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kothview')
    .setDescription('Quick view KOTH event status')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [result] = await pool.query(
        `SELECT rs.id, rs.nickname 
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE g.discord_id = ? AND rs.nickname LIKE ? 
         ORDER BY rs.nickname 
         LIMIT 25`,
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.id.toString()
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in kothview autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, true);
    }

    await interaction.deferReply({ ephemeral: true });

    const serverId = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const [serverResult] = await pool.query(
        `SELECT rs.nickname
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.id = ? AND g.discord_id = ?`,
        [parseInt(serverId), guildId]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const serverName = serverResult[0].nickname;
      const eventStatus = await getKothEventStatus(serverId);
      
      if (!eventStatus) {
        return interaction.editReply({
          embeds: [orangeEmbed('No Active Event', `There is no active KOTH event on **${serverName}**.`)]
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle(`KOTH Event Status - ${serverName}`)
        .addFields(
          { name: 'Event Name', value: eventStatus.event_name, inline: true },
          { name: 'Status', value: eventStatus.status.toUpperCase(), inline: true },
          { name: 'Gate', value: eventStatus.gate_name, inline: true },
          { name: 'Current King', value: eventStatus.current_king || 'None', inline: true },
          { name: 'Participants', value: eventStatus.participantCount.toString(), inline: true },
          { name: 'Max Participants', value: eventStatus.max_participants.toString(), inline: true },
          { name: 'Capture Time', value: `${eventStatus.capture_time_seconds}s`, inline: true },
          { name: 'Reward', value: `${eventStatus.reward_amount} ${eventStatus.reward_currency}`, inline: true }
        );

      if (eventStatus.status === 'countdown') {
        const timeLeft = Math.max(0, eventStatus.countdown_seconds - Math.floor((new Date() - new Date(eventStatus.event_start_time)) / 1000));
        embed.addFields({ name: 'Countdown', value: `${timeLeft}s remaining`, inline: true });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in kothview command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('View Failed', error.message)]
      });
    }
  }
};
