const WebSocket = require('ws');
const pool = require('../db');
const { orangeEmbed } = require('../embeds/format');
const killfeedProcessor = require('../utils/killfeedProcessor');

let activeConnections = {};
let joinLeaveBuffer = {};
let killFeedBuffer = {};

// Kit emote mappings
const KIT_EMOTES = {
  freekit: 'd11_quick_chat_i_need_phrase_format d11_Wood',
  vipkit: 'd11_quick_chat_i_need_phrase_format stones',
  elitekit1: 'd11_quick_chat_i_need_phrase_format d11_Metal_Fragments',
  elitekit2: 'd11_quick_chat_i_need_phrase_format metal.refined',
  elitekit3: 'd11_quick_chat_i_need_phrase_format d11_Scrap',
  elitekit4: 'd11_quick_chat_i_need_phrase_format lowgradefuel',
  elitekit5: 'd11_quick_chat_i_need_phrase_format d11_Food',
};

// Teleport emote mappings
const TELEPORT_EMOTES = {
  bandit: 'd11_quick_chat_combat_slot_0',
  outpost: 'd11_quick_chat_combat_slot_2',
};

// In-memory state tracking
const recentKitClaims = new Map();
const recentTeleports = new Map();
const bookARideState = new Map();
const bookARideCooldowns = new Map();
const lastPrintposRequest = new Map();

// Book-a-Ride constants
const BOOKARIDE_EMOTE = 'd11_quick_chat_orders_slot_5';
const BOOKARIDE_CHOICES = {
  horse: 'd11_quick_chat_responses_slot_0',
  rhib: 'd11_quick_chat_responses_slot_1',
};

function startRconListeners(client) {
  refreshConnections(client);
  setInterval(() => {
    refreshConnections(client);
    pollPlayerCounts(client);
  }, 60000);
  setInterval(() => flushJoinLeaveBuffers(client), 60000);
  setInterval(() => flushKillFeedBuffers(client), 60000);
}

async function refreshConnections(client) {
  try {
    const result = await pool.query('SELECT * FROM rust_servers');
    for (const server of result.rows) {
      const guildResult = await pool.query('SELECT discord_id FROM guilds WHERE id = $1', [server.guild_id]);
      if (guildResult.rows.length > 0) {
        const guildId = guildResult.rows[0].discord_id;
        const key = `${guildId}_${server.nickname}`;
        if (!activeConnections[key]) {
          connectRcon(client, guildId, server.nickname, server.ip, server.port, server.password);
        }
      }
    }
  } catch (error) {
    console.error('Error refreshing RCON connections:', error);
  }
}

function connectRcon(client, guildId, serverName, ip, port, password) {
  const key = `${guildId}_${serverName}`;
  const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
  activeConnections[key] = ws;

  ws.on('open', () => console.log(`🔥 Connected to RCON: ${serverName} (${guildId})`));

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data);
      const msg = parsed.Message;
      if (!msg) return;

      console.log('[RCON MSG]', msg);

      // Handle player joins/leaves
      if (msg.match(/has entered the game/)) {
        const player = msg.split(' ')[0];
        addToBuffer(guildId, serverName, 'joins', player);
        await ensurePlayerExists(guildId, serverName, player);
      }
      if (msg.match(/has disconnected/)) {
        const player = msg.split(' ')[0];
        addToBuffer(guildId, serverName, 'leaves', player);
      }

      // Handle kill events
      if (msg.match(/was killed by/)) {
        await handleKillEvent(client, guildId, serverName, msg, ip, port, password);
      }

      // Handle admin spawns
      if (msg.match(/\s*\[ServerVar\] giving /i)) {
        await sendFeedEmbed(client, guildId, serverName, 'admin_feed', `🛠️ **Admin Spawn:** ${msg}`);
      }

      // Handle kit emote detection
      await handleKitEmotes(client, guildId, serverName, parsed, ip, port, password);

      // Handle teleport emotes
      await handleTeleportEmotes(client, guildId, serverName, parsed, ip, port, password);

      // Handle book-a-ride
      await handleBookARide(client, guildId, serverName, parsed, ip, port, password);

      // Handle note panel
      await handleNotePanel(client, guildId, serverName, msg, ip, port, password);

    } catch (err) {
      console.error('RCON listener error:', err);
    }
  });

  ws.on('close', () => {
    console.log(`❌ Disconnected from RCON: ${serverName} (${guildId})`);
    delete activeConnections[key];
    setTimeout(() => connectRcon(client, guildId, serverName, ip, port, password), 5000);
  });

  ws.on('error', (err) => {
    console.error(`RCON Error (${serverName}):`, err.message);
    ws.close();
  });
}

