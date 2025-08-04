const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status-simple')
    .setDescription('Get server FPS status via RCON (simple version)')
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

      // Send multiple RCON commands to get comprehensive status
      console.log(`[STATUS] ${interaction.user.tag} (${userId}) checking status for ${server.nickname}`);
      
      const { sendRconCommand } = require('../../rcon');
      
      // Get FPS
      const fpsResponse = await sendRconCommand(server.ip, server.port, server.password, 'server.fps');
      
      // Get player count
      const playersResponse = await sendRconCommand(server.ip, server.port, server.password, 'players');
      
      // Get entity count
      const entitiesResponse = await sendRconCommand(server.ip, server.port, server.password, 'ents');
      
      // Get memory usage
      const memoryResponse = await sendRconCommand(server.ip, server.port, server.password, 'memory');
      
      // Get uptime
      const uptimeResponse = await sendRconCommand(server.ip, server.port, server.password, 'uptime');
      
      // Parse responses
      const fpsValue = fpsResponse ? fpsResponse.match(/(\d+)\s+FPS/i)?.[1] || 'Unknown' : 'Unknown';
      const playerCount = playersResponse ? playersResponse.match(/(\d+)\s+players/i)?.[1] || '0' : '0';
      const entityCount = entitiesResponse ? entitiesResponse.match(/(\d+)\s+entities/i)?.[1] || '0' : '0';
      const memoryUsage = memoryResponse ? memoryResponse.match(/(\d+(?:\.\d+)?)\s*MB/i)?.[1] || 'Unknown' : 'Unknown';
      const uptimeValue = uptimeResponse ? uptimeResponse.match(/(\d+)\s+seconds/i)?.[1] || 'Unknown' : 'Unknown';
      
      // Convert uptime to readable format
      const uptimeSeconds = parseInt(uptimeValue);
      const uptimeFormatted = !isNaN(uptimeSeconds) ? 
        `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s` : 
        'Unknown';
      
      // Determine status color and emoji based on FPS
      const fpsNum = parseInt(fpsValue);
      let statusColor = 0xFF8C00; // Orange (default)
      let statusEmoji = '🟡';
      
      if (!isNaN(fpsNum)) {
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
      
      // Create rich embed
      const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle(`${statusEmoji} **SERVER STATUS DASHBOARD** ${statusEmoji}`)
        .setDescription(`**${server.nickname}** - Real-time Performance Monitoring`)
        .addFields(
          { name: '🖥️ **Server**', value: `${server.nickname}`, inline: true },
          { name: '📊 **FPS**', value: `**${fpsValue}**`, inline: true },
          { name: '👥 **Players**', value: `**${playerCount}**`, inline: true },
          { name: '🏗️ **Entities**', value: `**${entityCount}**`, inline: true },
          { name: '💾 **Memory**', value: `**${memoryUsage} MB**`, inline: true },
          { name: '⏱️ **Uptime**', value: `**${uptimeFormatted}**`, inline: true },
          { name: '👤 **Checked By**', value: `${interaction.user.tag}`, inline: true },
          { name: '🌐 **Connection**', value: `***.***.***.***:${server.port}`, inline: true },
          { name: '⏰ **Timestamp**', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        );

      // Add performance summary
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
        { name: '📈 **Performance Summary**', value: performanceStatus, inline: false }
      );

      // Add raw responses in code blocks
      if (fpsResponse || playersResponse || entitiesResponse || memoryResponse || uptimeResponse) {
        let rawResponses = '';
        if (fpsResponse) rawResponses += `**FPS:** \`${fpsResponse.trim()}\`\n`;
        if (playersResponse) rawResponses += `**Players:** \`${playersResponse.trim()}\`\n`;
        if (entitiesResponse) rawResponses += `**Entities:** \`${entitiesResponse.trim()}\`\n`;
        if (memoryResponse) rawResponses += `**Memory:** \`${memoryResponse.trim()}\`\n`;
        if (uptimeResponse) rawResponses += `**Uptime:** \`${uptimeResponse.trim()}\``;
        
        embed.addFields(
          { name: '📋 **Raw RCON Responses**', value: rawResponses, inline: false }
        );
      }

      embed.setFooter({ text: '🔧 Admin Status Check • Zentro Bot Dashboard (Simple)' });
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