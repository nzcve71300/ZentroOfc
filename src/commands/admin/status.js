const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Get server FPS status via RCON')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server to check status for')
        .setRequired(true)
        .setAutocomplete(true)),

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
      console.error('Status autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const serverOption = interaction.options.getString('server');

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

      // Send server.fps command via RCON
      console.log(`[STATUS] ${interaction.user.tag} (${userId}) checking FPS for ${server.nickname}`);
      
      const { sendRconCommand } = require('../../rcon');
      const response = await sendRconCommand(server.ip, server.port, server.password, 'server.fps');
      
      // Parse FPS from response
      let fpsValue = 'Unknown';
      let statusColor = 0xFF8C00; // Orange (default)
      let statusEmoji = '🟡';
      
      if (response) {
        // Extract FPS value from response like "54 FPS"
        const fpsMatch = response.match(/(\d+)\s+FPS/i);
        if (fpsMatch) {
          fpsValue = fpsMatch[1];
          const fpsNum = parseInt(fpsValue);
          
          // Determine status based on FPS
          if (fpsNum >= 50) {
            statusColor = 0x00FF00; // Green
            statusEmoji = '🟢';
          } else if (fpsNum >= 30) {
            statusColor = 0xFFFF00; // Yellow
            statusEmoji = '🟡';
          } else {
            statusColor = 0xFF0000; // Red
            statusEmoji = '🔴';
          }
        }
      }

      // Create rich embed
      const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle(`${statusEmoji} **SERVER STATUS** ${statusEmoji}`)
        .setDescription(`**${server.nickname}** - Real-time FPS Monitoring`)
        .addFields(
          { name: '🖥️ **Server**', value: `${server.nickname}`, inline: true },
          { name: '📊 **FPS**', value: `**${fpsValue}**`, inline: true },
          { name: '👤 **Checked By**', value: `${interaction.user.tag}`, inline: true },
          { name: '🌐 **Connection**', value: `***.***.***.***:${server.port}`, inline: true },
          { name: '⏰ **Timestamp**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: '📡 **Status**', value: response ? '✅ **Online**' : '❌ **Offline**', inline: true }
        );

      // Add performance indicator
      const fpsNum = parseInt(fpsValue);
      let performanceStatus = 'Unknown';
      if (!isNaN(fpsNum)) {
        if (fpsNum >= 50) {
          performanceStatus = '🟢 **Excellent** - Server running smoothly';
        } else if (fpsNum >= 30) {
          performanceStatus = '🟡 **Good** - Server performance is acceptable';
        } else {
          performanceStatus = '🔴 **Poor** - Server may need attention';
        }
      }

      embed.addFields(
        { name: '📈 **Performance**', value: performanceStatus, inline: false }
      );

      // Add raw response in code block if available
      if (response && response.trim()) {
        embed.addFields(
          { name: '📋 **Raw Response**', value: `\`\`\`${response.trim()}\`\`\``, inline: false }
        );
      }

      embed.setFooter({ text: '🔧 Admin Status Check • RCON FPS Monitoring' });
      embed.setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Status command error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Status Check Failed', `Failed to check status for ${serverOption}. Error: ${err.message}`)]
      });
    }
  }
}; 