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
  ELITEkit1: 'd11_quick_chat_i_need_phrase_format d11_Metal_Fragments',
  ELITEkit2: 'd11_quick_chat_i_need_phrase_format metal.refined',
  ELITEkit3: 'd11_quick_chat_i_need_phrase_format d11_Scrap',
  ELITEkit4: 'd11_quick_chat_i_need_phrase_format lowgradefuel',
  ELITEkit5: 'd11_quick_chat_i_need_phrase_format d11_Food',
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
const kitClaimDeduplication = new Map(); // Track recent kit claims to prevent duplicates

// Book-a-Ride constants
const BOOKARIDE_EMOTE = 'd11_quick_chat_orders_slot_5';
const BOOKARIDE_CHOICES = {
  horse: 'd11_quick_chat_responses_slot_0',
  rhib: 'd11_quick_chat_responses_slot_1',
};

// ZORP constants
const ZORP_EMOTE = 'd11_quick_chat_questions_slot_1';
const ZORP_DELETE_EMOTE = 'd11_quick_chat_responses_slot_6';
const GOODBYE_EMOTE = 'd11_quick_chat_responses_slot_6'; // Alternative name for clarity

// Track online players per server
const onlinePlayers = new Map(); // serverKey -> Set of player names
const onlineStatusChecks = new Map(); // serverKey -> last check timestamp

// Track team IDs per player
const playerTeamIds = new Map(); // playerName -> teamId

// Add at the top of the file, after the existing imports
const lastOfflineCall = new Map(); // Track last offline call time per player

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
  
  // Initial sync on startup to ensure all zones are tracked
  setTimeout(() => {
    console.log('🚀 Performing initial zone sync on startup...');
    syncAllZonesToDatabase(client);
  }, 10000); // Wait 10 seconds after startup
  
  setInterval(() => {
    refreshConnections(client);
    pollPlayerCounts(client);
  }, 60000);
  setInterval(() => flushJoinLeaveBuffers(client), 60000);
  setInterval(() => flushKillFeedBuffers(client), 60000);
  setInterval(() => checkAllEvents(client), 60000); // Check for events every 60 seconds (reduced frequency)
  setInterval(() => deleteExpiredZones(client), 300000); // Check for expired zones every 5 minutes
  
  // Check player online status every 2 minutes (120000ms) for better Zorp detection
  setInterval(() => {
    checkAllPlayerOnlineStatus(client);
  }, 120000);
  
  // Sync zones from game to database every 10 minutes to ensure future-proof tracking
  setInterval(() => {
    syncAllZonesToDatabase(client);
  }, 600000); // 10 minutes
}

async function refreshConnections(client) {
  try {
    const [result] = await pool.execute('SELECT * FROM rust_servers');
    console.log(`📡 Found ${result.length} servers in database`);
    
    for (const server of result) {
      // Enhanced validation for server IP/port combinations
      if (!server.ip || 
          server.ip === '0.0.0.0' || 
          server.ip === 'PLACEHOLDER_IP' || 
          server.ip === 'localhost' ||
          server.ip === '127.0.0.1' ||
          !server.port || 
          server.port === 0 ||
          server.port < 1 ||
          server.port > 65535) {
        console.log(`⚠️ Skipping RCON connection for server ${server.nickname} - invalid IP/port: ${server.ip}:${server.port}`);
        continue;
      }
      
      // Validate IP format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(server.ip)) {
        console.log(`⚠️ Skipping RCON connection for server ${server.nickname} - invalid IP format: ${server.ip}`);
        continue;
      }
      
      const [guildResult] = await pool.execute('SELECT discord_id FROM guilds WHERE id = ?', [server.guild_id]);
      if (guildResult.length > 0) {
        const guildId = guildResult[0].discord_id;
        const key = `${guildId}_${server.nickname}`;
        if (!activeConnections[key]) {
          console.log(`🔗 Attempting RCON connection to ${server.nickname} (${server.ip}:${server.port})`);
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
  
  // Enhanced validation for connection parameters
  if (!ip || 
      ip === '0.0.0.0' || 
      ip === 'PLACEHOLDER_IP' || 
      ip === 'localhost' ||
      ip === '127.0.0.1' ||
      !port || 
      port === 0 ||
      port < 1 ||
      port > 65535) {
    console.log(`⚠️ Skipping RCON connection for ${serverName} - invalid parameters: ${ip}:${port}`);
    return;
  }
  
  // Validate IP format
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip)) {
    console.log(`⚠️ Skipping RCON connection for ${serverName} - invalid IP format: ${ip}`);
    return;
  }
  
  console.log(`🔗 Connecting to RCON: ${serverName} (${ip}:${port})`);
  const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
  activeConnections[key] = ws;

  ws.on('open', async () => {
    console.log(`🔥 Connected to RCON: ${serverName} (${guildId})`);
    // Enable team action logging
    await enableTeamActionLogging(ip, port, password);
    // Populate team IDs on startup
    await populateTeamIds(ip, port, password);
  });

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
        // Handle Zorp zone online immediately (only for reliable join messages)
        await handlePlayerOnline(client, guildId, serverName, player, ip, port, password);
      }
      
      // Note: We removed unreliable disconnect message detection for Zorp
      // Zorp will now rely on the same reliable polling system as playercount
      // This ensures consistency and reliability

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

      // Handle ZORP zone entry/exit messages
      await handleZorpZoneStatus(client, guildId, serverName, msg, ip, port, password);

      // Handle team changes
      await handleTeamChanges(client, guildId, serverName, msg, ip, port, password);

      // Track team changes for ZORP system
      await trackTeamChanges(msg);

      // Handle save messages - specifically "Saving X entities"
      if (msg.includes("[ SAVE ] Saving") && msg.includes("entities")) {
        const saveMatch = msg.match(/\[ SAVE \] Saving (\d+) entities/);
        if (saveMatch) {
          const entityCount = saveMatch[1];
          // Send colored message to game with just the entity count
          await sendRconCommand(ip, port, password, `say <color=#00FF00>Saving</color> <color=white>${entityCount} entities</color>`);
        }
      }

      // Check online status every 5 minutes (reduced frequency)
      const now = Date.now();
      const lastCheck = onlineStatusChecks.get(key) || 0;
      if (now - lastCheck > 300000) { // 5 minutes
        await checkPlayerOnlineStatus(client, guildId, serverName, ip, port, password);
        onlineStatusChecks.set(key, now);
      }

    } catch (err) {
      console.error('RCON listener error:', err);
    }
  });

  ws.on('close', () => {
    console.log(`❌ Disconnected from RCON: ${serverName} (${guildId})`);
    delete activeConnections[key];
    // Don't auto-reconnect for invalid servers
    if (ip !== '0.0.0.0' && 
        ip !== 'PLACEHOLDER_IP' && 
        ip !== 'localhost' &&
        ip !== '127.0.0.1' &&
        port !== 0 &&
        port >= 1 &&
        port <= 65535) {
      setTimeout(() => connectRcon(client, guildId, serverName, ip, port, password), 5000);
    }
  });

  ws.on('error', (err) => {
    // Only log connection refused errors once per server to avoid spam
    if (err.code === 'ECONNREFUSED') {
      console.log(`⚠️ RCON connection refused for ${serverName} (${ip}:${port}) - server may be offline`);
    } else if (err.code === 'ENOTFOUND') {
      console.log(`⚠️ RCON host not found for ${serverName} (${ip}:${port}) - check IP address`);
    } else if (err.code === 'ETIMEDOUT') {
      console.log(`⚠️ RCON connection timeout for ${serverName} (${ip}:${port}) - server may be slow to respond`);
    } else {
      console.error(`RCON Error (${serverName}):`, err.message);
    }
    ws.close();
  });
}

