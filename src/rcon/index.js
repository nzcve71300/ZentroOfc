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
        // Send to playerfeed
        await sendFeedEmbed(client, guildId, serverName, 'playerfeed', `**${player}** has joined the server!`);
      }
      if (msg.match(/has disconnected/)) {
        const player = msg.split(' ')[0];
        addToBuffer(guildId, serverName, 'leaves', player);
      }

      // Handle admin loot spawns
      if (msg.match(/\[ServerVar\] giving .* x /)) {

      // Handle Bradley and Helicopter events
      await handleEventDetection(client, guildId, serverName, msg, ip, port, password);
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
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname = $2',
      [guildId, serverName]
    );
    
    if (serverResult.rows.length === 0) {
      console.log('[KIT CLAIM DEBUG] Server not found:', serverName);
      return;
    }
    
    const serverId = serverResult.rows[0].id;

    // Check if kit is enabled
    const autokitResult = await pool.query(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = $1 AND kit_name = $2',
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
        'SELECT discord_id FROM players WHERE server_id = $1 AND ign = $2',
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
         WHERE ka.server_id = $1 AND p.ign = $2 AND ka.kitlist = $3`,
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
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1) AND nickname = $2',
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
      'SELECT enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = $1 AND position_type = $2',
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
      'SELECT x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = $1 AND position_type = $2',
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
    const result = await pool.query(`
      SELECT rs.*, g.discord_id as guild_discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
    `);
    for (const server of result.rows) {
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
  const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
  ws.on('open', () => {
    ws.send(JSON.stringify({ Identifier: 1, Message: command, Name: 'WebRcon' }));
    setTimeout(() => ws.close(), 500);
  });
}

async function sendFeedEmbed(client, guildId, serverName, channelType, message) {
  try {
    // Get the channel ID from database
    const result = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = $1 AND rs.nickname = $2 AND cs.channel_type = $3`,
      [guildId, serverName, channelType]
    );

    if (result.rows.length === 0) {
      console.log(`[${channelType.toUpperCase()}] No channel configured for ${serverName}: ${message}`);
      return;
    }

    const channelId = result.rows[0].channel_id;
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
    const result = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = $1 AND rs.nickname = $2 AND cs.channel_type = 'playercount'`,
      [guildId, serverName]
    );

    if (result.rows.length === 0) {
      console.log(`[PLAYER COUNT] No channel configured for ${serverName}: ${online} online, ${queued} queued`);
      return;
    }

    const channelId = result.rows[0].channel_id;
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
const eventFlags = new Map(); // Track event states per server

async function handleEventDetection(client, guildId, serverName, msg, ip, port, password) {
  try {
    // Get server ID
    const serverResult = await pool.query(
      'SELECT rs.id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = $1 AND rs.nickname = $2',
      [guildId, serverName]
    );

    if (serverResult.rows.length === 0) return;
    const serverId = serverResult.rows[0].id;

    // Get event configurations
    const configsResult = await pool.query(
      'SELECT event_type, enabled, kill_message, respawn_message FROM event_configs WHERE server_id = $1',
      [serverId]
    );

    if (configsResult.rows.length === 0) return;

    const key = `${guildId}_${serverName}`;
    if (!eventFlags.has(key)) {
      eventFlags.set(key, new Set());
    }
    const serverFlags = eventFlags.get(key);

    // Check for Bradley events
    const bradleyConfig = configsResult.rows.find(c => c.event_type === 'bradley');
    if (bradleyConfig && bradleyConfig.enabled) {
      await checkBradleyEvent(client, guildId, serverName, ip, port, password, bradleyConfig, serverFlags);
    }

    // Check for Helicopter events
    const helicopterConfig = configsResult.rows.find(c => c.event_type === 'helicopter');
    if (helicopterConfig && helicopterConfig.enabled) {
      await checkHelicopterEvent(client, guildId, serverName, ip, port, password, helicopterConfig, serverFlags);
    }

  } catch (error) {
    console.error('Error in event detection:', error);
  }
}

async function checkBradleyEvent(client, guildId, serverName, ip, port, password, config, serverFlags) {
  try {
    const bradley = await sendRconCommand(ip, port, password, "find_entity servergibs_bradley");
    
    if (bradley && bradley.includes("servergibs_bradley") && !serverFlags.has("BRADLEY")) {
      serverFlags.add("BRADLEY");
      
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
    console.error('Error checking Bradley event:', error);
  }
}

async function checkHelicopterEvent(client, guildId, serverName, ip, port, password, config, serverFlags) {
  try {
    const helicopter = await sendRconCommand(ip, port, password, "find_entity servergibs_patrolhelicopter");
    
    if (helicopter && helicopter.includes("servergibs_patrolhelicopter") && !serverFlags.has("HELICOPTER")) {
      serverFlags.add("HELICOPTER");
      
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
    console.error('Error checking Helicopter event:', error);
  }
}

// Export functions for use in commands
module.exports = {
  startRconListeners,
  sendRconCommand,
  getServerInfo,
  activeConnections
}; 