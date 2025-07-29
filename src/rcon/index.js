const WebSocket = require('ws');
const { EmbedBuilder } = require('discord.js');
const pool = require('../db');
const { orangeEmbed } = require('../embeds/format');
const killfeedProcessor = require('../utils/killfeedProcessor');

let activeConnections = {};
let joinLeaveBuffer = {};
let killFeedBuffer = {};

// Kit emote mappings
const KIT_EMOTES = {
  FREEkit1: 'd11_quick_chat_i_need_phrase_format d11_Wood',
  FREEkit2: 'd11_quick_chat_i_need_phrase_format d11_Water',
  VIPkit: 'd11_quick_chat_i_need_phrase_format stones',
  ELITEkit1: 'd11_quick_chat_i_need_phrase_format metal.refined',
  ELITEkit2: 'd11_quick_chat_i_need_phrase_format d11_Scrap',
  ELITEkit3: 'd11_quick_chat_i_need_phrase_format lowgradefuel',
  ELITEkit4: 'd11_quick_chat_i_need_phrase_format d11_Food',
  ELITEkit5: 'd11_quick_chat_i_need_phrase_format d11_Cloth',
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
const eventFlags = new Map(); // Track event states to prevent duplicate messages

// Book-a-Ride constants
const BOOKARIDE_EMOTE = 'd11_quick_chat_orders_slot_5';
const BOOKARIDE_CHOICES = {
  horse: 'd11_quick_chat_responses_slot_0',
  rhib: 'd11_quick_chat_responses_slot_1',
};

// ZORP constants
const ZORP_EMOTE = 'd11_quick_chat_questions_slot_1';
const ZORP_DELETE_EMOTE = 'd11_quick_chat_responses_slot_6';

// Helper function to calculate 3D distance between two points
function calculateDistance(x1, y1, z1, x2, y2, z2) {
  return Math.sqrt(
    Math.pow(x1 - x2, 2) +
    Math.pow(y1 - y2, 2) +
    Math.pow(z1 - z2, 2)
  );
}

// Helper function to check if two zones overlap
function zonesOverlap(zone1Pos, zone1Size, zone2Pos, zone2Size) {
  const distance = calculateDistance(
    zone1Pos.x, zone1Pos.y, zone1Pos.z,
    zone2Pos.x, zone2Pos.y, zone2Pos.z
  );
  return distance < (zone1Size + zone2Size);
}

function startRconListeners(client) {
  refreshConnections(client);
  setInterval(() => {
    refreshConnections(client);
    pollPlayerCounts(client);
  }, 60000);
  setInterval(() => flushJoinLeaveBuffers(client), 60000);
  setInterval(() => flushKillFeedBuffers(client), 60000);
  setInterval(() => checkAllEvents(client), 60000); // Check for events every 60 seconds (reduced frequency)
  setInterval(() => deleteExpiredZones(client), 300000); // Check for expired zones every 5 minutes
}

async function refreshConnections(client) {
  try {
    const [result] = await pool.query('SELECT * FROM rust_servers');
    for (const server of result) {
      const [guildResult] = await pool.query('SELECT discord_id FROM guilds WHERE id = ?', [server.guild_id]);
      if (guildResult.length > 0) {
        const guildId = guildResult[0].discord_id;
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
        // Send to playerfeed
        await sendFeedEmbed(client, guildId, serverName, 'playerfeed', `**${player}** has joined the server!`);
      }
      if (msg.match(/has disconnected/)) {
        const player = msg.split(' ')[0];
        addToBuffer(guildId, serverName, 'leaves', player);
      }

      // Handle admin loot spawns
      if (msg.match(/\[ServerVar\] giving .* x /)) {

        const match = msg.match(/\[ServerVar\] giving (.*?) (\d+) x (.*)/);
        if (match) {
          const player = match[1];
          const amount = match[2];
          const item = match[3];
          await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `**Admin spawned:** ${amount}x ${item} for **${player}**`);
        }
      }

      // Handle note panel messages
      if (msg.match(/\[NOTE PANEL\] Player \[ .*? \] changed name from \[ .*? \] to \[ .*? \]/)) {
        const match = msg.match(/\[NOTE PANEL\] Player \[ (.*?) \] changed name from \[ .*? \] to \[ (.*?) \]/);
        if (match) {
          const player = match[1];
          const note = match[2].replace(/\\n/g, '\n').trim();
          if (note) {
            // Send green message in-game
            sendRconCommand(ip, port, password, `say <color=green>${note}</color>`);
            // Send to notefeed
            await sendFeedEmbed(client, guildId, serverName, 'notefeed', `**${player}** says: ${note}`);
          }
        }
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

      // Handle ZORP emotes
      await handleZorpEmote(client, guildId, serverName, parsed, ip, port, password);
      await handleZorpDeleteEmote(client, guildId, serverName, parsed, ip, port, password);

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
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
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
        await handleKillRewards(guildId, serverName, killData.killer, killData.victim, FALSE);
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
      'SELECT id FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildResult.rows.length === 0) return;
    
    const guildId_db = guildResult.rows[0].id;
    
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
      [guildId_db, serverName]
    );
    
    if (serverResult.rows.length === 0) return;
    
    const serverId = serverResult.rows[0].id;

    // Check if player already exists
    const existingPlayer = await pool.query(
      'SELECT id FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
      [guildId_db, serverId, playerName]
    );

    if (existingPlayer.rows.length === 0) {
      // Create new player record
      const newPlayer = await pool.query(
        'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (?, ?, ?, ?) RETURNING id',
        [guildId_db, serverId, null, playerName]
      );

      // Create player stats record
      await pool.query(
        'INSERT INTO player_stats (player_id, kills, deaths, kill_streak, highest_streak) VALUES (?, 0, 0, 0, 0)',
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
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.rows.length === 0) return;
    
    const serverId = serverResult.rows[0].id;
    const reward = isScientist ? 50 : 25; // Default rewards, could be configurable

    // Find player by IGN
    const playerResult = await pool.query(
      'SELECT id FROM players WHERE server_id = ? AND ign = ?',
      [serverId, sanitizedKiller]
    );

    if (playerResult.rows.length > 0) {
      const playerId = playerResult.rows[0].id;
      
      // Update economy
      await pool.query(
        'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
        [reward, playerId]
      );

      // Record transaction
      await pool.query(
        'INSERT INTO transactions (player_id, amount, type) VALUES (?, ?, ?)',
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

  console.log('[KIT EMOTE DEBUG] Processing message:', kitMsg);

  for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {
    let player = null;
    if (typeof kitMsg === 'string' && kitMsg.includes(emote)) {
      player = extractPlayerName(kitMsg);
      console.log('[KIT EMOTE DEBUG] Found kit emote in string:', kitKey, 'player:', player, 'emote:', emote);
    } else if (typeof kitMsg === 'object' && kitMsg.Message && kitMsg.Message.includes(emote)) {
      player = kitMsg.Username || null;
      console.log('[KIT EMOTE DEBUG] Found kit emote in object:', kitKey, 'player:', player, 'emote:', emote);
    }
    
    if (player) {
      console.log('[KIT EMOTE DEBUG] Processing kit claim for:', kitKey, 'player:', player);
      await handleKitClaim(client, guildId, serverName, ip, port, password, kitKey, player);
    }
  }
}

async function handleKitClaim(client, guildId, serverName, ip, port, password, kitKey, player) {
  try {
    console.log('[KIT CLAIM DEBUG] Processing claim for:', kitKey, 'player:', player, 'server:', serverName);
    
    // Get server ID
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.rows.length === 0) {
      console.log('[KIT CLAIM DEBUG] Server not found:', serverName);
      return;
    }
    
    const serverId = serverResult.rows[0].id;

    // Check if kit is enabled
    const autokitResult = await pool.query(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
      [serverId, kitKey]
    );

    console.log('[KIT CLAIM DEBUG] Autokit config:', autokitResult.rows[0]);

    if (autokitResult.rows.length === 0 || !autokitResult.rows[0].enabled) {
      console.log('[KIT CLAIM DEBUG] Kit not enabled or not found:', kitKey);
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
        console.log('[KIT CLAIM DEBUG] Cooldown active for:', kitKey, 'player:', player, 'remaining:', remaining, 'minutes');
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> please wait <color=white>before claiming again</color> <color=#800080>${remaining}m</color>`);
        return;
      }
    }

    // Check elite kit authorization (requires both being added to list AND being linked)
    if (kitKey.startsWith('ELITEkit')) {
      console.log('[KIT CLAIM DEBUG] Checking elite authorization for:', kitKey, 'player:', player);
      
      // First check if player is linked
      const playerResult = await pool.query(
        'SELECT discord_id FROM players WHERE server_id = ? AND ign = ?',
        [serverId, player]
      );
      
      if (playerResult.rows.length === 0 || !playerResult.rows[0].discord_id) {
        console.log('[KIT CLAIM DEBUG] Player not linked for elite kit:', kitKey, 'player:', player);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you must link your Discord account first</color> <color=#800080>to claim elite kits</color>`);
        return;
      }
      
      // Then check if player is authorized for this kit
      const authResult = await pool.query(
        `SELECT ka.* FROM kit_auth ka 
         JOIN players p ON ka.discord_id = p.discord_id 
         WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
        [serverId, player, kitKey]
      );
      
      console.log('[KIT CLAIM DEBUG] Elite auth result:', authResult.rows);
      
      if (authResult.rows.length === 0) {
        console.log('[KIT CLAIM DEBUG] Not authorized for', kitKey, 'player:', player);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you are not authorized for</color> <color=#800080>${kitName}</color>`);
        return;
      }
    }

    // Record claim and give kit
    recentKitClaims.set(claimKey, now);
    console.log('[KIT CLAIM DEBUG] Giving kit:', kitName, 'to player:', player);
    sendRconCommand(ip, port, password, `kit givetoplayer ${kitName} ${player}`);
    sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>claimed</color> <color=#800080>${kitName}</color>`);

    // Log to admin feed
    await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🛡️ **Kit Claim:** ${player} claimed ${kitName}`);

  } catch (error) {
    console.error('Error handling kit claim:', error);
  }
}

async function handleTeleportEmotes(client, guildId, serverName, parsed, ip, port, password) {
  try {
    const msg = parsed.Message;
    if (!msg) return;

    // Get server ID
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.rows.length === 0) return;
    
    const serverId = serverResult.rows[0].id;

    // Check for Outpost emote
    if (msg.includes('d11_quick_chat_combat_slot_2')) {
      const player = extractPlayerName(msg);
      if (player) {
        await handlePositionTeleport(client, guildId, serverName, serverId, ip, port, password, 'outpost', player);
      }
    }

    // Check for Bandit Camp emote
    if (msg.includes('d11_quick_chat_combat_slot_0')) {
      const player = extractPlayerName(msg);
      if (player) {
        await handlePositionTeleport(client, guildId, serverName, serverId, ip, port, password, 'banditcamp', player);
      }
    }

  } catch (error) {
    console.error('Error handling teleport emotes:', error);
  }
}

async function handlePositionTeleport(client, guildId, serverName, serverId, ip, port, password, positionType, player) {
  try {
    // Get position configuration
    const configResult = await pool.query(
      'SELECT enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ? AND position_type = ?',
      [serverId, positionType]
    );

    if (configResult.rows.length === 0 || !configResult.rows[0].enabled) {
      return; // Position teleport is not configured or disabled
    }

    const config = configResult.rows[0];

    // Check cooldown
    const cooldownKey = `${serverId}_${positionType}_${player}`;
    const now = Date.now();
    const lastTeleport = recentTeleports.get(cooldownKey) || 0;
    const cooldownMs = config.cooldown_minutes * 60 * 1000;

    if (now - lastTeleport < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - (now - lastTeleport)) / (60 * 1000));
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>please wait</color> <color=#800080>${remainingMinutes} minutes</color> <color=white>before teleporting again</color>`);
      return;
    }

    // Get position coordinates
    const coordResult = await pool.query(
      'SELECT x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = ? AND position_type = ?',
      [serverId, positionType]
    );

    if (coordResult.rows.length === 0) {
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleport coordinates not configured</color>`);
      return;
    }

    const coords = coordResult.rows[0];
    const positionDisplayName = positionType === 'outpost' ? 'Outpost' : 'Bandit Camp';

    // If there's a delay, show countdown
    if (config.delay_seconds > 0) {
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleporting to</color> <color=#800080>${positionDisplayName}</color> <color=white>in</color> <color=#800080>${config.delay_seconds} seconds</color>`);
      
      // Wait for delay
      setTimeout(async () => {
        // Check cooldown again after delay
        const currentTime = Date.now();
        if (currentTime - lastTeleport < cooldownMs) {
          return; // Player used another teleport during delay
        }

        // Execute teleport
        const teleportCommand = `global.teleportposrot "${coords.x_pos},${coords.y_pos},${coords.z_pos}" "${player}" "1"`;
        sendRconCommand(ip, port, password, teleportCommand);
        
        // Send success message
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleported to</color> <color=#800080>${positionDisplayName}</color> <color=white>successfully</color>`);
        
        // Update cooldown
        recentTeleports.set(cooldownKey, currentTime);
        
        // Send to admin feed
        await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🚀 **Position Teleport:** ${player} teleported to ${positionDisplayName}`);
        
      }, config.delay_seconds * 1000);
    } else {
      // Execute teleport immediately
      const teleportCommand = `global.teleportposrot "${coords.x_pos},${coords.y_pos},${coords.z_pos}" "${player}" "1"`;
      sendRconCommand(ip, port, password, teleportCommand);
      
      // Send success message
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleported to</color> <color=#800080>${positionDisplayName}</color> <color=white>successfully</color>`);
      
      // Update cooldown
      recentTeleports.set(cooldownKey, now);
      
      // Send to admin feed
      await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🚀 **Position Teleport:** ${player} teleported to ${positionDisplayName}`);
    }

  } catch (error) {
    console.error('Error handling position teleport:', error);
  }
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
    const [result] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
    `);
    for (const server of result) {
      try {
        const info = await getServerInfo(server.ip, server.port, server.password);
        if (info && info.Players !== undefined) {
          await updatePlayerCountChannel(client, server.guild_discord_id, server.nickname, info.Players, info.Queued || 0);
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
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ Identifier: 1, Message: command, Name: 'WebRcon' }));
      setTimeout(() => {
        ws.close();
        resolve('Command sent');
      }, 500);
    });
    
    ws.on('error', (error) => {
      reject(error);
    });
    
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.Message) {
          resolve(parsed.Message);
        }
      } catch (err) {
        // Ignore parsing errors
      }
    });
  });
}

