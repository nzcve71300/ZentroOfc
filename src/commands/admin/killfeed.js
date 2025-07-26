const { SlashCommandBuilder } = require('discord.js');
const { orangeEmbed } = require('../../embeds/format');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killfeed')
    .setDescription('Enable or disable killfeed for a server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('Select a server')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Enable or disable killfeed')
        .setRequired(true)
        .addChoices(
          { name: 'Enable', value: 'enable' },
          { name: 'Disable', value: 'disable' },
          { name: 'Status', value: 'status' }
        )),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const result = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname ILIKE $2 LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      const choices = result.rows.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const serverNickname = interaction.options.getString('server');
    const action = interaction.options.getString('action');
    const guildId = interaction.guildId;

    try {
      // Get server ID
      const serverResult = await pool.query(
        'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
        [guildId, serverNickname]
      );

      if (serverResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed('Error', 'Server not found.')],
          ephemeral: true
        });
      }

      const serverId = serverResult.rows[0].id;

      // Get current killfeed config
      const configResult = await pool.query(
        'SELECT id, enabled FROM killfeed_configs WHERE server_id = $1',
        [serverId]
      );

      if (configResult.rows.length === 0) {
        return interaction.reply({
          embeds: [orangeEmbed('Error', `Killfeed not configured for **${serverNickname}**. Use \`/killfeed-setup\` first.`)],
          ephemeral: true
        });
      }

      const configId = configResult.rows[0].id;
      const currentStatus = configResult.rows[0].enabled;

      if (action === 'enable') {
        if (currentStatus) {
          return interaction.reply({
            embeds: [orangeEmbed('Info', `Killfeed is already enabled for **${serverNickname}**.`)],
            ephemeral: true
          });
        }
        
        await pool.query(
          'UPDATE killfeed_configs SET enabled = true WHERE id = $1',
          [configId]
        );

        await interaction.reply({
          embeds: [orangeEmbed('✅ Killfeed Enabled', `Killfeed has been enabled for **${serverNickname}**.`)],
          ephemeral: true
        });

      } else if (action === 'disable') {
        if (!currentStatus) {
          return interaction.reply({
            embeds: [orangeEmbed('Info', `Killfeed is already disabled for **${serverNickname}**.`)],
            ephemeral: true
          });
        }

        await pool.query(
          'UPDATE killfeed_configs SET enabled = false WHERE id = $1',
          [configId]
        );

        await interaction.reply({
          embeds: [orangeEmbed('❌ Killfeed Disabled', `Killfeed has been disabled for **${serverNickname}**.`)],
          ephemeral: true
        });

      } else if (action === 'status') {
        const statusText = currentStatus ? '🟢 Enabled' : '🔴 Disabled';
        await interaction.reply({
          embeds: [orangeEmbed(
            '🔫 Killfeed Status',
            `**${serverNickname}** Killfeed Status: ${statusText}`
          )],
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Error managing killfeed:', error);
      await interaction.reply({
        embeds: [orangeEmbed('Error', 'Failed to manage killfeed. Please try again.')],
        ephemeral: true
      });
    }
  },
}; 