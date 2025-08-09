const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rider-setup')
    .setDescription('Configure Book-a-Ride system settings for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select the server to configure')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('config')
        .setDescription('Configuration option to modify')
        .setRequired(true)
        .addChoices(
          { name: 'Turn on or off', value: 'enabled' },
          { name: 'Cooldown', value: 'cooldown' }
        ))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Value for the configuration')
        .setRequired(true)),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'server') {
      try {
        const guildId = interaction.guild.id;
        
        const [servers] = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
          [guildId]
        );

        const filtered = servers
          .map(server => ({ name: server.nickname, value: server.nickname }))
          .filter(choice => choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()));

        await interaction.respond(filtered.slice(0, 25));
      } catch (error) {
        console.error('Error in rider-setup autocomplete:', error);
        await interaction.respond([]);
      }
    }
  },

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const serverName = interaction.options.getString('server');
      const config = interaction.options.getString('config');
      const option = interaction.options.getString('option');

      // Get server ID
      const [serverResult] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, serverName]
      );

      if (serverResult.length === 0) {
        return interaction.reply({
          content: '❌ Server not found. Please select a valid server.',
          ephemeral: true
        });
      }

      const serverId = serverResult[0].id;

      // Validate option based on config type
      let validatedValue;
      if (config === 'enabled') {
        const lowerOption = option.toLowerCase();
        if (!['on', 'off', 'true', 'false', 'enabled', 'disabled'].includes(lowerOption)) {
          return interaction.reply({
            content: '❌ Invalid option. Use: on/off, true/false, or enabled/disabled',
            ephemeral: true
          });
        }
        validatedValue = ['on', 'true', 'enabled'].includes(lowerOption) ? 1 : 0;
      } else if (config === 'cooldown') {
        const cooldownValue = parseInt(option);
        if (isNaN(cooldownValue) || cooldownValue < 0) {
          return interaction.reply({
            content: '❌ Invalid cooldown value. Please enter a number (seconds).',
            ephemeral: true
          });
        }
        validatedValue = cooldownValue;
      }

      // Check if config exists, if not create it
      const [existingConfig] = await pool.query(
        'SELECT * FROM rider_config WHERE server_id = ?',
        [serverId]
      );

      if (existingConfig.length === 0) {
        // Create new config with defaults
        await pool.query(
          'INSERT INTO rider_config (server_id, enabled, cooldown) VALUES (?, ?, ?)',
          [serverId, config === 'enabled' ? validatedValue : 1, config === 'cooldown' ? validatedValue : 300]
        );
      } else {
        // Update existing config
        const updateQuery = `UPDATE rider_config SET ${config} = ? WHERE server_id = ?`;
        await pool.query(updateQuery, [validatedValue, serverId]);
      }

      // Get updated config for display
      const [updatedConfig] = await pool.query(
        'SELECT * FROM rider_config WHERE server_id = ?',
        [serverId]
      );

      const currentConfig = updatedConfig[0];

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🏇 Book-a-Ride Configuration Updated')
        .setDescription(`Configuration updated for **${serverName}**`)
        .addFields(
          {
            name: '⚙️ Current Settings',
            value: `**Status:** ${currentConfig.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Cooldown:** ${currentConfig.cooldown} seconds`,
            inline: false
          },
          {
            name: '📝 Change Made',
            value: `**${config === 'enabled' ? 'Status' : 'Cooldown'}:** ${config === 'enabled' ? (validatedValue ? 'Enabled' : 'Disabled') : `${validatedValue} seconds`}`,
            inline: false
          }
        )
        .setFooter({ text: 'Book-a-Ride System' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in rider-setup command:', error);
      await interaction.reply({
        content: '❌ An error occurred while updating the rider configuration.',
        ephemeral: true
      });
    }
  }
};