async function handleKillEvent(client, guildId, serverName, msg, ip, port, password) {
  try {
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) return;
    
    const serverId = serverResult[0].id;

    // Process kill with new killfeed processor
    const killData = await killfeedProcessor.processKill(msg, serverId);
    
    if (killData) {
      // Use the custom formatted message from killfeed processor
      const gameMessage = killData.message;
      
      // Create Discord message with clean formatting
      const discordMessage = `${killData.killer} ☠️ ${killData.victim}`;
      
      // Send formatted killfeed message to server
      sendRconCommand(ip, port, password, `say ${gameMessage}`);
      
      // Add to Discord killfeed buffer with clean format
      addToKillFeedBuffer(guildId, serverName, discordMessage);
      
      // Handle coin rewards for kills (only for player kills)
      if (killData.isPlayerKill) {
        await handleKillRewards(guildId, serverName, killData.killer, killData.victim, false);
      }
    } else {
      // Killfeed is disabled - only process stats and rewards without sending messages
      // Extract killer and victim for stats processing
      const { killer, victim } = killfeedProcessor.parseKillMessage(msg);
      
      if (killer && victim) {
        // Process stats even when killfeed is disabled
        await killfeedProcessor.processKillStats(killer, victim, serverId);
        
        // Handle coin rewards for player kills (even when killfeed is disabled)
        const isPlayerKill = await killfeedProcessor.isPlayerKill(victim, serverId);
        if (isPlayerKill) {
          await handleKillRewards(guildId, serverName, killer, victim, false);
        }
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
    const [guildResult] = await pool.query(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildResult.length === 0) return;
    
    const guildId_db = guildResult[0].id;
    
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
      [guildId_db, serverName]
    );
    
    if (serverResult.length === 0) return;
    
    const serverId = serverResult[0].id;

    // Check if player already exists
    const [existingPlayer] = await pool.query(
      'SELECT id FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
      [guildId_db, serverId, playerName]
    );

    if (existingPlayer.length === 0) {
      // Create new player record
      const [newPlayer] = await pool.query(
        'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (?, ?, ?, ?)',
        [guildId_db, serverId, null, playerName]
      );

      // Create player stats record
      await pool.query(
        'INSERT INTO player_stats (player_id, kills, deaths, kill_streak, highest_streak) VALUES (?, 0, 0, 0, 0)',
        [newPlayer.insertId]
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
    
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) return;
    
    const serverId = serverResult[0].id;
    const reward = isScientist ? 50 : 25; // Default rewards, could be configurable

    // Find player by IGN
    const [playerResult] = await pool.query(
      'SELECT id FROM players WHERE server_id = ? AND ign = ?',
      [serverId, sanitizedKiller]
    );

    if (playerResult.length > 0) {
      const playerId = playerResult[0].id;
      
      // Update player balance
      await pool.query(
        'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
        [reward, playerId]
      );
      
      // Record transaction
      await pool.query(
        'INSERT INTO transactions (player_id, amount, type) VALUES (?, ?, ?)',
        [playerId, reward, 'kill_reward']
      );
      
      console.log(`💰 Kill reward: ${sanitizedKiller} earned ${reward} coins for killing ${sanitizedVictim}`);
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
    
    // Deduplication check - prevent same kit claim within 5 seconds
    const dedupKey = `${serverName}:${player}:${kitKey}`;
    const now = Date.now();
    const lastClaim = kitClaimDeduplication.get(dedupKey);
    
    if (lastClaim && (now - lastClaim) < 5000) {
      console.log('[KIT CLAIM DEBUG] Duplicate claim detected, skipping:', dedupKey);
      return;
    }
    
    // Record this claim attempt
    kitClaimDeduplication.set(dedupKey, now);
    
    // Clean up old entries (older than 10 seconds)
    for (const [key, timestamp] of kitClaimDeduplication.entries()) {
      if (now - timestamp > 10000) {
        kitClaimDeduplication.delete(key);
      }
    }
    
    // Get server ID
    const [serverResult] = await pool.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log('[KIT CLAIM DEBUG] Server not found:', serverName);
      return;
    }
    
    const serverId = serverResult[0].id;

    // Check if kit is enabled
    const [autokitResult] = await pool.execute(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
      [serverId, kitKey]
    );

    console.log('[KIT CLAIM DEBUG] Autokit config:', autokitResult);

    if (autokitResult.length === 0 || !autokitResult[0].enabled) {
      console.log('[KIT CLAIM DEBUG] Kit not enabled or not found:', kitKey);
      return;
    }

    const kitConfig = autokitResult[0];
    const kitName = kitConfig.game_name || kitKey;

    // Check cooldown using database
    if (kitConfig.cooldown > 0) {
      const [cooldownResult] = await pool.execute(
        'SELECT claimed_at FROM kit_cooldowns WHERE server_id = ? AND kit_name = ? AND player_name = ? ORDER BY claimed_at DESC LIMIT 1',
        [serverId, kitKey, player]
      );
      
      if (cooldownResult.length > 0) {
        const lastClaimTime = new Date(cooldownResult[0].claimed_at).getTime() / 1000;
        const now = Math.floor(Date.now() / 1000);
        const cooldownSeconds = kitConfig.cooldown * 60;
        
        if (now - lastClaimTime < cooldownSeconds) {
          const remaining = Math.ceil((cooldownSeconds - (now - lastClaimTime)) / 60);
          console.log('[KIT CLAIM DEBUG] Cooldown active for:', kitKey, 'player:', player, 'remaining:', remaining, 'minutes');
          sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> please wait <color=white>before claiming again</color> <color=#800080>${remaining}m</color>`);
          return;
        }
      }
    }

    // Handle VIP kit authorization (in-game VIP role check)
    if (kitKey === 'VIPkit') {
      console.log('[KIT CLAIM DEBUG] Checking VIP authorization for player:', player);
      
      // Debug: Check what's in kit_auth table
      const [debugKitAuth] = await pool.query(
        'SELECT * FROM kit_auth WHERE kitlist = ?',
        ['VIPkit']
      );
      console.log('[KIT CLAIM DEBUG] All VIP kit_auth entries:', debugKitAuth);
      
      // Debug: Check server ID format
      console.log('[KIT CLAIM DEBUG] Server ID type:', typeof serverId);
      console.log('[KIT CLAIM DEBUG] Server ID value:', serverId);
      
      // For VIP kits, we need to check if the player has been added to the VIP kit list
      // This is managed through the kit_auth table with kitlist = 'VIPkit'
      const [playerResult] = await pool.query(
        'SELECT discord_id FROM players WHERE server_id = ? AND ign = ? AND discord_id IS NOT NULL',
        [serverId, player]
      );
      
      console.log('[KIT CLAIM DEBUG] Player lookup result:', playerResult);
      
      if (playerResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Player not linked for VIP kit:', player);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you must link your Discord account first</color> <color=#800080>to claim VIP kits</color>`);
        return;
      }
      
      // Check if player is authorized for VIP kit
      const [authResult] = await pool.query(
        `SELECT ka.* FROM kit_auth ka 
         JOIN players p ON ka.discord_id = p.discord_id 
         WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
        [serverId, player, 'VIPkit']
      );
      
      console.log('[KIT CLAIM DEBUG] VIP auth result:', authResult);
      console.log('[KIT CLAIM DEBUG] Server ID used:', serverId);
      console.log('[KIT CLAIM DEBUG] Player name used:', player);
      
      if (authResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Not authorized for VIP kit, player:', player);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you need to be added to VIP list to claim</color> <color=#800080>VIP kits</color>`);
        return;
      }
    }

    // Handle ELITE kit authorization (requires being added to kit list)
    if (kitKey.startsWith('ELITEkit')) {
      console.log('[KIT CLAIM DEBUG] Checking elite authorization for:', kitKey, 'player:', player);
      
      // Extract elite number from kit name (ELITEkit1 -> Elite1, ELITEkit2 -> Elite2, etc.)
      const eliteNumber = kitKey.replace('ELITEkit', '');
      const kitlistName = `Elite${eliteNumber}`;
      
      // First check if player is linked
      const [playerResult] = await pool.query(
        'SELECT discord_id FROM players WHERE server_id = ? AND ign = ? AND discord_id IS NOT NULL',
        [serverId, player]
      );
      
      if (playerResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Player not linked for elite kit:', kitKey, 'player:', player);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you must link your Discord account first</color> <color=#800080>to claim elite kits</color>`);
        return;
      }
      
      // Then check if player is authorized for this elite kit list
      const [authResult] = await pool.query(
        `SELECT ka.* FROM kit_auth ka 
         JOIN players p ON ka.discord_id = p.discord_id 
         WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
        [serverId, player, kitlistName]
      );
      
      console.log('[KIT CLAIM DEBUG] Elite auth result for', kitlistName, ':', authResult);
      console.log('[KIT CLAIM DEBUG] Server ID used:', serverId);
      console.log('[KIT CLAIM DEBUG] Player name used:', player);
      
      if (authResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Not authorized for elite kit', kitKey, 'player:', player);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you are not authorized for</color> <color=#800080>${kitName}</color>`);
        return;
      }
    }

    // Record claim in database and give kit
    await pool.query(
      'INSERT INTO kit_cooldowns (server_id, kit_name, player_name) VALUES (?, ?, ?)',
      [serverId, kitKey, player]
    );
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

    // Debug: Log all messages to see what emotes are being sent
    if (msg.includes('d11_quick_chat_combat_slot')) {
      console.log(`[TELEPORT DEBUG] Emote detected: ${msg}`);
    }

    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`[TELEPORT DEBUG] No server found for ${serverName} in guild ${guildId}`);
      return;
    }
    
    const serverId = serverResult[0].id;
    console.log(`[TELEPORT DEBUG] Server ID: ${serverId} for ${serverName}`);

    // Check for Outpost emote
    if (msg.includes('d11_quick_chat_combat_slot_2')) {
      const player = extractPlayerName(msg);
      console.log(`[TELEPORT DEBUG] Outpost emote detected for player: ${player}`);
      if (player) {
        await handlePositionTeleport(client, guildId, serverName, serverId, ip, port, password, 'outpost', player);
      }
    }

    // Check for Bandit Camp emote
    if (msg.includes('d11_quick_chat_combat_slot_0')) {
      const player = extractPlayerName(msg);
      console.log(`[TELEPORT DEBUG] Bandit Camp emote detected for player: ${player}`);
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
    console.log(`[TELEPORT DEBUG] Processing teleport for ${player} to ${positionType} on server ${serverId}`);
    
    // Get position configuration
    const configResult = await pool.query(
      'SELECT enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ? AND position_type = ?',
      [serverId.toString(), positionType]
    );

    console.log(`[TELEPORT DEBUG] Config result: ${configResult[0].length} records found`);
    if (configResult[0].length > 0) {
      const config = configResult[0][0];
      console.log(`[TELEPORT DEBUG] Config: enabled=${config.enabled}, delay=${config.delay_seconds}, cooldown=${config.cooldown_minutes}`);
      console.log(`[TELEPORT DEBUG] Raw config object:`, config);
      
      // Check if enabled (MySQL returns 1 for true, 0 for false)
      if (config.enabled === 1) {
        console.log(`[TELEPORT DEBUG] Teleport is ENABLED for ${positionType}`);
      } else {
        console.log(`[TELEPORT DEBUG] Teleport is DISABLED for ${positionType}`);
        return; // Position teleport is disabled
      }
    } else {
      console.log(`[TELEPORT DEBUG] No config found for ${positionType}`);
      return; // Position teleport is not configured
    }

    const config = configResult[0][0];

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
      [serverId.toString(), positionType]
    );

    console.log(`[TELEPORT DEBUG] Coordinates result: ${coordResult[0].length} records found`);
    if (coordResult[0].length > 0) {
      console.log(`[TELEPORT DEBUG] Coordinates: X=${coordResult[0][0].x_pos}, Y=${coordResult[0][0].y_pos}, Z=${coordResult[0][0].z_pos}`);
    }

    if (coordResult[0].length === 0) {
      console.log(`[TELEPORT DEBUG] No coordinates found for ${positionType}`);
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleport coordinates not configured</color>`);
      return;
    }

    console.log(`[TELEPORT DEBUG] Proceeding with teleport for ${player} to ${positionType}`);

    const coords = coordResult[0][0];
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
      console.log(`[TELEPORT DEBUG] Executing teleport command: ${teleportCommand}`);
      sendRconCommand(ip, port, password, teleportCommand);
      
      // Send success message
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleported to</color> <color=#800080>${positionDisplayName}</color> <color=white>successfully</color>`);
      
      // Update cooldown
      recentTeleports.set(cooldownKey, now);
      
      // Send to admin feed
      await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🚀 **Position Teleport:** ${player} teleported to ${positionDisplayName}`);
      console.log(`[TELEPORT DEBUG] Teleport completed successfully for ${player} to ${positionDisplayName}`);
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
  // Try multiple formats for player name extraction
  let match = logLine.match(/\[CHAT LOCAL\] (.*?) :/);
  if (match) return match[1];
  
  // Try JSON format
  if (logLine.includes('"Username"')) {
    try {
      const parsed = JSON.parse(logLine);
      if (parsed.Username) return parsed.Username;
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  
  // Try direct format
  match = logLine.match(/^([^:]+) :/);
  if (match) return match[1];
  
  return null;
}

function sendRconCommand(ip, port, password, command) {
  return new Promise((resolve, reject) => {
    console.log(`[RCON] Sending command to ${ip}:${port}: ${command}`);
    
    const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
    
    let responseReceived = false;
    
    ws.on('open', () => {
      console.log(`[RCON] Connected to ${ip}:${port}`);
      ws.send(JSON.stringify({ Identifier: 1, Message: command, Name: 'WebRcon' }));
    });
    
    ws.on('error', (error) => {
      console.error(`[RCON] WebSocket error for ${ip}:${port}:`, error.message);
      if (!responseReceived) {
        reject(new Error(`RCON connection failed: ${error.message}`));
      }
    });
    
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        console.log(`[RCON] Received response from ${ip}:${port}:`, parsed);
        
        if (parsed.Message) {
          responseReceived = true;
          ws.close();
          resolve(parsed.Message);
        }
      } catch (err) {
        console.error(`[RCON] Failed to parse response from ${ip}:${port}:`, err);
        if (!responseReceived) {
          reject(new Error(`Invalid RCON response: ${err.message}`));
        }
      }
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.error(`[RCON] Timeout for command to ${ip}:${port}: ${command}`);
        ws.close();
        reject(new Error('RCON command timeout'));
      }
    }, 10000);
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

    // Check for ZORP emote in the correct format: [CHAT LOCAL] player : d11_quick_chat_questions_slot_1
    if (msg.includes('[CHAT LOCAL]') && msg.includes(ZORP_EMOTE)) {
      const player = extractPlayerName(msg);
      if (player) {
        console.log(`[ZORP] Emote detected for player: ${player} on server: ${serverName}`);
        await createZorpZone(client, guildId, serverName, ip, port, password, player);
      } else {
        console.log(`[ZORP] Emote detected but could not extract player name from: ${msg}`);
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

    console.log(`[ZORP DEBUG] Checking message for delete emote: ${msg}`);

    // Check for ZORP delete emote in the correct format: [CHAT LOCAL] player : d11_quick_chat_responses_slot_6
    if (msg.includes('[CHAT LOCAL]') && msg.includes('d11_quick_chat_responses_slot_6')) {
      const player = extractPlayerName(msg);
      if (player) {
        console.log(`[ZORP] Delete emote detected for player: ${player} on server: ${serverName}`);
        
        // Get server ID for database operations
        const [serverResult] = await pool.query(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          [guildId, serverName]
        );
        
        if (serverResult.length === 0) {
          console.log(`[ZORP] Server not found: ${serverName}`);
          return;
        }
        
        const serverId = serverResult[0].id;
        
        // Check if player has a zone (try by owner first, then by any zone if owner is Unknown)
        let [zoneResult] = await pool.query(
          'SELECT name FROM zorp_zones WHERE server_id = ? AND owner = ?',
          [serverId, player]
        );

        console.log(`[ZORP DEBUG] Found ${zoneResult.length} zones by owner ${player}`);

        // If no zone found by owner, try to find any zone for this player (for synced zones with Unknown owner)
        if (zoneResult.length === 0) {
          console.log(`[ZORP] No zone found by owner ${player}, checking for any available zones...`);
          [zoneResult] = await pool.query(
            'SELECT name FROM zorp_zones WHERE server_id = ? LIMIT 1',
            [serverId]
          );
          console.log(`[ZORP DEBUG] Found ${zoneResult.length} zones by server lookup`);
        }

        if (zoneResult.length === 0) {
          console.log(`[ZORP] Player ${player} has no zone to delete`);
          return;
        }

        const zoneName = zoneResult[0].name;
        console.log(`[ZORP] Deleting zone: ${zoneName} for player: ${player}`);

        // Delete zone from game
        await sendRconCommand(ip, port, password, `zones.deletecustomzone "${zoneName}"`);
        console.log(`[ZORP] Sent delete command for zone: ${zoneName}`);

        // Delete zone from database by zone name (more reliable than owner)
        await pool.query('DELETE FROM zorp_zones WHERE name = ? AND server_id = ?', [zoneName, serverId]);
        console.log(`[ZORP] Deleted zone from database: ${zoneName}`);

        // Send success message
        await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${player}</color> <color=white>Zorp successfully deleted!</color>`);

        // Log to zorp feed
        await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${player} Zorp deleted`);

        console.log(`[ZORP] Zone deleted successfully for ${player}: ${zoneName}`);
      } else {
        console.log(`[ZORP] Delete emote detected but could not extract player name from: ${msg}`);
      }
    }
  } catch (error) {
    console.error('Error handling ZORP delete emote:', error);
  }
}

async function handleZorpZoneStatus(client, guildId, serverName, msg, ip, port, password) {
  try {
    // Only process zone entry/exit messages, not general online/offline
    const entryMatch = msg.match(/You entered (.+) Zorp/);
    const exitMatch = msg.match(/You left (.+) Zorp/);
    
    if (entryMatch) {
      const zoneOwner = entryMatch[1];
      console.log(`[ZORP] Zone entry detected for: ${zoneOwner} on server: ${serverName}`);
      // Don't send feed message here - only when player comes online
      // Just log the entry for debugging
    } else if (exitMatch) {
      const zoneOwner = exitMatch[1];
      console.log(`[ZORP] Zone exit detected for: ${zoneOwner} on server: ${serverName}`);
      // Don't send feed message here - only when player goes offline
      // Just log the exit for debugging
    }
    
    // Handle zone deletion messages
    const deleteMatch = msg.match(/Zone (.+) has been deleted/);
    if (deleteMatch) {
      const zoneName = deleteMatch[1];
      console.log(`[ZORP] Zone deletion detected: ${zoneName} on server: ${serverName}`);
      
      // Delete from database
      const [deleteResult] = await pool.query(
        'DELETE FROM zorp_zones WHERE name = ?',
        [zoneName]
      );
      
      if (deleteResult.affectedRows > 0) {
        console.log(`[ZORP] Deleted zone ${zoneName} from database`);
        // Send to zorp feed
        await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${zoneName} deleted`);
      } else {
        console.log(`[ZORP] Zone ${zoneName} not found in database`);
      }
    }
  } catch (error) {
    console.error('Error handling ZORP zone status:', error);
  }
}