async function sendFeedEmbed(client, guildId, serverName, channelType, message) {
  try {
    // Get the channel ID from database
    const [result] = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = ? AND rs.nickname = ? AND cs.channel_type = ?`,
      [guildId, serverName, channelType]
    );

    if (result.length === 0) {
      console.log(`[${channelType.toUpperCase()}] No channel configured for ${serverName}: ${message}`);
      return;
    }

    const channelId = result[0].channel_id;
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.error(`[${channelType.toUpperCase()}] Channel not found: ${channelId}`);
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00) // Orange color
      .setTitle(`${channelType.charAt(0).toUpperCase() + channelType.slice(1)} - ${serverName}`)
      .setDescription(message)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`[${channelType.toUpperCase()}] Sent to ${serverName}: ${message}`);
  } catch (error) {
    console.error('Error sending feed embed:', error);
  }
}

async function updatePlayerCountChannel(client, guildId, serverName, online, queued) {
  try {
    // Get the channel ID from database
    const [result] = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = ? AND rs.nickname = ? AND cs.channel_type = 'playercount'`,
      [guildId, serverName]
    );

    if (result.length === 0) {
      console.log(`[PLAYER COUNT] No channel configured for ${serverName}: ${online} online, ${queued} queued`);
      return;
    }

    const channelId = result[0].channel_id;
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.error(`[PLAYER COUNT] Channel not found: ${channelId}`);
      return;
    }

    if (channel.type !== 2) { // 2 = voice channel
      console.error(`[PLAYER COUNT] Channel is not a voice channel: ${channelId}`);
      return;
    }

    // Update voice channel name
    const newName = `🌐${online}🕑${queued}`;
    await channel.setName(newName);
    console.log(`[PLAYER COUNT] Updated ${serverName}: ${newName}`);
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

