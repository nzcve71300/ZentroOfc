const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../../db');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { createKothEvent, startKothEvent, getKothGates } = require('../../systems/kothManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('startkothevent')
    .setDescription('Start a KOTH event manually')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('gate')
        .setDescription('Select KOTH gate')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('event_name')
        .setDescription('Event name')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('capture_time')
        .setDescription('Capture time in seconds (default: 300)')
        .setRequired(false)
        .setMinValue(60)
        .setMaxValue(1800))
    .addIntegerOption(option =>
      option.setName('countdown_time')
        .setDescription('Countdown time in seconds (default: 60)')
        .setRequired(false)
        .setMinValue(10)
        .setMaxValue(300))
    .addIntegerOption(option =>
      option.setName('max_participants')
        .setDescription('Maximum participants (default: 50)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100))
    .addNumberOption(option =>
      option.setName('reward_amount')
        .setDescription('Reward amount (default: 1000)')
        .setRequired(false)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('reward_currency')
        .setDescription('Reward currency (default: scrap)')
        .setRequired(false)
        .addChoices(
          { name: 'Scrap', value: 'scrap' },
          { name: 'Wood', value: 'wood' },
          { name: 'Stone', value: 'stone' },
          { name: 'Metal', value: 'metal' },
          { name: 'Sulfur', value: 'sulfur' }
        )),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guildId;

    try {
      if (focusedOption.name === 'server') {
        const [result] = await pool.query(
          `SELECT rs.id, rs.nickname 
           FROM rust_servers rs 
           JOIN guilds g ON rs.guild_id = g.id 
           WHERE g.discord_id = ? AND rs.nickname LIKE ? 
           ORDER BY rs.nickname 
           LIMIT 25`,
          [guildId, `%${focusedOption.value}%`]
        );

        const choices = result.map(row => ({
          name: row.nickname,
          value: row.id.toString()
        }));

        await interaction.respond(choices);
      } else if (focusedOption.name === 'gate') {
        const serverId = interaction.options.getString('server');
        if (!serverId) {
          await interaction.respond([]);
          return;
        }

        const gates = await getKothGates(serverId);
        const choices = gates
          .filter(gate => gate.gate_name.toLowerCase().includes(focusedOption.value.toLowerCase()))
          .map(gate => ({
            name: gate.gate_name,
            value: gate.id.toString()
          }))
          .slice(0, 25);

        await interaction.respond(choices);
      }
    } catch (error) {
      console.error('Error in startkothevent autocomplete:', error);
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
    const gateId = interaction.options.getString('gate');
    const eventName = interaction.options.getString('event_name') || 'KOTH Event';
    const captureTime = interaction.options.getInteger('capture_time') || 300;
    const countdownTime = interaction.options.getInteger('countdown_time') || 60;
    const maxParticipants = interaction.options.getInteger('max_participants') || 50;
    const rewardAmount = interaction.options.getNumber('reward_amount') || 1000;
    const rewardCurrency = interaction.options.getString('reward_currency') || 'scrap';
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

      // Create the event
      const event = await createKothEvent(serverId, parseInt(gateId), {
        eventName,
        captureTime,
        countdownTime,
        maxParticipants,
        rewardAmount,
        rewardCurrency,
        createdBy: interaction.user.username
      });

      // Start the event
      await startKothEvent(serverId);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('KOTH Event Started!')
        .setDescription(`**${eventName}** has started on **${serverName}**!`)
        .addFields(
          { name: 'Gate', value: event.gate_name, inline: true },
          { name: 'Countdown', value: `${countdownTime}s`, inline: true },
          { name: 'Capture Time', value: `${captureTime}s`, inline: true },
          { name: 'Max Participants', value: maxParticipants.toString(), inline: true },
          { name: 'Reward', value: `${rewardAmount} ${rewardCurrency}`, inline: true }
        )
        .setFooter({ text: 'Use /koth join to participate!' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in startkothevent command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Start Failed', error.message)]
      });
    }
  }
};