async function setZoneToGreen(ip, port, password, playerName) {
  try {
    // Get zone name from database
    const [zoneResult] = await pool.query(
      'SELECT name, color_online FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    if (zoneResult.length > 0) {
      const zone = zoneResult[0];
      // Set zone to green settings: allow building (1), allow building damage (1), allow PvP (1)
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuilding 1`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuildingdamage 1`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowpvpdamage 1`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" color (${zone.color_online})`);
      console.log(`[ZORP] Set zone ${zone.name} to green (online) for ${playerName}`);
    }
  } catch (error) {
    console.error('Error setting zone to green:', error);
  }
}

async function setZoneToRed(ip, port, password, playerName) {
  try {
    // Get zone name from database
    const [zoneResult] = await pool.query(
      'SELECT name, color_offline FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    if (zoneResult.length > 0) {
      const zone = zoneResult[0];
      // Set zone to red settings: allow building (1), no building damage (0), no PvP (0)
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuilding 1`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuildingdamage 0`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowpvpdamage 0`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" color (${zone.color_offline})`);
      console.log(`[ZORP] Set zone ${zone.name} to red (offline) for ${playerName}`);
    }
  } catch (error) {
    console.error('Error setting zone to red:', error);
  }
}

async function handleTeamChanges(client, guildId, serverName, msg, ip, port, password) {
  try {
    // Check for team-related messages
    const teamCreatedMatch = msg.match(/(.+) created a team/);
    const teamJoinedMatch = msg.match(/(.+) joined (.+)'s team/);
    const teamLeftMatch = msg.match(/(.+) left (.+)'s team/);
    const teamKickedMatch = msg.match(/(.+) kicked (.+) from the team/);
    const teamDisbandedMatch = msg.match(/(.+) disbanded the team/);
    
    if (teamCreatedMatch || teamJoinedMatch || teamLeftMatch || teamKickedMatch || teamDisbandedMatch) {
      console.log(`[ZORP] Team change detected: ${msg}`);
      
      // Get all active ZORPs for this server
      const [serverResult] = await pool.query(
        'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
        [guildId, serverName]
      );
      
      if (serverResult.length === 0) return;
      
      const serverId = serverResult[0].id;
      const [zones] = await pool.query(
        'SELECT * FROM zorp_zones WHERE server_id = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
        [serverId]
      );
      
      for (const zone of zones) {
        try {
          // Delete zone from game
          await sendRconCommand(ip, port, password, `zones.deletecustomzone "${zone.name}"`);
          
          // Delete from database
          await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
          
          console.log(`[ZORP] Deleted zone ${zone.name} due to team change`);
          
          // Send to zorp feed
          await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${zone.owner} Zorp deleted - Team changed`);
          
        } catch (error) {
          console.error(`Error deleting zone ${zone.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error handling team changes:', error);
  }
}

async function createZorpZone(client, guildId, serverName, ip, port, password, playerName) {
  try {
    console.log(`[ZORP] Creating zone for player: ${playerName} on server: ${serverName}`);

    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`[ZORP] Server not found: ${serverName}`);
      return;
    }
    
    const serverId = serverResult[0].id;

    // Check if ZORPs are enabled for this server
    const [enabledResult] = await pool.query(
      'SELECT enabled FROM zorp_defaults WHERE server_id = ?',
      [serverId]
    );
    
    if (enabledResult.length > 0 && !enabledResult[0].enabled) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>ZORP system is currently disabled on this server.</color>`);
      console.log(`[ZORP] ZORP system disabled for server: ${serverName}`);
      return;
    }

    // Check if player already has a zone
    const [existingZone] = await pool.query(
      'SELECT name FROM zorp_zones WHERE server_id = ? AND owner = ?',
      [serverId, playerName]
    );

    if (existingZone.length > 0) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You already have an active Zorp zone. Use the goodbye emote to remove it first.</color>`);
      console.log(`[ZORP] Player ${playerName} already has a zone`);
      return;
    }

    // Get player's team info
    const teamInfo = await getPlayerTeam(ip, port, password, playerName);
    
    // Check if player is in a team
    if (!teamInfo) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You must be in a team to create a ZORP zone.</color>`);
      console.log(`[ZORP] Player ${playerName} is not in a team`);
      return;
    }

    // Check if player is the team owner
    if (teamInfo.owner !== playerName) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Only team owners can create ZORP zones.</color>`);
      console.log(`[ZORP] Player ${playerName} is not team owner. Owner is: ${teamInfo.owner}`);
      return;
    }
    
    // Get server defaults for ZORP configuration
    const [defaultsResult] = await pool.query(
      'SELECT size, color_online, color_offline, radiation, delay, expire, min_team, max_team FROM zorp_defaults WHERE server_id = ?',
      [serverId]
    );

    console.log(`[ZORP DEBUG] Server ID: ${serverId}`);
    console.log(`[ZORP DEBUG] Defaults query result:`, defaultsResult);

    // Use defaults if available, otherwise use hardcoded defaults
    const defaults = defaultsResult.length > 0 ? defaultsResult[0] : {
      size: 75,
      color_online: '0,255,0',
      color_offline: '255,0,0',
      radiation: 0,
      delay: 0,
      expire: 126000, // 35 hours in seconds
      min_team: 1,
      max_team: 8
    };

    console.log(`[ZORP DEBUG] Final defaults object:`, defaults);
    console.log(`[ZORP DEBUG] Size value: ${defaults.size}`);

    // Check team size limits
    const teamSize = teamInfo.members.length;
    const minTeam = defaults.min_team;
    const maxTeam = defaults.max_team;

    if (teamSize < minTeam) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Your team is too small. Minimum: ${minTeam} players</color>`);
      console.log(`[ZORP] Team size too small for ${playerName}: ${teamSize} < ${minTeam}`);
      return;
    }

    if (teamSize > maxTeam) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Your team is too large. Maximum: ${maxTeam} players</color>`);
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
    const [existingZones] = await pool.query(
      'SELECT name, position, size FROM zorp_zones WHERE server_id = ?',
      [serverId]
    );

    const newZonePos = { x: coords[0], y: coords[1], z: coords[2] };
    const newZoneSize = defaults.size;

    for (const zone of existingZones) {
      if (zone.position) {
        const existingPos = typeof zone.position === 'string' ? JSON.parse(zone.position) : zone.position;
        const existingSize = zone.size || 75; // Default size if not set

        console.log(`[ZORP DEBUG] Checking overlap with zone: ${zone.name}`);
        console.log(`[ZORP DEBUG] New zone position:`, newZonePos, `size: ${newZoneSize}`);
        console.log(`[ZORP DEBUG] Existing zone position:`, existingPos, `size: ${existingSize}`);

        if (zonesOverlap(newZonePos, newZoneSize, existingPos, existingSize)) {
          console.log(`[ZORP DEBUG] Zone overlap detected for ${playerName} - too close to zone ${zone.name}`);
          console.log(`[ZORP DEBUG] Sending overlap message to player: ${playerName}`);
          const overlapMessage = `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You are too close to another ZORP!</color>`;
          console.log(`[ZORP DEBUG] RCON command: ${overlapMessage}`);
          const result = await sendRconCommand(ip, port, password, overlapMessage);
          console.log(`[ZORP DEBUG] Overlap message result:`, result);
          console.log(`[ZORP] Zone overlap detected for ${playerName} - too close to zone ${zone.name}`);
          return;
        }
      }
    }

    // Create zone name with timestamp
    const timestamp = Date.now();
    const zoneName = `ZORP_${timestamp}`;

    // Create zone in-game using server defaults
    // Green zone settings: allow building (1), allow building damage (1), allow PvP (1)
    const zoneCommand = `zones.createcustomzone "${zoneName}" (${coords[0]},${coords[1]},${coords[2]}) 0 Sphere ${defaults.size} 1 0 0 1 1`;
    console.log(`[ZORP DEBUG] Executing zone creation command: ${zoneCommand}`);
    const createResult = await sendRconCommand(ip, port, password, zoneCommand);
    console.log(`[ZORP DEBUG] Zone creation result:`, createResult);

    // Set zone to online color immediately
    console.log(`[ZORP DEBUG] Setting zone color to: ${defaults.color_online}`);
    const colorResult = await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" color (${defaults.color_online})`);
    console.log(`[ZORP DEBUG] Color setting result:`, colorResult);

    // Set zone enter/leave messages
    console.log(`[ZORP DEBUG] Setting zone messages`);
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" showchatmessage 1`);
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" entermessage "You entered ${playerName} Zorp"`);
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" leavemessage "You left ${playerName} Zorp"`);

    // Save to database using server defaults
    const zoneData = {
      server_id: serverId,
      name: zoneName,
      owner: playerName,
      team: teamInfo,
      position: coords,
      size: defaults.size,
      color_online: defaults.color_online,
      color_offline: defaults.color_offline,
      radiation: defaults.radiation,
      delay: defaults.delay,
      expire: 2592000, // 30 days in seconds - real expiration handled by online/offline system
      min_team: minTeam,
      max_team: maxTeam
    };

    await pool.query(`
      INSERT INTO zorp_zones (server_id, name, owner, team, position, size, color_online, color_offline, radiation, delay, expire, min_team, max_team)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      zoneData.server_id, zoneData.name, zoneData.owner, JSON.stringify(zoneData.team),
      JSON.stringify(zoneData.position), zoneData.size, zoneData.color_online, zoneData.color_offline,
      zoneData.radiation, zoneData.delay, zoneData.expire, zoneData.min_team, zoneData.max_team
    ]);

    // Send success message
    await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Zorp successfully created.</color>`);

    // Log to zorp feed
    await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${playerName} Zorp created`);

    console.log(`[ZORP] Zone created successfully for ${playerName}: ${zoneName}`);

  } catch (error) {
    console.error('Error creating ZORP zone:', error);
  }
}

async function deleteZorpZone(client, guildId, serverName, ip, port, password, playerName) {
  try {
    console.log(`[ZORP] Deleting zone for player: ${playerName} on server: ${serverName}`);

    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`[ZORP] Server not found: ${serverName}`);
      return;
    }
    
    const serverId = serverResult[0].id;

    // Check if player has a zone
    const [zoneResult] = await pool.query(
      'SELECT name FROM zorp_zones WHERE server_id = ? AND owner = ?',
      [serverId, playerName]
    );

    if (zoneResult.length === 0) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You don't have a Zorp zone to delete.</color>`);
      console.log(`[ZORP] Player ${playerName} has no zone to delete`);
      return;
    }

    const zoneName = zoneResult[0].name;

    // Delete zone from game
    await sendRconCommand(ip, port, password, `zones.deletecustomzone "${zoneName}"`);

    // Delete zone from database
    await pool.query('DELETE FROM zorp_zones WHERE server_id = ? AND owner = ?', [serverId, playerName]);

    // Send success message
    await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Zorp successfully deleted!</color>`);

    // Log to zorp feed
    await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${playerName} Zorp deleted`);

    console.log(`[ZORP] Zone deleted successfully for ${playerName}: ${zoneName}`);

  } catch (error) {
    console.error('Error deleting ZORP zone:', error);
  }
}

