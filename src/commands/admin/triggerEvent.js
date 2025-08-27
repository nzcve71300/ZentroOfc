const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const { getServerByNickname, getServersForGuild } = require('../../utils/unifiedPlayerSystem');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trigger-event')
    .setDescription('Manually trigger a crate event and reset its timer')
    .addStringOption(option =>
      option.setName('event')
        .setDescription('The crate event to trigger')
        .setRequired(true)
        .addChoices(
          { name: 'CRATE-1', value: 'CRATE-1' },
          { name: 'CRATE-2', value: 'CRATE-2' },
          { name: 'CRATE-3', value: 'CRATE-3' },
          { name: 'CRATE-4', value: 'CRATE-4' }
        )
    )
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to trigger the event on')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const servers = await getServersForGuild(guildId);
      
      const filtered = servers.filter(server => 
        server.nickname.toLowerCase().includes(focusedValue.toLowerCase())
      );

      await interaction.respond(
        filtered.slice(0, 25).map(server => ({
          name: server.nickname,
          value: server.nickname
        }))
      );
    } catch (error) {
      console.error('Error in trigger-event autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    try {
      const eventType = interaction.options.getString('event');
      const serverOption = interaction.options.getString('server');
      const guildId = interaction.guildId;

      // Get server using shared helper
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return await interaction.reply({
          embeds: [errorEmbed('Server Not Found', `Server not found: ${serverOption}`)],
          ephemeral: true
        });
      }

      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      // Get crate event configuration
      const [crateConfigs] = await connection.execute(
        'SELECT * FROM crate_event_configs WHERE server_id = ? AND crate_type = ?',
        [server.id.toString(), eventType.toLowerCase()]
      );

      if (crateConfigs.length === 0) {
        await connection.end();
        return await interaction.reply({
          embeds: [errorEmbed('Configuration Not Found', `No configuration found for ${eventType} on ${server.nickname}. Please configure it first using /set.`)],
          ephemeral: true
        });
      }

      const crateConfig = crateConfigs[0];

      if (!crateConfig.enabled) {
        await connection.end();
        return await interaction.reply({
          embeds: [errorEmbed('Event Disabled', `${eventType} is disabled on ${server.nickname}. Enable it first using \`/set ${eventType} on ${server.nickname}\`.`)],
          ephemeral: true
        });
      }

      // Convert event type to position type format (CRATE-1 -> crate-event-1)
      const positionType = eventType.toLowerCase().replace('crate-', 'crate-event-');
      
      // Get crate position from manage-positions
      const [positions] = await connection.execute(
        'SELECT * FROM position_coordinates WHERE server_id = ? AND position_type = ?',
        [server.id.toString(), positionType]
      );

      if (positions.length === 0) {
        await connection.end();
        return await interaction.reply({
          embeds: [errorEmbed('Position Not Set', `No position set for ${eventType} on ${server.nickname}. Set the position first using \`/manage-positions ${server.nickname} ${eventType} <coordinates>\`.`)],
          ephemeral: true
        });
      }

      const position = positions[0];
      const coordinates = `${position.x_pos},${position.y_pos},${position.z_pos}`;

      // Get server RCON info
      const [serverInfo] = await connection.execute(
        'SELECT ip, port, password FROM rust_servers WHERE id = ?',
        [server.id]
      );

      if (serverInfo.length === 0) {
        await connection.end();
        return await interaction.reply({
          embeds: [errorEmbed('RCON Information Missing', `Server RCON information not found for ${server.nickname}.`)],
          ephemeral: true
        });
      }

      const { ip, port, password } = serverInfo[0];
      const { sendRconCommand } = require('../../rcon');

      // Send spawn message if configured
      if (crateConfig.spawn_message && crateConfig.spawn_message.trim()) {
        try {
          await sendRconCommand(ip, port, password, `say "${crateConfig.spawn_message}"`);
          console.log(`📢 Sent crate spawn message for ${eventType} on ${server.nickname}: ${crateConfig.spawn_message}`);
        } catch (error) {
          console.error(`❌ Failed to send spawn message for ${eventType} on ${server.nickname}:`, error);
        }
      }

      // Spawn crates according to configured amount
      const spawnAmount = Math.min(Math.max(crateConfig.spawn_amount || 1, 1), 2);
      let spawnSuccess = 0;

      for (let i = 0; i < spawnAmount; i++) {
        try {
          await sendRconCommand(ip, port, password, `entity.spawn codelockedhackablecrate ${coordinates}`);
          spawnSuccess++;
          console.log(`📦 Spawned crate ${i + 1}/${spawnAmount} for ${eventType} on ${server.nickname} at ${coordinates}`);
        } catch (error) {
          console.error(`❌ Failed to spawn crate ${i + 1}/${spawnAmount} for ${eventType} on ${server.nickname}:`, error);
        }
      }

      // Reset the timer by updating the last_spawn timestamp
      await connection.execute(
        'UPDATE crate_event_configs SET last_spawn = CURRENT_TIMESTAMP WHERE server_id = ? AND crate_type = ?',
        [server.id.toString(), eventType.toLowerCase()]
      );

      await connection.end();

      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle(`${eventType} Event Triggered`)
        .setDescription(`Successfully triggered ${eventType} on **${server.nickname}**`)
        .addFields(
          { name: 'Crates Spawned', value: `${spawnSuccess}/${spawnAmount}`, inline: true },
          { name: 'Location', value: coordinates, inline: true },
          { name: 'Timer Reset', value: `Next spawn in ${crateConfig.spawn_interval_minutes} minutes`, inline: true }
        );

      if (crateConfig.spawn_message && crateConfig.spawn_message.trim()) {
        successEmbed.addFields({ name: 'Spawn Message', value: crateConfig.spawn_message, inline: false });
      }

      return await interaction.reply({
        embeds: [successEmbed],
        ephemeral: false
      });

    } catch (error) {
      console.error('Error in trigger-event command:', error);
      return await interaction.reply({
        embeds: [errorEmbed('Command Error', `Error triggering event: ${error.message}`)],
        ephemeral: true
      });
    }
  }
};