// Event detection state tracking

async function checkAllEvents(client) {
  try {
    // Get all active servers with event configurations in a single query
    const [result] = await pool.query(`
      SELECT 
        rs.id, rs.nickname, rs.ip, rs.port, rs.password, 
        g.discord_id as guild_id,
        ec.event_type, ec.kill_message, ec.respawn_message
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      JOIN event_configs ec ON rs.id = ec.server_id 
      WHERE ec.enabled = TRUE
    `);

    if (result.length === 0) {
      console.log('[EVENT] No servers with enabled events found');
      return;
    }

    // Group by server to avoid duplicate queries
    const servers = new Map();
    for (const row of result) {
      const key = `${row.guild_id}_${row.nickname}`;
      if (!servers.has(key)) {
        servers.set(key, {
          id: row.id,
          nickname: row.nickname,
          ip: row.ip,
          port: row.port,
          password: row.password,
          guild_id: row.guild_id,
          configs: []
        });
      }
      servers.get(key).configs.push({
        event_type: row.event_type,
        kill_message: row.kill_message,
        respawn_message: row.respawn_message
      });
    }

    console.log(`[EVENT] Checking events for ${servers.size} servers`);

    // Process each server
    for (const [key, server] of servers) {
      try {
        if (!eventFlags.has(key)) {
          eventFlags.set(key, new Set());
        }
        const serverFlags = eventFlags.get(key);

        // Check for Bradley events
        const bradleyConfig = server.configs.find(c => c.event_type === 'bradley');
        if (bradleyConfig) {
          await checkBradleyEvent(client, server.guild_id, server.nickname, server.ip, server.port, server.password, bradleyConfig, serverFlags);
        }

        // Check for Helicopter events
        const helicopterConfig = server.configs.find(c => c.event_type === 'helicopter');
        if (helicopterConfig) {
          await checkHelicopterEvent(client, server.guild_id, server.nickname, server.ip, server.port, server.password, helicopterConfig, serverFlags);
        }
      } catch (serverError) {
        console.error(`[EVENT] Error checking events for server ${server.nickname}:`, serverError);
      }
    }
  } catch (error) {
    console.error('Error checking all events:', error);
  }
}