async function getPlayerTeam(ip, port, password, playerName) {
  try {
    console.log(`[ZORP DEBUG] Getting team info for player: ${playerName}`);
    
    // Check if we have a tracked team ID for this player
    const teamId = playerTeamIds.get(playerName);
    if (!teamId) {
      console.log(`[ZORP DEBUG] No tracked team ID for ${playerName}, trying direct query...`);
      
      // Fallback: Try to get team info directly from server
      try {
        const allTeamsResult = await sendRconCommand(ip, port, password, 'relationshipmanager.teaminfoall');
        if (allTeamsResult) {
          const lines = allTeamsResult.split('\n');
          let currentTeamId = null;
          const teamMembers = [];
          let teamOwner = null;
          
          for (const line of lines) {
            // Check for team header line
            const teamHeaderMatch = line.match(/Team (\d+) member list:/);
            if (teamHeaderMatch) {
              // If we were processing a team and found our player, return that team
              if (currentTeamId && teamMembers.includes(playerName)) {
                console.log(`[ZORP DEBUG] Found ${playerName} in team ${currentTeamId} via direct query`);
                // Cache this team info
                playerTeamIds.set(playerName, currentTeamId);
                
                const playerTeam = { 
                  id: currentTeamId, 
                  owner: teamOwner, 
                  members: teamMembers 
                };
                
                console.log(`[ZORP DEBUG] Final team object from direct query:`, playerTeam);
                return playerTeam;
              }
              
              // Start new team
              currentTeamId = teamHeaderMatch[1];
              teamMembers.length = 0; // Clear array
              teamOwner = null;
              console.log(`[ZORP DEBUG] Processing team ${currentTeamId}`);
            } else if (currentTeamId && line.trim()) {
              // Process team member line
              const memberMatch = line.match(/^(.+?) \[(\d+)\]( \(LEADER\))?$/);
              if (memberMatch) {
                const memberName = memberMatch[1].trim();
                const isLeader = memberMatch[3] !== undefined;
                
                teamMembers.push(memberName);
                if (isLeader) {
                  teamOwner = memberName;
                }
                
                console.log(`[ZORP DEBUG] Team member: ${memberName}${isLeader ? ' (LEADER)' : ''}`);
              }
            }
          }
          
          // Check the last team
          if (currentTeamId && teamMembers.includes(playerName)) {
            console.log(`[ZORP DEBUG] Found ${playerName} in team ${currentTeamId} via direct query`);
            // Cache this team info
            playerTeamIds.set(playerName, currentTeamId);
            
            const playerTeam = { 
              id: currentTeamId, 
              owner: teamOwner, 
              members: teamMembers 
            };
            
            console.log(`[ZORP DEBUG] Final team object from direct query:`, playerTeam);
            return playerTeam;
          }
        }
      } catch (fallbackError) {
        console.error('[ZORP DEBUG] Fallback team query failed:', fallbackError);
      }
      
      console.log(`[ZORP DEBUG] No team found for ${playerName} via direct query either`);
      return null;
    }
    
    console.log(`[ZORP DEBUG] Found team ID ${teamId} for ${playerName}`);
    
    // Get detailed team info using the team ID
    const detailedTeamInfo = await sendRconCommand(ip, port, password, `relationshipmanager.teaminfo "${teamId}"`);
    console.log(`[ZORP DEBUG] Detailed team info: ${detailedTeamInfo}`);
    
    if (!detailedTeamInfo) {
      console.log(`[ZORP DEBUG] No detailed team info for team ${teamId}`);
      return null;
    }
    
    const teamLines = detailedTeamInfo.split('\n');
    const teamMembers = [];
    let teamOwner = null;
    
    for (const teamLine of teamLines) {
      console.log(`[ZORP DEBUG] Processing team line: ${teamLine}`);
      if (teamLine.includes('(LEADER)')) {
        const leaderMatch = teamLine.match(/(.+) \[(\d+)\] \(LEADER\)/);
        if (leaderMatch) {
          teamOwner = leaderMatch[1];
          teamMembers.push(leaderMatch[1]);
          console.log(`[ZORP DEBUG] Team leader: ${teamOwner}`);
        }
      } else if (teamLine.includes('Member:')) {
        const memberMatch = teamLine.match(/Member: (.+)/);
        if (memberMatch) {
          const member = memberMatch[1];
          teamMembers.push(member);
          console.log(`[ZORP DEBUG] Team member: ${member}`);
        }
      }
    }
    
    if (teamMembers.length === 0) {
      console.log(`[ZORP DEBUG] No team members found for team ${teamId}`);
      return null;
    }
    
    const playerTeam = { 
      id: teamId, 
      owner: teamOwner, 
      members: teamMembers 
    };
    
    console.log(`[ZORP DEBUG] Final team object:`, playerTeam);
    return playerTeam;
    
  } catch (error) {
    console.error('Error getting player team:', error);
    return null;
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
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `);

    console.log(`[ZORP DEBUG] Found ${result.length} zones to restore`);

    let restoredCount = 0;
    let errorCount = 0;

    for (const zone of result) {
      try {
        console.log(`[ZORP DEBUG] Attempting to restore zone: ${zone.name} (owned by ${zone.owner}) on ${zone.nickname}`);
        
        // Enable team action logging for this server
        await enableTeamActionLogging(zone.ip, zone.port, zone.password);
        
        // Parse position
        const position = typeof zone.position === 'string' ? JSON.parse(zone.position) : zone.position;
        
        if (!position || !position.x || !position.y || !position.z) {
          console.log(`[ZORP] Skipping zone ${zone.name} - invalid position data:`, position);
          continue;
        }

        console.log(`[ZORP DEBUG] Zone position: x=${position.x}, y=${position.y}, z=${position.z}`);

        // Recreate zone in-game
        const zoneCommand = `zones.createcustomzone "${zone.name}" (${position.x},${position.y},${position.z}) 0 Sphere ${zone.size} 1 0 0 1 1`;
        console.log(`[ZORP DEBUG] Executing restoration command: ${zoneCommand}`);
        const createResult = await sendRconCommand(zone.ip, zone.port, zone.password, zoneCommand);
        console.log(`[ZORP DEBUG] Restoration result for ${zone.name}:`, createResult);

        // Set zone color
        console.log(`[ZORP DEBUG] Setting color for ${zone.name} to: ${zone.color_online}`);
        const colorResult = await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" color (${zone.color_online})`);
        console.log(`[ZORP DEBUG] Color setting result for ${zone.name}:`, colorResult);

        // Set zone enter/leave messages
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" showchatmessage 1`);
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" entermessage "You entered ${zone.owner} Zorp"`);
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" leavemessage "You left ${zone.owner} Zorp"`);

        // Set zone to green (online) settings
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" allowbuilding 1`);
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" allowbuildingdamage 1`);
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" allowpvpdamage 1`);

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
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at + INTERVAL z.expire SECOND < CURRENT_TIMESTAMP
    `);

    for (const zone of result) {
      try {
        // Delete from game
        await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zone.name}"`);
        
        // Delete from database
        await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
        
        console.log(`[ZORP] Deleted expired zone: ${zone.name}`);
        
        // Send to zorp feed
        await sendFeedEmbed(client, zone.guild_id, zone.nickname, 'zorpfeed', `[ZORP] ${zone.owner} Zorp deleted`);
        
      } catch (error) {
        console.error(`Error deleting expired zone ${zone.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error checking expired zones:', error);
  }
}

async function enableTeamActionLogging(ip, port, password) {
  try {
    console.log('[ZORP] Enabling team action logging...');
    await sendRconCommand(ip, port, password, 'relationshipmanager.logteamactions "1"');
    console.log('[ZORP] Team action logging enabled');
  } catch (error) {
    console.error('Error enabling team action logging:', error);
  }
}

async function getOnlinePlayers(ip, port, password) {
  try {
    const result = await sendRconCommand(ip, port, password, 'users');
    if (!result) return new Set();
    
    const lines = result.split('\n');
    const players = new Set();
    
    for (const line of lines) {
      if (line.trim() && !line.includes('Users:') && !line.includes('Total:')) {
        const playerName = line.trim();
        if (playerName) {
          players.add(playerName);
        }
      }
    }
    
    return players;
  } catch (error) {
    console.error('Error getting online players:', error);
    return new Set();
  }
}

async function checkPlayerOnlineStatus(client, guildId, serverName, ip, port, password) {
  try {
    const serverKey = `${guildId}_${serverName}`;
    const currentOnline = await getOnlinePlayers(ip, port, password);
    const previousOnline = onlinePlayers.get(serverKey) || new Set();
    
    // Only process if we have valid data
    if (currentOnline.size === 0 && previousOnline.size === 0) {
      return; // Skip if no players detected
    }
    
    // Check who went offline - PRIMARY METHOD FOR ZORP OFFLINE DETECTION
    for (const player of previousOnline) {
      if (!currentOnline.has(player)) {
        // Only trigger offline if player was actually online before
        console.log(`[ZORP] Player ${player} went offline on ${serverName} (via polling)`);
        await handlePlayerOffline(client, guildId, serverName, player, ip, port, password);
      }
    }
    
    // Check who came online - PRIMARY METHOD FOR ZORP ONLINE DETECTION
    for (const player of currentOnline) {
      if (!previousOnline.has(player)) {
        // Only trigger online if player wasn't online before
        console.log(`[ZORP] Player ${player} came online on ${serverName} (via polling)`);
        await handlePlayerOnline(client, guildId, serverName, player, ip, port, password);
      }
    }
    
    // Update online players
    onlinePlayers.set(serverKey, currentOnline);
  } catch (error) {
    console.error('Error checking player online status:', error);
  }
}

async function handlePlayerOffline(client, guildId, serverName, playerName, ip, port, password) {
  try {
    // Clean player name by removing quotes
    const cleanPlayerName = playerName.replace(/^"|"$/g, '');
    
    // Deduplication: prevent multiple calls for the same player within 30 seconds
    const playerKey = `${guildId}_${serverName}_${cleanPlayerName}`;
    const now = Date.now();
    const lastCall = lastOfflineCall.get(playerKey) || 0;
    
    if (now - lastCall < 30000) { // 30 seconds
      console.log(`[ZORP] Skipping duplicate offline call for ${cleanPlayerName} (last call was ${Math.round((now - lastCall) / 1000)}s ago)`);
      return;
    }
    
    lastOfflineCall.set(playerKey, now);
    
    console.log(`[ZORP DEBUG] Processing offline for ${cleanPlayerName} on ${serverName}`);
    
    // Check if player has a Zorp zone before processing
    const [zoneResult] = await pool.query(
      'SELECT name FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [cleanPlayerName]
    );
    
    console.log(`[ZORP DEBUG] Found ${zoneResult.length} zones for ${cleanPlayerName}`);
    
    if (zoneResult.length > 0) {
      // Check if ALL team members are offline (not just the owner)
      const allTeamOffline = await checkIfAllTeamMembersOffline(ip, port, password, cleanPlayerName);
      
      if (allTeamOffline) {
        // Set zone to red only when ALL team members are offline
        await setZoneToRed(ip, port, password, cleanPlayerName);
        
        // Send offline message to zorp feed
        await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${cleanPlayerName} Zorp=red (All team offline)`);
        
        console.log(`[ZORP] Player ${cleanPlayerName} went offline, ALL team members offline, zone set to red`);
      } else {
        // At least one team member is still online, keep zone green
        console.log(`[ZORP] Player ${cleanPlayerName} went offline, but other team members are still online, keeping zone green`);
      }
    } else {
      console.log(`[ZORP] Player ${cleanPlayerName} went offline but has no Zorp zone`);
    }
  } catch (error) {
    console.error('Error handling player offline:', error);
  }
}

