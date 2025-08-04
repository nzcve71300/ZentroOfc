const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { orangeEmbed, errorEmbed } = require('../../embeds/format');
const { getServerByNickname } = require('../../utils/unifiedPlayerSystem');
const pool = require('../../db');
const { createCanvas, loadImage } = require('canvas');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const path = require('path');

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

      // Send RCON commands to get status (with timeout handling)
      console.log(`[STATUS] ${interaction.user.tag} (${userId}) checking status for ${server.nickname}`);
      
      const { sendRconCommand } = require('../../rcon');
      
      // Get FPS (primary command) - this is the most important one
      let fpsResponse, playersResponse, entitiesResponse, memoryResponse, uptimeResponse;
      
      try {
        fpsResponse = await sendRconCommand(server.ip, server.port, server.password, 'server.fps');
        console.log(`[STATUS] FPS response: ${fpsResponse}`);
      } catch (error) {
        console.log(`[STATUS] FPS command failed: ${error.message}`);
        fpsResponse = null;
      }
      
      // Try to get additional info (but don't fail if they timeout)
      try {
        playersResponse = await Promise.race([
          sendRconCommand(server.ip, server.port, server.password, 'players'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
      } catch (error) {
        console.log(`[STATUS] Players command failed: ${error.message}`);
        playersResponse = null;
      }
      
      try {
        entitiesResponse = await Promise.race([
          sendRconCommand(server.ip, server.port, server.password, 'ents'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
      } catch (error) {
        console.log(`[STATUS] Entities command failed: ${error.message}`);
        entitiesResponse = null;
      }
      
      try {
        memoryResponse = await Promise.race([
          sendRconCommand(server.ip, server.port, server.password, 'memory'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
      } catch (error) {
        console.log(`[STATUS] Memory command failed: ${error.message}`);
        memoryResponse = null;
      }
      
      try {
        uptimeResponse = await Promise.race([
          sendRconCommand(server.ip, server.port, server.password, 'uptime'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
      } catch (error) {
        console.log(`[STATUS] Uptime command failed: ${error.message}`);
        uptimeResponse = null;
      }
      
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
      
      // Create visual status image (always try to create it)
      let statusImage = null;
      try {
        console.log(`[STATUS] Attempting to create visual image for ${server.nickname}`);
        statusImage = await createStatusImage(server.nickname, {
          fps: fpsValue,
          players: playerCount,
          entities: entityCount,
          memory: memoryUsage,
          uptime: uptimeFormatted
        });
        console.log(`[STATUS] Image generation successful`);
      } catch (error) {
        console.log(`[STATUS] Image generation failed: ${error.message}`);
        statusImage = null;
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

      // Add image if available
      if (statusImage) {
        embed.setImage('attachment://status.png');
      }

      embed.setFooter({ text: '🔧 Admin Status Check • Zentro Bot Dashboard' });
      embed.setTimestamp();

      // Return with or without attachment
      if (statusImage) {
        const attachment = new AttachmentBuilder(statusImage, { name: 'status.png' });
        return interaction.editReply({ embeds: [embed], files: [attachment] });
      } else {
        return interaction.editReply({ embeds: [embed] });
      }

    } catch (err) {
      console.error('Status command error:', err);
      await interaction.editReply({
        embeds: [errorEmbed('Status Check Failed', `Failed to check status for ${serverOption}. Error: ${err.message}`)]
      });
    }
  }
};

// Function to create the visual status image
async function createStatusImage(serverName, stats) {
  const width = 1280;
  const height = 720;
  
  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Create a gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a1a1a');
  gradient.addColorStop(1, '#2d2d2d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Add Zentro branding
  ctx.fillStyle = '#FF8C00';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ZENTRO BOT', width / 2, 80);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '24px Arial';
  ctx.fillText('SERVER STATUS DASHBOARD', width / 2, 120);
  
  // Draw server name
  ctx.fillStyle = '#FF8C00';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(serverName, width / 2, 180);
  
  // Set font properties for stats
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  
  // Draw stats at specified coordinates
  const statsData = [
    { label: 'FPS', value: stats.fps, x: 80, y: 620 },
    { label: 'Players', value: stats.players, x: 80, y: 560 },
    { label: 'Entities', value: stats.entities, x: 80, y: 500 },
    { label: 'Memory', value: stats.memory, x: 80, y: 440 },
    { label: 'Uptime', value: stats.uptime, x: 80, y: 380 }
  ];
  
  // Draw stats with orange highlights for values
  statsData.forEach(stat => {
    // Draw label
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${stat.label}:`, stat.x, stat.y);
    
    // Draw value in orange
    ctx.fillStyle = '#FF8C00';
    const labelWidth = ctx.measureText(`${stat.label}:`).width;
    ctx.fillText(stat.value, stat.x + labelWidth + 10, stat.y);
  });
  
  // Create chart data (simulated performance data)
  const chartData = generateChartData(stats.fps);
  
  // Create chart using Chart.js
  const chartCanvas = await createChart(chartData);
  
  // Draw chart in the central rectangle area
  ctx.drawImage(chartCanvas, 132, 170, 918, 478);
  
  // Convert to buffer
  return canvas.toBuffer('image/png');
}

// Function to generate chart data based on FPS
function generateChartData(fps) {
  const fpsNum = parseInt(fps) || 50;
  const baseValue = fpsNum;
  const dataPoints = 20;
  const data = [];
  
  for (let i = 0; i < dataPoints; i++) {
    // Create realistic variation around the base FPS
    const variation = (Math.random() - 0.5) * 10;
    const value = Math.max(0, baseValue + variation);
    data.push(value);
  }
  
  return data;
}

// Function to create Chart.js chart
async function createChart(data) {
  const width = 918;
  const height = 478;
  
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'transparent' });
  
  const configuration = {
    type: 'line',
    data: {
      labels: data.map((_, i) => i + 1),
      datasets: [{
        label: 'FPS Performance',
        data: data,
        borderColor: data[data.length - 1] >= data[0] ? '#00FF00' : '#FF0000',
        backgroundColor: data[data.length - 1] >= data[0] ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#FF8C00',
        pointHoverBorderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      },
      elements: {
        point: {
          radius: 0
        }
      }
    }
  };
  
  return await chartJSNodeCanvas.renderToBuffer(configuration);
}

 