async function handleEventDetection(client, guildId, serverName, msg, ip, port, password) {
  // This function is now deprecated - events are checked periodically instead
  // Keeping it for backward compatibility but it does nothing
}

async function checkBradleyEvent(client, guildId, serverName, ip, port, password, config, serverFlags) {
  try {
    const bradley = await sendRconCommand(ip, port, password, "find_entity servergibs_bradley");
    
    if (bradley && bradley.includes("servergibs_bradley") && !serverFlags.has("BRADLEY")) {
      serverFlags.add("BRADLEY");
      
      console.log(`[EVENT] Bradley event detected on ${serverName}, sending message: ${config.kill_message}`);
      
      // Send kill message
      await sendRconCommand(ip, port, password, `say "${config.kill_message}"`);
      
      // Send to Discord feed
      await sendFeedEmbed(client, guildId, serverName, 'eventfeed', `🎯 **Bradley APC Event Started!**\n${config.kill_message}`);
      
      // Clear flag after 10 minutes
      setTimeout(() => {
        const flags = eventFlags.get(`${guildId}_${serverName}`);
        if (flags) {
          flags.delete("BRADLEY");
        }
      }, 60_000 * 10);
      
      console.log(`[EVENT] Bradley event started on ${serverName}`);
    }
  } catch (error) {
    console.error(`[EVENT] Error checking Bradley event on ${serverName}:`, error.message);
  }
}