async function handlePlayerOnline(client, guildId, serverName, playerName, ip, port, password) {
  try {
    // Clean player name by removing quotes
    const cleanPlayerName = playerName.replace(/^"|"$/g, '');
    
    // Deduplication: prevent multiple calls for the same player within 30 seconds
    const playerKey = `${guildId}_${serverName}_${cleanPlayerName}`;
    const now = Date.now();
    const lastCall = lastOfflineCall.get(playerKey) || 0;
    
    if (now - lastCall < 30000) { // 30 seconds
      console.log(`[ZORP] Skipping duplicate online call for ${cleanPlayerName} (last call was ${Math.round((now - lastCall) / 1000)}s ago)`);
      return;
    }
    
    lastOfflineCall.set(playerKey, now);
    
    console.log(`[ZORP DEBUG] Processing online for ${cleanPlayerName} on ${serverName}`);
    
    // Check if player has a Zorp zone before processing
    const [zoneResult] = await pool.query(
      'SELECT name FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [cleanPlayerName]
    );
    
    console.log(`[ZORP DEBUG] Found ${zoneResult.length} zones for ${cleanPlayerName}`);
    
    if (zoneResult.length > 0) {
      // Set zone to green when ANY team member comes online
      await setZoneToGreen(ip, port, password, cleanPlayerName);
      
      // Send online message to zorp feed
      await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${cleanPlayerName} Zorp=green (Team member online)`);
      
      console.log(`[ZORP] Player ${cleanPlayerName} came online, zone set to green`);
    } else {
      // Check if this player is part of a team that has a zorp zone
      const teamInfo = await getPlayerTeam(ip, port, password, cleanPlayerName);
      if (teamInfo && teamInfo.owner) {
        // Check if team owner has a zorp zone
        const [teamZoneResult] = await pool.query(
          'SELECT name FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
          [teamInfo.owner]
        );
        
        if (teamZoneResult.length > 0) {
          // Set team owner's zone to green since a team member came online
          await setZoneToGreen(ip, port, password, teamInfo.owner);
          
          // Send online message to zorp feed
          await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${teamInfo.owner} Zorp=green (Team member ${cleanPlayerName} online)`);
          
          console.log(`[ZORP] Team member ${cleanPlayerName} came online, set team owner ${teamInfo.owner}'s zone to green`);
        }
      } else {
        console.log(`[ZORP] Player ${cleanPlayerName} came online but has no Zorp zone and is not in a team with a zorp`);
      }
    }
  } catch (error) {
    console.error('Error handling player online:', error);
  }
}