async function handleKillEvent(client, guildId, serverName, msg, ip, port, password) {
  try {
    // Get server ID
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname = $2',
      [guildId, serverName]
    );
    
    if (serverResult.rows.length === 0) return;
    
    const serverId = serverResult.rows[0].id;

    // Process kill with new killfeed processor
    const killData = await killfeedProcessor.processKill(msg, serverId);
    
    if (killData) {
      // Send formatted killfeed message to server
      sendRconCommand(ip, port, password, `say ${killData.message}`);
      
      // Add to Discord killfeed buffer
      addToKillFeedBuffer(guildId, serverName, killData.message);
      
      // Handle coin rewards for kills (only for player kills)
      if (killData.isPlayerKill) {
        await handleKillRewards(guildId, serverName, killData.killer, killData.victim, false);
      }
    }

  } catch (error) {
    console.error('Error handling kill event:', error);
  }
}

// Add function to automatically create player records
async function ensurePlayerExists(guildId, serverName, playerName) {
  try {
    // Get guild and server IDs
    const guildResult = await pool.query(
      'SELECT id FROM guilds WHERE discord_id = $1',
      [guildId]
    );
    
    if (guildResult.rows.length === 0) return;
    
    const guildId_db = guildResult.rows[0].id;
    
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = $1 AND nickname = $2',
      [guildId_db, serverName]
    );
    
    if (serverResult.rows.length === 0) return;
    
    const serverId = serverResult.rows[0].id;

    // Check if player already exists
    const existingPlayer = await pool.query(
      'SELECT id FROM players WHERE guild_id = $1 AND server_id = $2 AND ign = $3',
      [guildId_db, serverId, playerName]
    );

    if (existingPlayer.rows.length === 0) {
      // Create new player record
      const newPlayer = await pool.query(
        'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES ($1, $2, $3, $4) RETURNING id',
        [guildId_db, serverId, null, playerName]
      );

      // Create player stats record
      await pool.query(
        'INSERT INTO player_stats (player_id, kills, deaths, kill_streak, highest_streak) VALUES ($1, 0, 0, 0, 0)',
        [newPlayer.rows[0].id]
      );

      console.log(`✅ Created player record for ${playerName} on server ${serverName}`);
    }
  } catch (error) {
    console.error('Error ensuring player exists:', error);
  }
}

async function handleKillRewards(guildId, serverName, killer, victim, isScientist) {
  try {
    // Sanitize player names to remove null bytes and invalid characters
    const sanitizedKiller = killer.replace(/\0/g, '').trim();
    const sanitizedVictim = victim.replace(/\0/g, '').trim();
    
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname = $2',
      [guildId, serverName]
    );
    
    if (serverResult.rows.length === 0) return;
    
    const serverId = serverResult.rows[0].id;
    const reward = isScientist ? 50 : 25; // Default rewards, could be configurable

    // Find player by IGN
    const playerResult = await pool.query(
      'SELECT id FROM players WHERE server_id = $1 AND ign = $2',
      [serverId, sanitizedKiller]
    );

    if (playerResult.rows.length > 0) {
      const playerId = playerResult.rows[0].id;
      
      // Update economy
      await pool.query(
        'UPDATE economy SET balance = balance + $1 WHERE player_id = $2',
        [reward, playerId]
      );

      // Record transaction
      await pool.query(
        'INSERT INTO transactions (player_id, amount, type) VALUES ($1, $2, $3)',
        [playerId, reward, isScientist ? 'scientist_kill' : 'player_kill']
      );
    }
  } catch (error) {
    console.error('Error handling kill rewards:', error);
  }
}

