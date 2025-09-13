const { SlashCommandBuilder } = require('discord.js');
const pool = require('../../db');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { sendRconCommand } = require('../../rcon');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('teleportkoth')
    .setDescription('Teleport player to KOTH gate')
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
      option.setName('player')
        .setDescription('Player name to teleport')
        .setRequired(true)),

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

        const [gates] = await pool.query(
          'SELECT gate_number, gate_name FROM koth_gates WHERE server_id = ? ORDER BY gate_number',
          [serverId]
        );

        const choices = gates
          .filter(gate => gate.gate_name.toLowerCase().includes(focusedOption.value.toLowerCase()))
          .map(gate => ({
            name: gate.gate_name,
            value: gate.gate_number.toString()
          }))
          .slice(0, 25);

        await interaction.respond(choices);
      }
    } catch (error) {
      console.error('Error in teleportkoth autocomplete:', error);
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
    const gateNumber = interaction.options.getString('gate');
    const playerName = interaction.options.getString('player');
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

      // Get KOTH gate coordinates
      const [gateResult] = await pool.query(
        'SELECT x_pos, y_pos, z_pos, gate_name FROM koth_gates WHERE server_id = ? AND gate_number = ?',
        [serverId, parseInt(gateNumber)]
      );

      if (gateResult.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Gate Not Found', 'The selected KOTH gate was not found.')]
        });
      }

      const gate = gateResult[0];
      const gateName = gate.gate_name || `KOTH Gate ${gateNumber}`;

      // Check if coordinates are valid (not 0,0,0)
      if (gate.x_pos === 0 && gate.y_pos === 0 && gate.z_pos === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Coordinates', 'KOTH gate coordinates are not set. Use `/manage-positions` to set coordinates first.')]
        });
      }

      // Execute teleport using the same format as OUTPOST and BANDITCAMP
      const teleportCommand = `global.teleportposrot "${gate.x_pos},${gate.y_pos},${gate.z_pos}" "${playerName}" "1"`;
      await sendRconCommand(server.ip, server.port, server.password, teleportCommand);
      
      // Send success message to server
      await sendRconCommand(server.ip, server.port, server.password, 
        `say <color=#FF69B4>${playerName}</color> <color=white>teleported to</color> <color=#800080>${gateName}</color> <color=white>by admin</color>`);

      await interaction.editReply({
        embeds: [successEmbed('Teleport Successful', `**${playerName}** has been teleported to **${gateName}** on **${serverName}**!`)]
      });

    } catch (error) {
      console.error('Error in teleportkoth command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Teleport Failed', error.message)]
      });
    }
  }
};