async function trackTeamChanges(msg) {
  try {
    // Helper function to clean player names
    const cleanPlayerName = (name) => {
      return name.replace(/^\[|\]$/g, ''); // Remove leading [ and trailing ]
    };

    // Track when players join teams
    const joinMatch = msg.match(/(.+) has joined (.+)s team, ID: \[(\d+)\]/);
    if (joinMatch) {
      const playerName = cleanPlayerName(joinMatch[1]);
      const teamId = joinMatch[3];
      playerTeamIds.set(playerName, teamId);
      console.log(`[ZORP] Player ${playerName} joined team ${teamId}`);
      return;
    }

    // Track when players leave teams
    const leaveMatch = msg.match(/(.+) has left (.+)s team, ID: \[(\d+)\]/);
    if (leaveMatch) {
      const playerName = cleanPlayerName(leaveMatch[1]);
      const teamId = leaveMatch[3];
      playerTeamIds.delete(playerName);
      console.log(`[ZORP] Player ${playerName} left team ${teamId}`);
      
      // Delete Zorp zone when player leaves team
      try {
        await deleteZorpZoneOnTeamLeave(playerName);
      } catch (error) {
        console.error(`[ZORP] Error deleting zone for ${playerName} after leaving team:`, error);
      }
      return;
    }

    // Track when teams are created
    const createMatch = msg.match(/(.+) created a team, ID: \[(\d+)\]/);
    if (createMatch) {
      const playerName = cleanPlayerName(createMatch[1]);
      const teamId = createMatch[2];
      playerTeamIds.set(playerName, teamId);
      console.log(`[ZORP] Player ${playerName} created team ${teamId}`);
      return;
    }

    // Track when players are kicked
    const kickMatch = msg.match(/(.+) kicked (.+) from the team, ID: \[(\d+)\]/);
    if (kickMatch) {
      const kickedPlayer = cleanPlayerName(kickMatch[2]);
      const teamId = kickMatch[3];
      playerTeamIds.delete(kickedPlayer);
      console.log(`[ZORP] Player ${kickedPlayer} was kicked from team ${teamId}`);
      
      // Delete Zorp zone when player is kicked
      try {
        await deleteZorpZoneOnTeamLeave(kickedPlayer);
      } catch (error) {
        console.error(`[ZORP] Error deleting zone for ${kickedPlayer} after being kicked:`, error);
      }
      return;
    }

    // Track when teams are disbanded
    const disbandMatch = msg.match(/(.+) disbanded the team, ID: \[(\d+)\]/);
    if (disbandMatch) {
      const teamId = disbandMatch[2];
      // Remove all players from this team and delete their zones
      for (const [player, id] of playerTeamIds.entries()) {
        if (id === teamId) {
          playerTeamIds.delete(player);
          console.log(`[ZORP] Player ${player} removed from disbanded team ${teamId}`);
          
          // Delete Zorp zone when team is disbanded
          try {
            await deleteZorpZoneOnTeamLeave(player);
          } catch (error) {
            console.error(`[ZORP] Error deleting zone for ${player} after team disband:`, error);
          }
        }
      }
      return;
    }
  } catch (error) {
    console.error('Error tracking team changes:', error);
  }
}