async function handleKitEmotes(client, guildId, serverName, parsed, ip, port, password) {
  let kitMsg = parsed.Message;
  if (typeof kitMsg === 'string' && kitMsg.trim().startsWith('{')) {
    try {
      kitMsg = JSON.parse(kitMsg);
    } catch (e) {
      // If parsing fails, leave as string
    }
  }

  for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {
    let player = null;
    if (typeof kitMsg === 'string' && kitMsg.includes(emote)) {
      player = extractPlayerName(kitMsg);
    } else if (typeof kitMsg === 'object' && kitMsg.Message && kitMsg.Message.includes(emote)) {
      player = kitMsg.Username || null;
    }
    
    if (player) {
      await handleKitClaim(client, guildId, serverName, ip, port, password, kitKey, player);
    }
  }
}

async function handleKitClaim(client, guildId, serverName, ip, port, password, kitKey, player) {
  try {
    // Get server ID
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname = $2',
      [guildId, serverName]
    );
    
    if (serverResult.rows.length === 0) return;
    
    const serverId = serverResult.rows[0].id;

    // Check if kit is enabled
    const autokitResult = await pool.query(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = $1 AND kit_name = $2',
      [serverId, kitKey]
    );

    if (autokitResult.rows.length === 0 || !autokitResult.rows[0].enabled) {
      return;
    }

    const kitConfig = autokitResult.rows[0];
    const kitName = kitConfig.game_name || kitKey;

    // Check cooldown
    const now = Math.floor(Date.now() / 1000);
    const claimKey = `${guildId}|${serverName}|${kitKey}|${player}`;
    
    if (recentKitClaims.has(claimKey) && now - recentKitClaims.get(claimKey) < 2) {
      console.log('[KIT CLAIM BLOCKED] Duplicate claim blocked for', claimKey);
      return;
    }

    if (kitConfig.cooldown > 0) {
      const lastClaim = recentKitClaims.get(claimKey) || 0;
      if (now - lastClaim < kitConfig.cooldown * 60) {
        const remaining = Math.ceil((kitConfig.cooldown * 60 - (now - lastClaim)) / 60);
        sendRconCommand(ip, port, password, `say <color=#00008B>${player}</color> wait ${remaining}m before claiming ${kitName} again!`);
        return;
      }
    }

    // Check elite kit authorization
    if (kitKey.startsWith('elitekit')) {
      const authResult = await pool.query(
        'SELECT * FROM kit_auth WHERE server_id = $1 AND discord_id = (SELECT discord_id FROM players WHERE server_id = $1 AND ign = $2) AND kitlist = $3',
        [serverId, player, kitKey]
      );
      
      if (authResult.rows.length === 0) {
        console.log('[KIT CLAIM] Not authorized for', kitKey, 'player:', player);
        return;
      }
    }

    // Record claim and give kit
    recentKitClaims.set(claimKey, now);
    sendRconCommand(ip, port, password, `kit givetoplayer ${kitName} ${player}`);
    sendRconCommand(ip, port, password, `say <color=#00008B>${player}</color> successfully claimed ${kitName}`);

    // Log to admin feed
    await sendFeedEmbed(client, guildId, serverName, 'admin_feed', `🛡️ **Kit Claim:** ${player} claimed ${kitName}`);

  } catch (error) {
    console.error('Error handling kit claim:', error);
  }
}

async function handleTeleportEmotes(client, guildId, serverName, parsed, ip, port, password) {
  // Implementation for teleport emotes
  // This would handle bandit/outpost teleports
  // Similar structure to kit emotes but with position lookups
}

async function handleBookARide(client, guildId, serverName, parsed, ip, port, password) {
  // Implementation for book-a-ride functionality
  // This would handle ride booking emotes and entity spawning
}

