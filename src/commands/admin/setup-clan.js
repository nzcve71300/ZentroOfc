const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed, successEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-clan')
    .setDescription('Enable or disable clan system for a server (Admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to configure')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('option')
        .setDescription('Enable or disable clan system')
        .setRequired(true)
        .addChoices(
          { name: '✅ Enable', value: 'true' },
          { name: '❌ Disable', value: 'false' }
        ))
    .addIntegerOption(option =>
      option.setName('max')
        .setDescription('Maximum number of players per clan (default: 10)')
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(50)),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      const [servers] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ?',
        [guildId, `%${focusedValue}%`]
      );

      await interaction.respond(
        servers.map(server => ({ name: server.nickname, value: server.nickname }))
      );
    } catch (error) {
      console.error('Setup clan autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');
    const option = interaction.options.getString('option') === 'true';
    const maxMembers = interaction.options.getInteger('max') || 10;

    try {
      // Check if user has admin permissions
      const member = await interaction.guild.members.fetch(userId);
      if (!member.permissions.has('Administrator')) {
        return interaction.editReply({
          embeds: [errorEmbed('Permission Denied', 'You need Administrator permissions to use this command.')]
        });
      }

      // Get server
      const server = await getServerByNickname(guildId, serverOption);
      if (!server) {
        return interaction.editReply({
          embeds: [errorEmbed('Server Not Found', 'The specified server was not found.')]
        });
      }

      // Debug: Log server object to see what we're getting
      console.log('[DEBUG] Server object:', server);
      console.log('[DEBUG] Server ID type:', typeof server.id, 'Value:', server.id);

      // Check if clan settings exist
      const [existingSettings] = await pool.query(
        'SELECT * FROM clan_settings WHERE server_id = ?',
        [server.id]
      );

      if (existingSettings.length > 0) {
        // Update existing settings
        await pool.query(
          'UPDATE clan_settings SET enabled = ?, max_members = ?, updated_at = NOW() WHERE server_id = ?',
          [option, maxMembers, server.id]
        );
      } else {
        // Create new settings
        await pool.query(
          'INSERT INTO clan_settings (server_id, enabled, max_members) VALUES (?, ?, ?)',
          [server.id, option, maxMembers]
        );
      }

      console.log(`[CLAN] ${interaction.user.tag} (${userId}) ${option ? 'enabled' : 'disabled'} clan system for ${server.nickname} with max ${maxMembers} members`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle(`${option ? '✅' : '❌'} **CLAN SYSTEM ${option ? 'ENABLED' : 'DISABLED'}** ${option ? '✅' : '❌'}`)
        .setDescription(`**Clan system has been ${option ? 'enabled' : 'disabled'}** for **${server.nickname}**!`)
        .addFields(
          { name: '🖥️ **Server**', value: `${server.nickname}`, inline: true },
          { name: '⚙️ **Status**', value: option ? '**✅ Enabled**' : '**❌ Disabled**', inline: true },
          { name: '👥 **Max Members**', value: `**${maxMembers}** players`, inline: true },
          { name: '👑 **Configured By**', value: `${interaction.user.tag}`, inline: true },
          { name: '📅 **Updated**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: '🏰 Zentro Clan System • Admin configuration' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Setup clan error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Clan Setup Failed', `Failed to configure clan system. Error: ${err.message}`)]
      });
    }
  }
}; 