async function deleteZorpZoneOnTeamLeave(playerName) {
  try {
    console.log(`[ZORP] Checking for zones to delete for ${playerName} after leaving team...`);
    
    // Get all active zones for this player
    const [zones] = await pool.query(`
      SELECT z.*, rs.nickname, rs.ip, rs.port, rs.password, g.discord_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.owner = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [playerName]);
    
    if (zones.length === 0) {
      console.log(`[ZORP] No active zones found for ${playerName}`);
      return;
    }
    
    for (const zone of zones) {
      try {
        console.log(`[ZORP] Deleting zone ${zone.name} for ${playerName} on ${zone.nickname}...`);
        
        // Delete from game
        if (zone.ip && zone.port && zone.password) {
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zone.name}"`);
          console.log(`[ZORP] Deleted zone ${zone.name} from game`);
        }
        
        // Delete from database
        await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
        console.log(`[ZORP] Deleted zone ${zone.name} from database`);
        
        // Note: We can't send feed message here since we don't have client access
        // The zone deletion will be logged in the console
        
      } catch (deleteError) {
        console.error(`[ZORP] Error deleting zone ${zone.name}:`, deleteError);
      }
    }
    
    console.log(`[ZORP] Successfully deleted all zones for ${playerName}`);
    
  } catch (error) {
    console.error(`[ZORP] Error in deleteZorpZoneOnTeamLeave for ${playerName}:`, error);
  }
}

