const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { createKothEvent, startKothEvent, getKothEventStatus, removeKothEvent, getKothGates } = require('../../systems/kothManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('koth')
    .setDescription('KOTH event management')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Select action')
        .setRequired(true)
        .addChoices(
          { name: 'Join', value: 'join' },
          { name: 'Restart', value: 'restart' },
          { name: 'View', value: 'view' },
          { name: 'Remove', value: 'remove' },
          { name: 'Start', value: 'start' }
        ))
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('gate')
        .setDescription('Select KOTH gate (for start action)')
        .setRequired(false)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('event_name')
        .setDescription('Event name (for start action)')
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
      console.error('Error in koth autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, true);
    }

    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString('action');
    const serverId = interaction.options.getString('server');
    const guildId = interaction.guildId;

    try {
      // Verify server exists and belongs to this guild
      const [serverResult] = await pool.query(
        `SELECT rs.nickname, rs.ip, rs.port, rs.password
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

      const server = serverResult[0];
      const serverName = server.nickname;

      switch (action) {
        case 'join':
          await handleJoinAction(interaction, serverId, serverName);
          break;
        case 'restart':
          await handleRestartAction(interaction, serverId, serverName);
          break;
        case 'view':
          await handleViewAction(interaction, serverId, serverName);
          break;
        case 'remove':
          await handleRemoveAction(interaction, serverId, serverName);
          break;
        case 'start':
          await handleStartAction(interaction, serverId, serverName);
          break;
        default:
          await interaction.editReply({
            embeds: [errorEmbed('Invalid Action', 'Please select a valid action.')]
          });
      }
    } catch (error) {
      console.error('Error in koth command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An error occurred while processing the KOTH command.')]
      });
    }
  }
};

async function handleJoinAction(interaction, serverId, serverName) {
  try {
    const { joinKothEvent } = require('../../systems/kothManager');
    const playerName = interaction.user.username;
    
    await joinKothEvent(serverId, playerName);
    
    await interaction.editReply({
      embeds: [successEmbed('Joined KOTH Event', `You have successfully joined the KOTH event on **${serverName}**!`)]
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [errorEmbed('Join Failed', error.message)]
    });
  }
}

async function handleRestartAction(interaction, serverId, serverName) {
  try {
    // Remove existing event
    await removeKothEvent(serverId);
    
    // Get available gates
    const gates = await getKothGates(serverId);
    if (gates.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('No Gates Available', 'No KOTH gates are configured for this server. Use `/manage-positions` to set up gates first.')]
      });
    }

    // Create new event with first available gate
    const gate = gates[0];
    const event = await createKothEvent(serverId, gate.id, {
      eventName: 'KOTH Event',
      createdBy: interaction.user.username
    });

    await interaction.editReply({
      embeds: [successEmbed('KOTH Event Restarted', `KOTH event has been restarted on **${serverName}** at **${gate.gate_name}**!`)]
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [errorEmbed('Restart Failed', error.message)]
    });
  }
}

async function handleViewAction(interaction, serverId, serverName) {
  try {
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
    await interaction.editReply({
      embeds: [errorEmbed('View Failed', error.message)]
    });
  }
}

async function handleRemoveAction(interaction, serverId, serverName) {
  try {
    await removeKothEvent(serverId);
    
    await interaction.editReply({
      embeds: [successEmbed('KOTH Event Removed', `KOTH event has been removed from **${serverName}**.`)]
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [errorEmbed('Remove Failed', error.message)]
    });
  }
}

async function handleStartAction(interaction, serverId, serverName) {
  try {
    const gateId = interaction.options.getString('gate');
    const eventName = interaction.options.getString('event_name') || 'KOTH Event';
    const captureTime = interaction.options.getInteger('capture_time') || 300;
    const countdownTime = interaction.options.getInteger('countdown_time') || 60;
    const maxParticipants = interaction.options.getInteger('max_participants') || 50;
    const rewardAmount = interaction.options.getNumber('reward_amount') || 1000;
    const rewardCurrency = interaction.options.getString('reward_currency') || 'scrap';

    if (!gateId) {
      return interaction.editReply({
        embeds: [errorEmbed('Gate Required', 'Please select a KOTH gate to start the event.')]
      });
    }

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
    await interaction.editReply({
      embeds: [errorEmbed('Start Failed', error.message)]
    });
  }
}
