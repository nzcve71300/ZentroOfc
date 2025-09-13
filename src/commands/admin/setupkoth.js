const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../../db');
const { errorEmbed, successEmbed } = require('../../embeds/format');
const { hasAdminPermissions, sendAccessDeniedMessage } = require('../../utils/permissions');
const { createKothGate } = require('../../systems/kothManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupkoth')
    .setDescription('Setup the KOTH system')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('gate_count')
        .setDescription('Number of gates to create (default: 12)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)),

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
      console.error('Error in setupkoth autocomplete:', error);
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
    const gateCount = interaction.options.getInteger('gate_count') || 12;
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

      // Create KOTH configuration
      await pool.query(`
        INSERT INTO koth_config (server_id, enabled, default_capture_time, default_countdown_time, default_reward_amount, default_reward_currency)
        VALUES (?, TRUE, 300, 60, 1000.00, 'scrap')
        ON DUPLICATE KEY UPDATE
          enabled = TRUE,
          updated_at = CURRENT_TIMESTAMP
      `, [serverId]);

      // Create default gates (they will need coordinates set via manage-positions)
      let gatesCreated = 0;
      for (let i = 1; i <= gateCount; i++) {
        try {
          await createKothGate(serverId, i, `Koth-Gate-${i}`, 0, 0, 0, 50);
          gatesCreated++;
        } catch (error) {
          console.error(`Error creating gate ${i}:`, error);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('KOTH System Setup Complete')
        .setDescription(`KOTH system has been set up for **${serverName}**!`)
        .addFields(
          { name: 'Gates Created', value: `${gatesCreated}/${gateCount}`, inline: true },
          { name: 'Next Steps', value: 'Use `/manage-positions` to set coordinates for each KOTH gate.', inline: false },
          { name: 'Default Settings', value: 'Capture Time: 300s\nCountdown: 60s\nReward: 1000 scrap', inline: false }
        )
        .setFooter({ text: 'Configure gate positions before starting events!' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in setupkoth command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Setup Failed', error.message)]
      });
    }
  }
};