async function populateTeamIds(ip, port, password) {
  try {
    console.log('[ZORP] Populating team IDs on startup...');
    const teamInfoResult = await sendRconCommand(ip, port, password, 'relationshipmanager.teaminfoall');
    
    if (!teamInfoResult) {
      console.log('[ZORP] No team info available on startup');
      return;
    }
    
    const lines = teamInfoResult.split('\n');
    for (const line of lines) {
      if (line.includes('Team') && line.includes(':')) {
        const teamMatch = line.match(/Team (\d+):/);
        if (teamMatch) {
          const teamId = teamMatch[1];
          const detailedTeamInfo = await sendRconCommand(ip, port, password, `relationshipmanager.teaminfo "${teamId}"`);
          
          if (detailedTeamInfo) {
            const teamLines = detailedTeamInfo.split('\n');
            for (const teamLine of teamLines) {
              if (teamLine.includes('(LEADER)')) {
                const leaderMatch = teamLine.match(/(.+) \[(\d+)\] \(LEADER\)/);
                if (leaderMatch) {
                  const leader = leaderMatch[1];
                  playerTeamIds.set(leader, teamId);
                  console.log(`[ZORP] Found team leader ${leader} in team ${teamId}`);
                }
              } else if (teamLine.includes('Member:')) {
                const memberMatch = teamLine.match(/Member: (.+)/);
                if (memberMatch) {
                  const member = memberMatch[1];
                  playerTeamIds.set(member, teamId);
                  console.log(`[ZORP] Found team member ${member} in team ${teamId}`);
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`[ZORP] Populated ${playerTeamIds.size} team IDs on startup`);
  } catch (error) {
    console.error('Error populating team IDs:', error);
  }
}

async function checkAllPlayerOnlineStatus(client) {
  try {
    console.log('🔄 Checking player online status for all servers...');
    
    const [result] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
    `);
    
    for (const server of result) {
      try {
        console.log(`📡 Checking online status for ${server.nickname}...`);
        await checkPlayerOnlineStatus(client, server.guild_discord_id, server.nickname, server.ip, server.port, server.password);
      } catch (error) {
        console.error(`❌ Error checking online status for ${server.nickname}:`, error.message);
      }
    }
    
    console.log('✅ Player online status check completed');
  } catch (error) {
    console.error('❌ Error in checkAllPlayerOnlineStatus:', error);
  }
}

// Add this function after the existing helper functions
async function checkIfAllTeamMembersOffline(ip, port, password, playerName) {
  try {
    console.log(`[ZORP DEBUG] Checking if all team members are offline for: ${playerName}`);
    
    // Get player's team info
    const teamInfo = await getPlayerTeam(ip, port, password, playerName);
    
    if (!teamInfo) {
      console.log(`[ZORP DEBUG] No team found for ${playerName}`);
      return true; // No team = consider as "all offline"
    }
    
    console.log(`[ZORP DEBUG] Team info for ${playerName}:`, teamInfo);
    
    // Get online players
    const onlinePlayers = await getOnlinePlayers(ip, port, password);
    if (!onlinePlayers) {
      console.log(`[ZORP DEBUG] Could not get online players list`);
      return false; // Assume someone is online if we can't check
    }
    
    console.log(`[ZORP DEBUG] Online players:`, onlinePlayers);
    
    // Check if any team member is online
    for (const member of teamInfo.members) {
      if (onlinePlayers.includes(member)) {
        console.log(`[ZORP DEBUG] Team member ${member} is online`);
        return false; // At least one team member is online
      }
    }
    
    console.log(`[ZORP DEBUG] All team members are offline for ${playerName}`);
    return true; // All team members are offline
  } catch (error) {
    console.error('Error checking team offline status:', error);
    return false; // Assume someone is online if there's an error
  }
}

// FUTURE-PROOF ZONE SYNC FUNCTION
async function syncAllZonesToDatabase(client) {
  try {
    console.log('🔄 SYNCING ALL ZONES TO DATABASE (Future-proof)...');
    
    // Get all servers
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password, guild_id FROM rust_servers'
    );

    let totalZonesFound = 0;
    let totalZonesAdded = 0;

    for (const server of servers) {
      try {
        console.log(`📡 Syncing zones for ${server.nickname}...`);
        
        // Get zones from game server
        const gameZoneNames = await getZonesFromGameServer(server);
        console.log(`   🎯 Found ${gameZoneNames.length} ZORP zones in game for ${server.nickname}`);
        
        totalZonesFound += gameZoneNames.length;
        
        // Add missing zones to database
        for (const zoneName of gameZoneNames) {
          try {
            // Check if zone already exists in database
            const [existingZone] = await pool.query(
              'SELECT id FROM zorp_zones WHERE name = ? AND server_id = ?',
              [zoneName, server.id]
            );
            
            if (existingZone.length === 0) {
              // Add zone to database with 'Unknown' owner
              console.log(`   ➕ Adding missing zone to database: ${zoneName}`);
              await pool.query(
                'INSERT INTO zorp_zones (name, owner, server_id, created_at, expire) VALUES (?, ?, ?, NOW(), 86400)',
                [zoneName, 'Unknown', server.id]
              );
              console.log(`   ✅ Added zone: ${zoneName}`);
              totalZonesAdded++;
            }
          } catch (error) {
            console.log(`   ❌ Failed to add zone ${zoneName}:`, error.message);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Failed to sync ${server.nickname}:`, error.message);
      }
    }

    if (totalZonesAdded > 0) {
      console.log(`✅ SYNC COMPLETE: Added ${totalZonesAdded} missing zones to database`);
    } else {
      console.log(`✅ SYNC COMPLETE: All zones already tracked in database`);
    }

  } catch (error) {
    console.error('❌ Zone sync failed:', error);
  }
}

async function getZonesFromGameServer(server) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    ws.on('open', () => {
      // Get zones from game
      const zonesCommand = JSON.stringify({ Identifier: 1, Message: 'zones.listcustomzones', Name: 'WebRcon' });
      ws.send(zonesCommand);
    });
    
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.Message) {
          const zones = parsed.Message.split('\n').filter(line => line.trim());
          
          // Extract ZORP zones
          const zorpZones = zones.filter(zone => zone.includes('ZORP_'));
          
          // Extract zone names
          const gameZoneNames = zorpZones.map(zone => {
            const match = zone.match(/Name \[([^\]]+)\]/);
            return match ? match[1] : null;
          }).filter(name => name);
          
          ws.close();
          resolve(gameZoneNames);
        }
      } catch (err) {
        console.log(`   ❌ Failed to parse response from ${server.nickname}:`, err.message);
        ws.close();
        resolve([]); // Return empty array on error
      }
    });
    
    ws.on('error', (error) => {
      console.error(`   ❌ WebSocket error for ${server.nickname}:`, error.message);
      resolve([]); // Return empty array on error
    });
    
    ws.on('close', () => {
      // Connection closed
    });
  });
}

// Export functions for use in commands
module.exports = {
  startRconListeners,
  sendRconCommand,
  getServerInfo,
  activeConnections,
  restoreZonesOnStartup,
  sendFeedEmbed,
  updatePlayerCountChannel,
  enableTeamActionLogging,
  populateTeamIds
}; 