async function checkHelicopterEvent(client, guildId, serverName, ip, port, password, config, serverFlags) {
  try {
    const helicopter = await sendRconCommand(ip, port, password, "find_entity servergibs_patrolhelicopter");
    
    if (helicopter && helicopter.includes("servergibs_patrolhelicopter") && !serverFlags.has("HELICOPTER")) {
      serverFlags.add("HELICOPTER");
      
      console.log(`[EVENT] Helicopter event detected on ${serverName}, sending message: ${config.kill_message}`);
      
      // Send kill message
      await sendRconCommand(ip, port, password, `say "${config.kill_message}"`);
      
      // Send to Discord feed
      await sendFeedEmbed(client, guildId, serverName, 'eventfeed', `🚁 **Patrol Helicopter Event Started!**\n${config.kill_message}`);
      
      // Clear flag after 10 minutes
      setTimeout(() => {
        const flags = eventFlags.get(`${guildId}_${serverName}`);
        if (flags) {
          flags.delete("HELICOPTER");
        }
      }, 60_000 * 10);
      
      console.log(`[EVENT] Helicopter event started on ${serverName}`);
    }
  } catch (error) {
    console.error(`[EVENT] Error checking Helicopter event on ${serverName}:`, error.message);
  }
}

// ZORP System Functions
async function handleZorpEmote(client, guildId, serverName, parsed, ip, port, password) {
  try {
    const msg = parsed.Message;
    if (!msg) return;

    // Check for ZORP emote
    if (msg.includes(ZORP_EMOTE)) {
      const player = extractPlayerName(msg);
      if (player) {
        console.log(`[ZORP] Emote detected for player: ${player} on server: ${serverName}`);
        await createZorpZone(client, guildId, serverName, ip, port, password, player);
      }
    }
  } catch (error) {
    console.error('Error handling ZORP emote:', error);
  }
}

