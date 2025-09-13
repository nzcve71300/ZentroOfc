const { SlashCommandBuilder } = require('discord.js');
const pool = require('../../db');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { removeKothEvent, createKothEvent, getKothGates } = require('../../systems/kothManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kothrestart')
    .setDescription('Quick restart KOTH event')
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
      console.error('Error in kothrestart autocomplete:', error);
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

      // Remove existing event
      try {
        await removeKothEvent(serverId);
      } catch (error) {
        // Event might not exist, continue
      }
      
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
      console.error('Error in kothrestart command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Restart Failed', error.message)]
      });
    }
  }
};
