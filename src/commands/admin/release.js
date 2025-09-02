const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { sendRconCommand } = require('../../rcon/index');
const prisonSystem = require('../../utils/prisonSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('release')
    .setDescription('Release a player from prison')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Player name to release')
        .setRequired(true)),

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
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in release autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // Check if user has admin permissions
    if (!hasAdminPermissions(interaction.member)) {
      return sendAccessDeniedMessage(interaction, true);
    }

    await interaction.deferReply({ ephemeral: true });

    const serverName = interaction.options.getString('server');
    const playerName = interaction.options.getString('player');
    const guildId = interaction.guildId;

    try {
      // Get server information
      const [serverResult] = await pool.query(
        `SELECT rs.id, rs.nickname, rs.ip, rs.port, rs.password
         FROM rust_servers rs 
         JOIN guilds g ON rs.guild_id = g.id 
         WHERE rs.nickname = ? AND g.discord_id = ?`,
        [serverName, guildId]
      );

      if (serverResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The selected server was not found in this guild.')]
        });
      }

      const server = serverResult[0];
      const serverId = server.id;

      // Check if player is in prison
      const isInPrison = await prisonSystem.isPlayerInPrison(serverId, playerName);
      if (!isInPrison) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Not in Prison', `${playerName} is not currently in prison.`)]
        });
      }

      // Get prisoner information
      const prisonerInfo = await prisonSystem.getPrisonerInfo(serverId, playerName);
      if (!prisonerInfo) {
        return interaction.editReply({
          embeds: [errorEmbed('Prisoner Info Not Found', 'Could not retrieve prisoner information.')]
        });
      }

      // Release the prisoner
      console.log(`[RELEASE DEBUG] Attempting to release ${playerName} from server ${serverId} (${serverName})`);
      const success = await prisonSystem.releasePrisoner(serverId, playerName, interaction.user.username);
      console.log(`[RELEASE DEBUG] Release result: ${success}`);
      
      if (!success) {
        return interaction.editReply({
          embeds: [errorEmbed('Failed to Release Player', 'An error occurred while releasing the player from prison.')]
        });
      }

      // Stop monitoring the prisoner
      await prisonSystem.stopPrisonerMonitoring(serverId, playerName);

      // Send message to game
      await sendRconCommand(
        server.ip,
        server.port,
        server.password,
        `say <color=#FF69B4>[Prison]</color> <color=white>${playerName} has been released from prison by ${interaction.user.username}!</color>`
      );

      // Create success embed
      const sentenceType = prisonerInfo.sentence_type === 'temporary' ? 'Temporary' : 'Life';
      const sentenceInfo = prisonerInfo.sentence_type === 'temporary' 
        ? `${prisonerInfo.sentence_minutes} minutes` 
        : 'Life imprisonment';

      const embed = successEmbed(
        'Player Released from Prison',
        `**${playerName}** has been successfully released from prison.\n\n` +
        `**Details:**\n` +
        `• Server: ${serverName}\n` +
        `• Cell: ${prisonerInfo.cell_number}\n` +
        `• Original Sentence: ${sentenceType} (${sentenceInfo})\n` +
        `• Sentenced By: ${prisonerInfo.sentenced_by}\n` +
        `• Released By: ${interaction.user.username}\n` +
        `• Time Served: ${formatTimeServed(prisonerInfo.sentenced_at)}`
      );

      await interaction.editReply({ embeds: [embed] });

      // Log to admin feed
      const client = interaction.client;
      await sendFeedEmbed(client, guildId, serverName, 'adminfeed', 
        `🔓 **Prison Release:** ${interaction.user.username} released ${playerName} from prison (was serving ${sentenceInfo})`);

    } catch (error) {
      console.error('Error in release command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An error occurred while processing the command.')]
      });
    }
  }
};

function formatTimeServed(sentencedAt) {
    const now = new Date();
    const sentenced = new Date(sentencedAt);
    const diffMs = now - sentenced;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      const hours = Math.floor((diffMinutes % 1440) / 60);
      return `${days}d ${hours}h`;
    }
  }

// Helper function to send feed embed (if not already imported)
async function sendFeedEmbed(client, guildId, serverName, feedType, message) {
  try {
    const [channelResult] = await pool.query(
      `SELECT channel_id FROM channel_settings 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND server_name = ? AND type = ?`,
      [guildId, serverName, feedType]
    );

    if (channelResult.length > 0) {
      const channel = client.channels.cache.get(channelResult[0].channel_id);
      if (channel) {
        await channel.send(message);
      }
    }
  } catch (error) {
    console.error('Error sending feed embed:', error);
  }
}
