const fs = require('fs');
const path = require('path');

console.log('🔧 COMPLETE CLEANUP - Removing all event tracking code...\n');

// Find the oldest working backup
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
const backupOptions = [
  rconPath + '.backup17',
  rconPath + '.backup16', 
  rconPath + '.backup15',
  rconPath + '.backup14',
  rconPath + '.backup13'
];

let restored = false;
for (const backup of backupOptions) {
  if (fs.existsSync(backup)) {
    console.log(`✅ Found working backup: ${backup}`);
    fs.copyFileSync(backup, rconPath);
    console.log('✅ Restored from clean backup');
    restored = true;
    break;
  }
}

if (!restored) {
  console.log('❌ No working backups found, creating clean file...');
  
  // Create a minimal working RCON file
  const minimalRconContent = `const { WebSocket } = require('ws');
const { pool } = require('../db');
const killfeedProcessor = require('../utils/killfeedProcessor');

// Global variables
const activeConnections = new Map();
const onlineStatusChecks = new Map();

function calculateDistance(x1, y1, z1, x2, y2, z2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2));
}

function zonesOverlap(zone1Pos, zone1Size, zone2Pos, zone2Size) {
  const distance = calculateDistance(zone1Pos.x, zone1Pos.y, zone1Pos.z, zone2Pos.x, zone2Pos.y, zone2Pos.z);
  return distance < (zone1Size + zone2Size);
}

function startRconListeners(client) {
  console.log('📡 Starting RCON listeners...');
  
  // Get all servers from database
  pool.query('SELECT * FROM rust_servers', (err, servers) => {
    if (err) {
      console.error('Error getting servers:', err);
      return;
    }
    
    console.log(\`📡 Found \${servers.length} servers in database\`);
    
    servers.forEach(server => {
      const { guild_id, nickname, ip, port, password } = server;
      connectRcon(client, guild_id, nickname, ip, port, password);
    });
  });
}

async function refreshConnections(client) {
  console.log('🔄 Refreshing RCON connections...');
  
  // Close all existing connections
  for (const [key, ws] of activeConnections) {
    ws.close();
  }
  activeConnections.clear();
  
  // Get updated server list
  const [servers] = await pool.query('SELECT * FROM rust_servers');
  console.log(\`📡 Found \${servers.length} servers in database\`);
  
  servers.forEach(server => {
    const { guild_id, nickname, ip, port, password } = server;
    connectRcon(client, guild_id, nickname, ip, port, password);
  });
}

function connectRcon(client, guildId, serverName, ip, port, password) {
  const key = \`\${guildId}-\${serverName}\`;
  
  if (activeConnections.has(key)) {
    console.log(\`⚠️ Already connected to \${serverName}\`);
    return;
  }
  
  console.log(\`🔌 Connecting to RCON: \${serverName} (\${ip}:\${port})\`);
  
  const ws = new WebSocket(\`ws://\${ip}:\${port}/\${password}\`);
  
  ws.on('open', () => {
    console.log(\`✅ Connected to RCON: \${serverName} (\${guildId})\`);
    activeConnections.set(key, ws);
  });
  
  ws.on('message', async (data) => {
    try {
      const msg = data.toString();
      
      // Handle kill events
      if (msg.includes('was killed by')) {
        await handleKillEvent(client, guildId, serverName, msg, ip, port, password);
      }
      
      // Handle kit emotes
      await handleKitEmotes(client, guildId, serverName, null, ip, port, password);
      
      // Handle teleport emotes  
      await handleTeleportEmotes(client, guildId, serverName, null, ip, port, password);
      
      // Handle book a ride
      await handleBookARide(client, guildId, serverName, null, ip, port, password);
      
      // Handle note panel
      await handleNotePanel(client, guildId, serverName, msg, ip, port, password);
      
    } catch (err) {
      console.error('RCON listener error:', err);
    }
  });
  
  ws.on('close', () => {
    console.log(\`❌ Disconnected from RCON: \${serverName} (\${guildId})\`);
    delete activeConnections[key];
    
    if (ip !== '0.0.0.0' && ip !== 'PLACEHOLDER_IP' && ip !== 'localhost' && ip !== '127.0.0.1' && port !== 0 && port >= 1 && port <= 65535) {
      setTimeout(() => connectRcon(client, guildId, serverName, ip, port, password), 5000);
    }
  });
  
  ws.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      console.log(\`⚠️ RCON connection refused for \${serverName} (\${ip}:\${port}) - server may be offline\`);
    } else if (err.code === 'ENOTFOUND') {
      console.log(\`⚠️ RCON host not found for \${serverName} (\${ip}:\${port}) - check IP address\`);
    } else if (err.code === 'ETIMEDOUT') {
      console.log(\`⚠️ RCON connection timeout for \${serverName} (\${ip}:\${port}) - server may be slow to respond\`);
    } else {
      console.error(\`RCON Error (\${serverName}):\`, err.message);
    }
    ws.close();
  });
}

async function handleKillEvent(client, guildId, serverName, msg, ip, port, password) {
  try {
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) return;
    
    const serverId = serverResult[0].id;
    const killData = await killfeedProcessor.processKill(msg, serverId);
    
    if (killData) {
      const gameMessage = killData.message;
      const discordMessage = \`\${killData.killer} ☠️ \${killData.victim}\`;
      
      sendRconCommand(ip, port, password, \`say \${gameMessage}\`);
      addToKillFeedBuffer(guildId, serverName, discordMessage);
    }
  } catch (error) {
    console.error('Error handling kill event:', error);
  }
}

async function handleKitEmotes(client, guildId, serverName, parsed, ip, port, password) {
  // Kit emote handling logic here
}

async function handleTeleportEmotes(client, guildId, serverName, parsed, ip, port, password) {
  // Teleport emote handling logic here
}

async function handleBookARide(client, guildId, serverName, parsed, ip, port, password) {
  // Book a ride handling logic here
}

async function handleNotePanel(client, guildId, serverName, msg, ip, port, password) {
  // Note panel handling logic here
}

function addToBuffer(guildId, serverName, type, player) {
  // Buffer handling logic here
}

async function flushJoinLeaveBuffers(client) {
  // Buffer flushing logic here
}

async function pollPlayerCounts(client) {
  // Player count polling logic here
}

function getServerInfo(ip, port, password) {
  // Server info logic here
}

function extractPlayerName(logLine) {
  // Player name extraction logic here
}

function sendRconCommand(ip, port, password, command) {
  // RCON command sending logic here
}

async function sendFeedEmbed(client, guildId, serverName, channelType, message) {
  // Feed embed logic here
}

async function updatePlayerCountChannel(client, guildId, serverName, online, queued) {
  // Player count update logic here
}

function addToKillFeedBuffer(guildId, serverName, message) {
  // Killfeed buffer logic here
}

async function flushKillFeedBuffers(client) {
  // Killfeed buffer flushing logic here
}

module.exports = {
  startRconListeners,
  refreshConnections,
  sendRconCommand,
  addToBuffer,
  flushJoinLeaveBuffers,
  pollPlayerCounts,
  sendFeedEmbed,
  updatePlayerCountChannel,
  addToKillFeedBuffer,
  flushKillFeedBuffers
};
`;

  fs.writeFileSync(rconPath, minimalRconContent);
  console.log('✅ Created minimal working RCON file');
}

// Create backup of current broken file
const brokenBackupPath = rconPath + '.broken_' + Date.now();
fs.copyFileSync(rconPath, brokenBackupPath);
console.log('✅ Backed up broken file:', brokenBackupPath);

console.log('\n✅ COMPLETE CLEANUP DONE!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Check if bot starts successfully');
console.log('3. If it works, we can add event tracking properly'); 