async function handleZorpDeleteEmote(client, guildId, serverName, parsed, ip, port, password) {
  try {
    const msg = parsed.Message;
    if (!msg) return;

    // Check for ZORP delete emote
    if (msg.includes(ZORP_DELETE_EMOTE)) {
      const player = extractPlayerName(msg);
      if (player) {
        console.log(`[ZORP] Delete emote detected for player: ${player} on server: ${serverName}`);
        await deleteZorpZone(client, guildId, serverName, ip, port, password, player);
      }
    }
  } catch (error) {
    console.error('Error handling ZORP delete emote:', error);
  }
}

async function createZorpZone(client, guildId, serverName, ip, port, password, playerName) {
  try {
    console.log(`[ZORP] Creating zone for player: ${playerName} on server: ${serverName}`);

    // Get server ID
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.rows.length === 0) {
      console.log(`[ZORP] Server not found: ${serverName}`);
      return;
    }
    
    const serverId = serverResult.rows[0].id;

    // Check if player already has a zone
    const existingZone = await pool.query(
      'SELECT name FROM zones WHERE server_id = ? AND owner = ?',
      [serverId, playerName]
    );

    if (existingZone.rows.length > 0) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You already have an active Zorp zone. Use the delete emote to remove it first.</color>`);
      console.log(`[ZORP] Player ${playerName} already has a zone`);
      return;
    }

    // Get player's team info
    const teamInfo = await getPlayerTeam(serverId, playerName);
    
    // Get server defaults for ZORP configuration
    const defaultsResult = await pool.query(
      'SELECT size, color_online, color_offline, radiation, delay, expire, min_team, max_team FROM zorp_defaults WHERE server_id = ?',
      [serverId]
    );

    // Use defaults if available, otherwise use hardcoded defaults
    const defaults = defaultsResult.rows.length > 0 ? defaultsResult.rows[0] : {
      size: 75,
      color_online: '0,255,0',
      color_offline: '255,0,0',
      radiation: 0,
      delay: 0,
      expire: 126000, // 35 hours in seconds
      min_team: 1,
      max_team: 8
    };

    // Check team size limits
    const teamSize = teamInfo ? teamInfo.length : 1;
    const minTeam = defaults.min_team;
    const maxTeam = defaults.max_team;

    if (teamSize < minTeam) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Please create a team</color>`);
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>you are under the minimum team limit</color>`);
      console.log(`[ZORP] Team size too small for ${playerName}: ${teamSize} < ${minTeam}`);
      return;
    }

    if (teamSize > maxTeam) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>you are over the team limit</color>`);
      console.log(`[ZORP] Team size too large for ${playerName}: ${teamSize} > ${maxTeam}`);
      return;
    }

    // Get player position
    const position = await sendRconCommand(ip, port, password, `printpos ${playerName}`);
    
    if (!position || !position.includes(',')) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Failed to get position</color>`);
      console.log(`[ZORP] Failed to get position for ${playerName}`);
      return;
    }

    // Parse position
    const posMatch = position.match(/\(([^)]+)\)/);
    if (!posMatch) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Invalid position format</color>`);
      console.log(`[ZORP] Invalid position format for ${playerName}: ${position}`);
      return;
    }

    const coords = posMatch[1].split(',').map(c => parseFloat(c.trim()));
    if (coords.length !== 3) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Invalid coordinates</color>`);
      console.log(`[ZORP] Invalid coordinates for ${playerName}: ${coords}`);
      return;
    }

    // Check for overlapping zones
    const existingZones = await pool.query(
      'SELECT name, position, size FROM zones WHERE server_id = ?',
      [serverId]
    );

    const newZonePos = { x: coords[0], y: coords[1], z: coords[2] };
    const newZoneSize = defaults.size;

    for (const zone of existingZones.rows) {
      if (zone.position) {
        const existingPos = typeof zone.position === 'string' ? JSON.parse(zone.position) : zone.position;
        const existingSize = zone.size || 75; // Default size if not set

        if (zonesOverlap(newZonePos, newZoneSize, existingPos, existingSize)) {
          await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You are too close to another ZORP!</color>`);
          console.log(`[ZORP] Zone overlap detected for ${playerName} - too close to zone ${zone.name}`);
          return;
        }
      }
    }

    // Create zone name with timestamp
    const timestamp = Date.now();
    const zoneName = `ZORP_${timestamp}`;

    // Create zone in-game using server defaults
    const zoneCommand = `zones.createcustomzone "${zoneName}" (${coords[0]},${coords[1]},${coords[2]}) 0 Sphere ${defaults.size} 0 0 0 0 0`;
    await sendRconCommand(ip, port, password, zoneCommand);

    // Set zone to online color immediately
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" color (${defaults.color_online})`);

    // Set zone enter/leave messages
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" showchatmessage 1`);
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" entermessage "You entered ${playerName} Zorp"`);
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" leavemessage "You left ${playerName} Zorp"`);

    // Save to database using server defaults
    const zoneData = {
      server_id: serverId,
      name: zoneName,
      owner: playerName,
      team: teamInfo,
      position: { x: coords[0], y: coords[1], z: coords[2] },
      size: defaults.size,
      color_online: defaults.color_online,
      color_offline: defaults.color_offline,
      radiation: defaults.radiation,
      delay: defaults.delay,
      expire: defaults.expire,
      min_team: minTeam,
      max_team: maxTeam
    };

    await pool.query(`
      INSERT INTO zones (server_id, name, owner, team, position, size, color_online, color_offline, radiation, delay, expire, min_team, max_team)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      zoneData.server_id, zoneData.name, zoneData.owner, JSON.stringify(zoneData.team),
      JSON.stringify(zoneData.position), zoneData.size, zoneData.color_online, zoneData.color_offline,
      zoneData.radiation, zoneData.delay, zoneData.expire, zoneData.min_team, zoneData.max_team
    ]);

    // Send success message
    await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Zorp successfully created.</color>`);

    // Log to admin feed
    await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🛡️ **ZORP Zone Created:** ${playerName} created zone ${zoneName}`);

    console.log(`[ZORP] Zone created successfully for ${playerName}: ${zoneName}`);

  } catch (error) {
    console.error('Error creating ZORP zone:', error);
  }
}

async function deleteZorpZone(client, guildId, serverName, ip, port, password, playerName) {
  try {
    console.log(`[ZORP] Deleting zone for player: ${playerName} on server: ${serverName}`);

    // Get server ID
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.rows.length === 0) {
      console.log(`[ZORP] Server not found: ${serverName}`);
      return;
    }
    
    const serverId = serverResult.rows[0].id;

    // Check if player has a zone
    const zoneResult = await pool.query(
      'SELECT name FROM zones WHERE server_id = ? AND owner = ?',
      [serverId, playerName]
    );

    if (zoneResult.rows.length === 0) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You don't have a Zorp zone to delete.</color>`);
      console.log(`[ZORP] Player ${playerName} has no zone to delete`);
      return;
    }

    const zoneName = zoneResult.rows[0].name;

    // Delete zone from game
    await sendRconCommand(ip, port, password, `zones.deletecustomzone "${zoneName}"`);

    // Delete zone from database
    await pool.query('DELETE FROM zones WHERE server_id = ? AND owner = ?', [serverId, playerName]);

    // Send success message
    await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Zorp successfully deleted!</color>`);

    // Log to admin feed
    await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🗑️ **ZORP Zone Deleted:** ${playerName} deleted zone ${zoneName}`);

    console.log(`[ZORP] Zone deleted successfully for ${playerName}: ${zoneName}`);

  } catch (error) {
    console.error('Error deleting ZORP zone:', error);
  }
}