async function handleNotePanel(client, guildId, serverName, msg, ip, port, password) {
  // Implementation for note panel detection
  // This would handle note panel messages and Discord embeds
}

function addToBuffer(guildId, serverName, type, player) {
  const key = `${guildId}_${serverName}`;
  if (!joinLeaveBuffer[key]) joinLeaveBuffer[key] = { joins: [], leaves: [] };
  if (!joinLeaveBuffer[key][type].includes(player)) joinLeaveBuffer[key][type].push(player);
}

async function flushJoinLeaveBuffers(client) {
  for (const key in joinLeaveBuffer) {
    const [guildId, serverName] = key.split('_');
    const { joins, leaves } = joinLeaveBuffer[key];
    if (joins.length === 0 && leaves.length === 0) continue;
    
    let desc = '';
    if (joins.length > 0) desc += `**Joins:** ${joins.join(', ')}\n`;
    if (leaves.length > 0) desc += `**Leaves:** ${leaves.join(', ')}`;
    
    await sendFeedEmbed(client, guildId, serverName, 'player_feed', desc);
    joinLeaveBuffer[key] = { joins: [], leaves: [] };
  }
}

async function pollPlayerCounts(client) {
  try {
    const result = await pool.query('SELECT * FROM rust_servers');
    for (const server of result.rows) {
      try {
        const info = await getServerInfo(server.ip, server.port, server.password);
        if (info && info.Players !== undefined) {
          await updatePlayerCountChannel(client, server.guild_id, server.nickname, info.Players, info.Queued || 0);
        }
      } catch (e) {
        console.log(`❌ Failed to fetch playercount for ${server.nickname}:`, e.message);
      }
    }
  } catch (error) {
    console.error('Error polling player counts:', error);
  }
}

function getServerInfo(ip, port, password) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
    ws.on('open', () => ws.send(JSON.stringify({ Identifier: 9999, Message: 'serverinfo', Name: 'WebRcon' })));
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.Identifier === 9999) {
          ws.close();
          resolve(JSON.parse(parsed.Message));
        }
      } catch (err) {
        ws.close();
        reject(err);
      }
    });
    ws.on('error', reject);
  });
}

function extractPlayerName(logLine) {
  const match = logLine.match(/\[CHAT LOCAL\] (.*?) :/);
  return match ? match[1] : null;
}

function sendRconCommand(ip, port, password, command) {
  const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
  ws.on('open', () => {
    ws.send(JSON.stringify({ Identifier: 1, Message: command, Name: 'WebRcon' }));
    setTimeout(() => ws.close(), 500);
  });
}

async function sendFeedEmbed(client, guildId, serverName, channelType, message) {
  try {
    // This would need to be implemented based on your channel configuration
    // For now, we'll just log the message
    console.log(`[${channelType.toUpperCase()}] ${serverName}: ${message}`);
  } catch (error) {
    console.error('Error sending feed embed:', error);
  }
}

async function updatePlayerCountChannel(client, guildId, serverName, online, queued) {
  try {
    // This would update a voice channel name with player count
    // Implementation depends on your channel setup
    console.log(`[PLAYER COUNT] ${serverName}: ${online} online, ${queued} queued`);
  } catch (error) {
    console.error('Error updating player count channel:', error);
  }
}

function addToKillFeedBuffer(guildId, serverName, message) {
  const key = `${guildId}_${serverName}`;
  if (!killFeedBuffer[key]) killFeedBuffer[key] = [];
  killFeedBuffer[key].push(message);
}

async function flushKillFeedBuffers(client) {
  for (const key in killFeedBuffer) {
    const [guildId, serverName] = key.split('_');
    const messages = killFeedBuffer[key];
    if (!messages.length) continue;
    
    const desc = messages.join('\n');
    await sendFeedEmbed(client, guildId, serverName, 'killfeed', desc);
    killFeedBuffer[key] = [];
  }
}

// Export functions for use in commands
module.exports = {
  startRconListeners,
  sendRconCommand,
  getServerInfo,
  activeConnections
}; 