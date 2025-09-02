const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../../db');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { sendRconCommand } = require('../../rcon/index');
const prisonSystem = require('../../utils/prisonSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('life-sentence')
    .setDescription('Imprison a player permanently until manually released')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('cell')
        .setDescription('Prison cell number (1-6)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(6))
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Player name to imprison')
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
      console.error('Error in life-sentence autocomplete:', error);
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
    const cellNumber = interaction.options.getInteger('cell');
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

      // Check if prison system is enabled
      if (!(await prisonSystem.isPrisonEnabled(serverId))) {
        return interaction.editReply({
          embeds: [errorEmbed('Prison System Disabled', 'The prison system is not enabled for this server. Use `/set Prison-System on` to enable it.')]
        });
      }

      // Check if prison cell exists
      const cellCoords = await prisonSystem.getPrisonCellCoordinates(serverId, cellNumber);
      if (!cellCoords) {
        return interaction.editReply({
          embeds: [errorEmbed('Prison Cell Not Found', `Prison cell ${cellNumber} has not been set up. Use `/manage-positions` to set up prison cell positions.`)]
        });
      }

      // Check if player is already in prison
      const isAlreadyInPrison = await prisonSystem.isPlayerInPrison(serverId, playerName);
      if (isAlreadyInPrison) {
        return interaction.editReply({
          embeds: [errorEmbed('Player Already Imprisoned', `${playerName} is already in prison. Use `/release` to release them first.`)]
        });
      }

      // Get player's Discord ID if they're linked
      let discordId = null;
      const [playerResult] = await pool.query(
        'SELECT discord_id FROM players WHERE server_id = ? AND LOWER(ign) = LOWER(?) AND is_active = TRUE',
        [serverId, playerName]
      );
      if (playerResult.length > 0) {
        discordId = playerResult[0].discord_id;
      }

      // Add player to prison with life sentence
      const success = await prisonSystem.addPrisoner(
        serverId,
        playerName,
        discordId,
        cellNumber,
        'life',
        null, // No minutes for life sentence
        interaction.user.username
      );

      if (!success) {
        return interaction.editReply({
          embeds: [errorEmbed('Failed to Imprison Player', 'An error occurred while adding the player to prison.')]
        });
      }

      // Start monitoring the prisoner
      await prisonSystem.startPrisonerMonitoring(
        serverId,
        playerName,
        cellNumber,
        server.ip,
        server.port,
        server.password
      );

      // Request player position and teleport to prison
      const stateKey = `${guildId}:${serverName}:${playerName}`;
      prisonPositionState.set(stateKey, {
        step: 'waiting_for_position',
        player: playerName,
        cellNumber: cellNumber,
        timestamp: Date.now()
      });

      // Send position request command
      await sendRconCommand(server.ip, server.port, server.password, `printpos "${playerName}"`);
      
      // Set timeout to clean up state after 30 seconds
      setTimeout(() => {
        const currentState = prisonPositionState.get(stateKey);
        if (currentState && currentState.step === 'waiting_for_position') {
          console.log(`[PRISON] Position request timeout for ${playerName}, cleaning up state`);
          prisonPositionState.delete(stateKey);
        }
      }, 30000);

      // Send message to game
      await sendRconCommand(
        server.ip,
        server.port,
        server.password,
        `say <color=#FF69B4>[Prison]</color> <color=white>${playerName} was sentenced to life imprisonment!</color>`
      );

      // Create success embed
      const embed = successEmbed(
        'Player Given Life Sentence',
        `**${playerName}** has been sentenced to **life imprisonment**.\n\n` +
        `**Details:**\n` +
        `• Server: ${serverName}\n` +
        `• Cell: ${cellNumber}\n` +
        `• Sentence: Life imprisonment\n` +
        `• Release: Manual release only\n` +
        `• Sentenced By: ${interaction.user.username}\n\n` +
        `**Note:** This player will remain in prison until manually released with `/release`.`
      );

      await interaction.editReply({ embeds: [embed] });

      // Log to admin feed
      const client = interaction.client;
      await sendFeedEmbed(client, guildId, serverName, 'adminfeed', 
        `🔒 **Life Sentence:** ${interaction.user.username} sentenced ${playerName} to life imprisonment in cell ${cellNumber}`);

    } catch (error) {
      console.error('Error in life-sentence command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error', 'An error occurred while processing the command.')]
      });
    }
  }
};

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