async function getPlayerTeam(serverId, playerName) {
  try {
    // This is a simplified team lookup - you may need to implement actual team detection
    // For now, we'll return the player as a single-member team
    return [playerName];
  } catch (error) {
    console.error('Error getting player team:', error);
    return [playerName];
  }
}

async function updateZoneColor(zoneName, color, ip, port, password) {
  try {
    const colorCommand = `zones.editcustomzone "${zoneName}" color (${color})`;
    await sendRconCommand(ip, port, password, colorCommand);
    console.log(`[ZORP] Updated zone ${zoneName} color to ${color}`);
  } catch (error) {
    console.error(`Error updating zone color for ${zoneName}:`, error);
  }
}

async function restoreZonesOnStartup(client) {
  try {
    console.log('🔄 Restoring zones on bot startup...');
    
    const [result] = await pool.query(`
      SELECT z.*, rs.ip, rs.port, rs.password, g.discord_id as guild_id, rs.nickname
      FROM zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `);

    let restoredCount = 0;
    let errorCount = 0;

    for (const zone of result) {
      try {
        // Parse position
        const position = typeof zone.position === 'string' ? JSON.parse(zone.position) : zone.position;
        
        if (!position || !position.x || !position.y || !position.z) {
          console.log(`[ZORP] Skipping zone ${zone.name} - invalid position data`);
          continue;
        }

        // Recreate zone in-game
        const zoneCommand = `zones.createcustomzone "${zone.name}" (${position.x},${position.y},${position.z}) 0 Sphere ${zone.size} 0 0 0 0 0`;
        await sendRconCommand(zone.ip, zone.port, zone.password, zoneCommand);

        // Set zone color
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" color (${zone.color_online})`);

        // Set zone enter/leave messages
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" showchatmessage 1`);
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" entermessage "You entered ${zone.owner} Zorp"`);
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" leavemessage "You left ${zone.owner} Zorp"`);

        console.log(`[ZORP] Restored zone: ${zone.name} (owned by ${zone.owner}) on ${zone.nickname}`);
        restoredCount++;
        
      } catch (error) {
        console.error(`[ZORP] Error restoring zone ${zone.name}:`, error);
        errorCount++;
      }
    }

    console.log(`[ZORP] Zone restoration complete: ${restoredCount} zones restored, ${errorCount} errors`);
    
  } catch (error) {
    console.error('Error restoring zones on startup:', error);
  }
}

async function deleteExpiredZones(client) {
  try {
    const [result] = await pool.query(`
      SELECT z.*, rs.ip, rs.port, rs.password, g.discord_id as guild_id, rs.nickname
      FROM zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at + INTERVAL z.expire SECOND < CURRENT_TIMESTAMP
    `);

    for (const zone of result) {
      try {
        // Delete from game
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zone.name}"`);
        
        // Delete from database
        await pool.query('DELETE FROM zones WHERE id = ?', [zone.id]);
        
        console.log(`[ZORP] Deleted expired zone: ${zone.name}`);
        
        // Send to admin feed
        await sendFeedEmbed(client, zone.guild_id, zone.nickname, 'adminfeed', `🗑️ **ZORP Zone Expired:** ${zone.name} (owned by ${zone.owner})`);
        
      } catch (error) {
        console.error(`Error deleting expired zone ${zone.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error checking expired zones:', error);
  }
}

// Export functions for use in commands
module.exports = {
  startRconListeners,
  sendRconCommand,
  getServerInfo,
  activeConnections,
  restoreZonesOnStartup
}; 