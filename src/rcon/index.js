const WebSocket = require('ws');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const pool = require('../db');
const { orangeEmbed } = require('../embeds/format');
const killfeedProcessor = require('../utils/killfeedProcessor');
const teleportSystem = require('../utils/teleportSystem');
const path = require('path');
const Logger = require('../utils/logger');

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
  ELITEkit6: 'd11_quick_chat_i_have_phrase_format hatchet',
  ELITEkit7: 'd11_quick_chat_i_have_phrase_format metal.refined',
  ELITEkit8: 'd11_quick_chat_i_have_phrase_format d11_Scrap',
  ELITEkit9: 'd11_quick_chat_i_have_phrase_format lowgradefuel',
  ELITEkit10: 'd11_quick_chat_i_have_phrase_format d11_Food',
  ELITEkit11: 'd11_quick_chat_i_have_phrase_format d11_Water',
  ELITEkit12: 'd11_quick_chat_i_have_phrase_format bow.hunting',
  ELITEkit13: 'd11_quick_chat_i_have_phrase_format pickaxe',
  ELITEkit14: 'd11_quick_chat_activities_phrase_format d11_Metal_Fragments',
  ELITEkit15: 'd11_quick_chat_activities_phrase_format d11_Medicine',
  ELITEkit16: 'd11_quick_chat_activities_phrase_format d11_Stone',
  ELITEkit17: 'd11_quick_chat_activities_phrase_format d11_Wood',
  ELITEkit18: 'd11_quick_chat_activities_phrase_format d11_Metal',
  ELITEkit19: 'd11_quick_chat_activities_phrase_format d11_Food',
  ELITEkit20: 'd11_quick_chat_activities_phrase_format d11_Water',
  ELITEkit21: 'd11_quick_chat_activities_phrase_format d11_Scrap',
};

// Teleport emote mappings
const TELEPORT_EMOTES = {
  bandit: 'd11_quick_chat_combat_slot_0',
  outpost: 'd11_quick_chat_combat_slot_2',
  tpn: 'd11_quick_chat_location_slot_0',
  tpne: 'd11_quick_chat_location_slot_1',
  tpe: 'd11_quick_chat_location_slot_2',
  tpse: 'd11_quick_chat_location_slot_3',
  tps: 'd11_quick_chat_location_slot_4',
  tpsw: 'd11_quick_chat_location_slot_5',
  tpw: 'd11_quick_chat_location_slot_6',
  tpnw: 'd11_quick_chat_location_slot_7',
};

// Kit delivery emote
const KIT_DELIVERY_EMOTE = 'd11_quick_chat_orders_slot_6';

// Recycler emote
const RECYCLER_EMOTE = 'd11_quick_chat_orders_slot_2';

// In-memory state tracking
const recentKitClaims = new Map();
const recentTeleports = new Map();
const bookARideState = new Map();
const bookARideCooldowns = new Map();
const lastPrintposRequest = new Map();
const kitClaimDeduplication = new Map(); // Track recent kit claims to prevent duplicates
const nightSkipVotes = new Map(); // Track night skip voting state
const nightSkipVoteCounts = new Map(); // Track vote counts per server
const nightSkipFailedAttempts = new Map(); // Track failed night skip attempts to prevent re-triggering

// ZORP Enhanced state tracking
const zorpTransitionTimers = new Map(); // Track zone transition timers
const zorpZoneStates = new Map(); // Track current zone states
const zorpOfflineTimers = new Map(); // Track offline expiration timers
const zorpOfflineStartTimes = new Map(); // Track when players went offline
const zorpOfflineExpireTimers = new Map(); // Track expire countdown timers (separate from offline timers)
const zorpTimerLocks = new Map(); // Prevent concurrent timer operations



// Bot kill tracking for respawn detection
const botKillTracking = new Map(); // Track players killed by bot for respawn detection

// Home Teleport state tracking
const homeTeleportState = new Map(); // Track home teleport state
const homeTeleportCooldowns = new Map(); // Track cooldowns per player

// Teleport System state tracking
const teleportCooldowns = new Map(); // Track teleport cooldowns per player

// Recycler state tracking
const recyclerState = new Map(); // Track recycler spawn state

// Book-a-Ride constants
const BOOKARIDE_EMOTE = 'd11_quick_chat_orders_slot_5';
const BOOKARIDE_CHOICES = {
  horse: 'd11_quick_chat_responses_slot_0',
  rhib: 'd11_quick_chat_responses_slot_1',
  mini: 'd11_quick_chat_responses_slot_2',
  car: 'd11_quick_chat_responses_slot_3',
};

// Home Teleport constants
const SET_HOME_EMOTE = 'd11_quick_chat_building_slot_3';
const TELEPORT_HOME_EMOTE = 'd11_quick_chat_combat_slot_1';
// HOME_CHOICES removed - no longer using yes/no confirmation for home teleport

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

// Track recent joins to prevent respawn spam
const recentJoins = new Map(); // playerName -> timestamp
const JOIN_COOLDOWN = 30000; // 30 seconds cooldown between join messages

// Event detection improvements
const eventDetectionCooldowns = new Map(); // Track cooldowns per server to prevent spam
const EVENT_DETECTION_COOLDOWN = 30000; // 30 seconds cooldown between checks per server
const EVENT_POLLING_INTERVAL = 30000; // Check every 30 seconds instead of 60

// Event detection state tracking
const eventFlags = new Map(); // Track event states to prevent duplicate messages
const serverEventStates = new Map(); // Track server-specific event states

// Bounty system tracking
const bountyTracking = new Map(); // serverId -> Map of playerName -> killStreak
const activeBounties = new Map(); // serverId -> current bounty player name

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
  
  // Initialize offline timers for zones that are already in red state
  setTimeout(() => {
    console.log('🚀 Initializing offline timers for existing red zones...');
    initializeOfflineTimers(client);
  }, 15000); // Wait 15 seconds after startup
  
  setInterval(() => {
    refreshConnections(client);
    pollPlayerCounts(client);
  }, 60000);
  setInterval(() => flushJoinLeaveBuffers(client), 60000);
  setInterval(() => flushKillFeedBuffers(client), 10000); // Flush every 10 seconds for high-volume servers
  setInterval(() => checkAllEvents(client), EVENT_POLLING_INTERVAL); // Check for events every 30 seconds for better detection
  setInterval(() => deleteExpiredZones(client), 300000); // Check for expired zones every 5 minutes
  
  // Cleanup old join tracking entries to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    const cutoff = now - (JOIN_COOLDOWN * 2); // Keep entries for 2x the cooldown period
    
    let cleanedCount = 0;
    for (const [key, timestamp] of recentJoins.entries()) {
      if (timestamp < cutoff) {
        recentJoins.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[PLAYERFEED] Cleaned up ${cleanedCount} old join tracking entries`);
    }
  }, 60000); // Clean up every minute
  
  // Cleanup old offline timer references to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours
    
    let cleanedCount = 0;
    for (const [zoneName, startTime] of zorpOfflineStartTimes.entries()) {
      if (startTime < cutoff) {
        zorpOfflineStartTimes.delete(zoneName);
        zorpOfflineTimers.delete(zoneName);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[CLEANUP] Cleaned up ${cleanedCount} old offline timer references`);
    }
  }, 600000); // Every 10 minutes
  
  // Check for night skip voting every 2 minutes
  setInterval(() => {
    checkAllServersForNightSkip(client);
  }, 120000); // 2 minutes
  
  // Check player online status every 2 minutes (120000ms) for better Zorp detection
  setInterval(() => {
    checkAllPlayerOnlineStatus(client);
  }, 120000);
  
  // Display scheduled messages every 3 minutes
  setInterval(() => {
    displayScheduledMessages(client);
  }, 180000); // 3 minutes
  
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

      // Only log RCON messages in DEBUG mode to reduce log spam
      if (process.env.LOG_LEVEL === 'DEBUG') {
        Logger.quiet('[RCON MSG]', msg);
      }
      


      // Handle player joins/leaves with respawn spam prevention
      if (msg.match(/has entered the game/)) {
        // Debug logging removed for production
        
        // Extract player name from LOG format: "08/25/2025 14:35:21:LOG: nzcve7130 [SCARLETT] has entered the game"
        let player;
        if (msg.includes('LOG:')) {
          // Format: "08/25/2025 14:35:21:LOG: nzcve7130 [SCARLETT] has entered the game"
          const match = msg.match(/LOG:\s+([^\s\[]+)/);
          player = match ? match[1] : null;
          // Debug logging removed for production
        } else {
          // Fallback to original method for non-LOG format
          player = msg.split(' ')[0];
          // Debug logging removed for production
        }
        
        if (!player) {
          // Debug logging removed for production
          return;
        }
        
        // Check if this is a real join or just a respawn
        const playerKey = `${guildId}_${serverName}_${player}`;
        const now = Date.now();
        const lastJoin = recentJoins.get(playerKey) || 0;
        
        // If player "joined" within the last 30 seconds, it's likely a respawn
        console.log(`[PLAYERFEED DEBUG] Checking respawn for ${player}: now=${now}, lastJoin=${lastJoin}, diff=${now - lastJoin}, JOIN_COOLDOWN=${JOIN_COOLDOWN}`);
        
        // Check if this is a respawn (either by timing OR by checking home teleport state)
        const serverStateKey = `${guildId}:${serverName}:`;
        let isHomeTeleportRespawn = false;
        
        for (const [stateKey, playerState] of homeTeleportState.entries()) {
          if (stateKey.startsWith(serverStateKey) && playerState.player === player && playerState.step === 'waiting_for_respawn') {
            isHomeTeleportRespawn = true;
            console.log(`[PLAYERFEED DEBUG] Found home teleport respawn state for ${player}`);
            break;
          }
        }
        
        if (now - lastJoin < JOIN_COOLDOWN || isHomeTeleportRespawn) {
          console.log(`[PLAYERFEED] Ignoring respawn for ${player} (last join was ${Math.round((now - lastJoin) / 1000)}s ago OR home teleport respawn detected)`);
          
          // Check if this respawn is for home teleport setup
          await handleHomeTeleportRespawn(client, guildId, serverName, player, ip, port, password);
          
          // Check if this respawn is for a player killed by the bot
          await handleBotKillRespawn(client, guildId, serverName, player, ip, port, password);
          
          return; // Skip this "join" - it's probably a respawn
        }
        
        // Record this join
        recentJoins.set(playerKey, now);
        console.log(`[PLAYERFEED DEBUG] Recorded join for ${player} at ${now}, playerKey: ${playerKey}`);
        
        // This appears to be a real join
        console.log(`[PLAYERFEED] Real join detected for ${player}`);
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

      // Handle note panel messages FIRST (before other handlers)
      if (msg.includes('[NOTE PANEL]') && msg.includes('changed name from')) {
        // Use a more flexible regex that handles multi-line content
        const match = msg.match(/\[NOTE PANEL\] Player \[ ([^\]]+) \] changed name from \[ ([^\]]*) \] to \[ ([^\]]*) \]/s);
        if (match) {
          const player = match[1].trim();
          const oldNote = match[2].replace(/\\n/g, '\n').trim();
          const newNote = match[3].replace(/\\n/g, '\n').trim();
          
          if (newNote && newNote !== oldNote) {
            // Send green and bold message in-game
            sendRconCommand(ip, port, password, `say <color=green><b>${newNote}</b></color>`);
            // Send to notefeed
            await sendFeedEmbed(client, guildId, serverName, 'notefeed', `**${player}** says: ${newNote}`);
            Logger.event(`[NOTEFEED] Note sent to Discord from ${player}: ${newNote}`);
          }
        }
        // Return early to prevent other handlers from processing this message
        return;
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

      // Handle Set Home emotes
      if (msg.includes(SET_HOME_EMOTE)) {
        await handleSetHome(client, guildId, serverName, parsed, ip, port, password);
      }

      // Handle Teleport Home emotes
      if (msg.includes(TELEPORT_HOME_EMOTE)) {
        await handleTeleportHome(client, guildId, serverName, parsed, ip, port, password);
      }

      // Home choice emotes removed - no longer using yes/no confirmation for home teleport

      // Handle ZORP emotes
      await handleZorpEmote(client, guildId, serverName, parsed, ip, port, password);
      await handleZorpDeleteEmote(client, guildId, serverName, parsed, ip, port, password);

      // Handle Kit Delivery emote
      await handleKitDeliveryEmote(client, guildId, serverName, parsed, ip, port, password);

      // Handle Recycler emote
      await handleRecyclerEmote(client, guildId, serverName, parsed, ip, port, password);

      // Handle Teleport System emotes
      const teleportEmotes = [
        { emote: TELEPORT_EMOTES.tpn, name: 'tpn' },
        { emote: TELEPORT_EMOTES.tpne, name: 'tpne' },
        { emote: TELEPORT_EMOTES.tpe, name: 'tpe' },
        { emote: TELEPORT_EMOTES.tpse, name: 'tpse' },
        { emote: TELEPORT_EMOTES.tps, name: 'tps' },
        { emote: TELEPORT_EMOTES.tpsw, name: 'tpsw' },
        { emote: TELEPORT_EMOTES.tpw, name: 'tpw' },
        { emote: TELEPORT_EMOTES.tpnw, name: 'tpnw' }
      ];

      for (const teleportEmote of teleportEmotes) {
        if (msg.includes(teleportEmote.emote)) {
          const player = extractPlayerName(msg);
          console.log(`[TELEPORT] ${teleportEmote.name.toUpperCase()} emote detected for player: ${player}`);
          // Debug logging removed for production
          if (player) {
            // Get server ID
            const [serverResult] = await pool.query(
              'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
              [guildId, serverName]
            );
            
            if (serverResult.length === 0) {
              console.log(`[TELEPORT] No server found for ${serverName} in guild ${guildId}`);
              return;
            }
            
            const serverId = serverResult[0].id;
            console.log(`[TELEPORT] Server ID: ${serverId} for ${serverName}`);
            
            await handleTeleportSystem(client, guildId, serverName, serverId, ip, port, password, player, teleportEmote.name);
          }
          break; // Only handle one teleport emote per message
        }
      }

      // Handle ZORP zone entry/exit messages
      await handleZorpZoneStatus(client, guildId, serverName, msg, ip, port, password);

      // Handle team changes
      await handleTeamChanges(client, guildId, serverName, msg, ip, port, password);

      // Track team changes for ZORP system
      await trackTeamChanges(msg);

      // Handle position responses for Book-a-Ride
      try {
        console.log(`[POSITION DEBUG] Processing message for position response: ${msg.substring(0, 50)}...`);
        await handlePositionResponse(client, guildId, serverName, msg, ip, port, password);
      } catch (error) {
        console.error('[BOOK-A-RIDE DEBUG] Error in handlePositionResponse:', error);
      }

      // Handle save messages - specifically "Saving X entities"
      if (msg.includes("[ SAVE ] Saving") && msg.includes("entities")) {
        const saveMatch = msg.match(/\[ SAVE \] Saving (\d+) entities/);
        if (saveMatch) {
          const entityCount = saveMatch[1];
          // Send colored message to game with just the entity count
          await sendRconCommand(ip, port, password, `say <color=#00FF00>Saving</color> <color=white>${entityCount} entities</color>`);
        }
      }

      // Handle event detection - specifically airdrop events
      if (msg.includes("[EVENT] Spawning [cargo_plane] for [event_airdrop]")) {
        console.log(`[EVENT] Airdrop event detected on ${serverName}`);
        await handleAirdropEvent(client, guildId, serverName, ip, port, password);
      }

      // Handle event detection - specifically locked crate events
      if (msg.includes("[EVENT] Spawning [ch47scientists.entity] for [event_cargoheli]")) {
        console.log(`[EVENT] Locked crate event detected on ${serverName}`);
        await handleLockedCrateEvent(client, guildId, serverName, ip, port, password);
      }

      // Handle event detection - specifically patrol helicopter events
      if (msg.includes("[EVENT] Spawning [patrolhelicopter] for [event_helicopter]")) {
        console.log(`[EVENT] Patrol helicopter event detected on ${serverName}`);
        await handlePatrolHelicopterEvent(client, guildId, serverName, ip, port, password);
      }

      // Handle night skip voting
      if (msg.includes("d11_quick_chat_responses_slot_0")) {
        console.log(`[NIGHT SKIP] Vote detected on ${serverName}`);
        await handleNightSkipVote(client, guildId, serverName, msg, ip, port, password);
      }

      // Check online status every 15 seconds (increased frequency for better Zorp detection)
      const now = Date.now();
      const lastCheck = onlineStatusChecks.get(key) || 0;
      if (now - lastCheck > 15000) { // 15 seconds instead of 30 seconds
        await checkPlayerOnlineStatus(client, guildId, serverName, ip, port, password);
        onlineStatusChecks.set(key, now);
      }

      // Check event gibs every 30 seconds
      const lastEventCheck = eventDetectionCooldowns.get(key) || 0;
      if (now - lastEventCheck > 30000) { // 30 seconds
        // Get server ID for event detection
        const [serverResult] = await pool.query(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          [guildId, serverName]
        );
        
        if (serverResult.length > 0) {
          const serverId = serverResult[0].id;
          await checkEventGibs(client, guildId, serverName, serverId, ip, port, password);
        }
        eventDetectionCooldowns.set(key, now);
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
      // Check if the bot (SCARLETT) killed someone
      if (killData.killer === 'SCARLETT' && killData.isPlayerKill) {
        console.log(`[BOT KILL] Bot killed ${killData.victim}, tracking for respawn`);
        
        // Track this kill for respawn detection
        const killKey = `${guildId}_${serverName}_${killData.victim}`;
        botKillTracking.set(killKey, {
          victim: killData.victim,
          killTime: Date.now(),
          serverName: serverName,
          guildId: guildId,
          ip: ip,
          port: port,
          password: password
        });
        
        // Set timeout to remove tracking after 20 seconds
        setTimeout(() => {
          if (botKillTracking.has(killKey)) {
            console.log(`[BOT KILL] 20 second timeout reached for ${killData.victim}, removing tracking`);
            botKillTracking.delete(killKey);
          }
        }, 20000); // 20 seconds
      }
      
      // Use the custom formatted message from killfeed processor
      const gameMessage = killData.message;
      
      // Create Discord message with clean formatting
      const discordMessage = `${killData.killer} ☠️ ${killData.victim}`;
      
      // Send formatted killfeed message to server
      sendRconCommand(ip, port, password, `say ${gameMessage}`);
      
      // Add to Discord killfeed buffer with clean format
      addToKillFeedBuffer(client, guildId, serverName, discordMessage);
      
      // Handle coin rewards for kills (both player kills and scientist kills)
      if (killData.isPlayerKill) {
        const rewardResult = await handleKillRewards(guildId, serverName, killData.killer, killData.victim, false);
        if (rewardResult && rewardResult.reward > 0) {
          // Get currency name for this server
          const { getCurrencyName } = require('../utils/economy');
          const currencyName = await getCurrencyName(serverId);
          
          sendRconCommand(ip, port, password, `say <color=#FFD700>${killData.killer}</color> <color=white>earned</color> <color=#00FF00>${rewardResult.reward} ${currencyName}</color> <color=white>for the kill!</color>`);
        }
        
        // Handle bounty system for player kills only
        await handleBountySystem(guildId, serverName, killData.killer, killData.victim, ip, port, password);
        
              } else if (killData.isScientistKill) {
          const rewardResult = await handleKillRewards(guildId, serverName, killData.killer, killData.victim, true);
          if (rewardResult && rewardResult.reward > 0) {
            // Get currency name for this server
            const { getCurrencyName } = require('../utils/economy');
            const currencyName = await getCurrencyName(serverId);
            
            sendRconCommand(ip, port, password, `say <color=#FFD700>${killData.killer}</color> <color=white>earned</color> <color=#00FF00>${rewardResult.reward} ${currencyName}</color> <color=white>for killing a scientist!</color>`);
          }
        }
    } else {
      // Killfeed is disabled - only process stats and rewards without sending messages
      // Extract killer and victim for stats processing
      const { killer, victim } = killfeedProcessor.parseKillMessage(msg);
      
      if (killer && victim) {
        // Process stats even when killfeed is disabled
        await killfeedProcessor.processKillStats(killer, victim, serverId);
        
        // Handle coin rewards for kills (both player kills and scientist kills, even when killfeed is disabled)
        const isPlayerKill = await killfeedProcessor.isPlayerKill(victim, serverId);
        const isScientistKill = await killfeedProcessor.isScientistKill(victim, serverId);
        
        if (isPlayerKill) {
          const rewardResult = await handleKillRewards(guildId, serverName, killer, victim, false);
          if (rewardResult && rewardResult.reward > 0) {
            // Get currency name for this server
            const { getCurrencyName } = require('../utils/economy');
            const currencyName = await getCurrencyName(serverId);
            
            sendRconCommand(ip, port, password, `say <color=#FFD700>${killer}</color> <color=white>earned</color> <color=#00FF00>${rewardResult.reward} ${currencyName}</color> <color=white>for the kill!</color>`);
          }
          
          // Handle bounty system for player kills only
          await handleBountySystem(guildId, serverName, killer, victim, ip, port, password);
          
        } else if (isScientistKill) {
          const rewardResult = await handleKillRewards(guildId, serverName, killer, victim, true);
          if (rewardResult && rewardResult.reward > 0) {
            // Get currency name for this server
            const { getCurrencyName } = require('../utils/economy');
            const currencyName = await getCurrencyName(serverId);
            
            sendRconCommand(ip, port, password, `say <color=#FFD700>${killer}</color> <color=white>earned</color> <color=#00FF00>${rewardResult.reward} ${currencyName}</color> <color=white>for killing a scientist!</color>`);
          }
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
      // Create new player record with unique placeholder Discord ID since NULL is not allowed
      // Use a hash of the player name to create a unique numeric placeholder Discord ID
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(playerName + serverId).digest('hex');
      // Convert hex to numeric-only by taking the first 18 characters and converting letters to numbers
      const numericHash = hash.substring(0, 18).replace(/[a-f]/g, (match) => {
        return String(match.charCodeAt(0) - 97 + 1); // a->1, b->2, c->3, d->4, e->5, f->6
      });
      const uniquePlaceholder = numericHash.padStart(18, '0'); // Ensure 18 digits
      
      const [newPlayer] = await pool.query(
        'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (?, ?, ?, ?)',
        [guildId_db, serverId, uniquePlaceholder, playerName] // Use unique numeric placeholder for unlinked players
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
    
    // Get configurable reward amounts from eco_games_config
    let reward = 0;
    const rewardType = isScientist ? 'misckills_amount' : 'playerkills_amount';
    
    const [configResult] = await pool.query(
      'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = ?',
      [serverId, rewardType]
    );
    
    if (configResult.length > 0) {
      reward = parseInt(configResult[0].setting_value) || 0;
    } else {
      // Fallback to default values if not configured
      reward = isScientist ? 50 : 25;
    }

    // Only process if reward is greater than 0
    if (reward <= 0) {
      console.log(`💰 Kill reward: ${sanitizedKiller} killed ${sanitizedVictim} but no reward configured for ${rewardType}`);
      return;
    }

    // Find player by IGN
    const [playerResult] = await pool.query(
      'SELECT id FROM players WHERE server_id = ? AND ign = ?',
      [serverId, sanitizedKiller]
    );

    if (playerResult.length > 0) {
      const playerId = playerResult[0].id;
      
      // Get guild_id for the transaction
      const [guildResult] = await pool.query(
        'SELECT guild_id FROM rust_servers WHERE id = ?',
        [serverId]
      );
      
      if (guildResult.length > 0) {
        const guildIdForTransaction = guildResult[0].guild_id;
        
        // Update player balance
        await pool.query(
          'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
          [reward, playerId]
        );
        
        // Record transaction with guild_id
        await pool.query(
          'INSERT INTO transactions (player_id, amount, type, guild_id) VALUES (?, ?, ?, ?)',
          [playerId, reward, 'kill_reward', guildIdForTransaction]
        );
        
        const killType = isScientist ? 'scientist' : 'player';
        // Get currency name for this server
      const { getCurrencyName } = require('../utils/economy');
      const currencyName = await getCurrencyName(serverId);
      
      console.log(`💰 Kill reward: ${sanitizedKiller} earned ${reward} ${currencyName} for killing ${sanitizedVictim} (${killType} kill)`);
        
        return { reward, playerId: playerId };
      }
    }
    
    return { reward: 0, playerId: null };
  } catch (error) {
    console.error('Error handling kill rewards:', error);
    return { reward: 0, playerId: null };
  }
}

async function handleBountySystem(guildId, serverName, killer, victim, ip, port, password) {
  try {
    // Only process player kills for bounty system
    if (!killer || !victim) return;
    
    const sanitizedKiller = killer.replace(/\0/g, '').trim();
    const sanitizedVictim = victim.replace(/\0/g, '').trim();
    
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) return;
    
    const serverId = serverResult[0].id;
    
    // Check if bounty system is enabled
    const [bountyConfig] = await pool.query(
      'SELECT enabled, reward_amount, kills_required FROM bounty_configs WHERE server_id = ?',
      [serverId]
    );
    
    if (bountyConfig.length === 0 || !bountyConfig[0].enabled) {
      return; // Bounty system is disabled
    }
    
    const config = bountyConfig[0];
    const killsRequired = config.kills_required || 5;
    
    // Check if victim was the current bounty
    const currentBounty = activeBounties.get(serverId);
    if (currentBounty === sanitizedVictim) {
      // Bounty was claimed!
      await handleBountyClaimed(guildId, serverName, sanitizedKiller, sanitizedVictim, serverId, config.reward_amount, ip, port, password);
      return;
    }
    
    // Update killer's kill streak
    await updateKillStreak(serverId, sanitizedKiller, killsRequired, ip, port, password);
    
    // Reset victim's kill streak (they died)
    await resetKillStreak(serverId, sanitizedVictim);
    
  } catch (error) {
    console.error('Error handling bounty system:', error);
  }
}

async function updateKillStreak(serverId, playerName, killsRequired, ip, port, password) {
  try {
    // Get or create bounty tracking record
    const [trackingResult] = await pool.query(
      'SELECT * FROM bounty_tracking WHERE server_id = ? AND player_name = ?',
      [serverId, playerName]
    );
    
    let currentStreak = 0;
    let playerId = null;
    
    if (trackingResult.length > 0) {
      currentStreak = trackingResult[0].kill_streak || 0;
      playerId = trackingResult[0].player_id;
    } else {
      // Create new tracking record
      const [playerResult] = await pool.query(
        'SELECT id FROM players WHERE server_id = ? AND ign = ?',
        [serverId, playerName]
      );
      
      if (playerResult.length > 0) {
        playerId = playerResult[0].id;
      }
      
      await pool.query(
        'INSERT INTO bounty_tracking (server_id, player_name, player_id, kill_streak) VALUES (?, ?, ?, 1)',
        [serverId, playerName, playerId]
      );
      currentStreak = 1;
    }
    
    // Update kill streak
    const newStreak = currentStreak + 1;
    await pool.query(
      'UPDATE bounty_tracking SET kill_streak = ?, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND player_name = ?',
      [newStreak, serverId, playerName]
    );
    
    // Check if player should become bounty
    if (newStreak >= killsRequired) {
      const currentBounty = activeBounties.get(serverId);
      
      // Only set new bounty if there isn't one already
      if (!currentBounty) {
        await setNewBounty(serverId, playerName, ip, port, password);
      }
    }
    
  } catch (error) {
    console.error('Error updating kill streak:', error);
  }
}

async function resetKillStreak(serverId, playerName) {
  try {
    await pool.query(
      'UPDATE bounty_tracking SET kill_streak = 0, updated_at = CURRENT_TIMESTAMP WHERE server_id = ? AND player_name = ?',
      [serverId, playerName]
    );
  } catch (error) {
    console.error('Error resetting kill streak:', error);
  }
}

async function setNewBounty(serverId, playerName, ip, port, password) {
  try {
    // Get bounty configuration
    const [bountyConfig] = await pool.query(
      'SELECT reward_amount FROM bounty_configs WHERE server_id = ?',
      [serverId]
    );
    
    if (bountyConfig.length === 0) return;
    
    const rewardAmount = bountyConfig[0].reward_amount || 100;
    
    // Get currency name
    const { getCurrencyName } = require('../utils/economy');
    const currencyName = await getCurrencyName(serverId);
    
    // Set as active bounty
    activeBounties.set(serverId, playerName);
    
    // Update database
    await pool.query(
      'UPDATE bounty_tracking SET is_active_bounty = TRUE, bounty_created_at = CURRENT_TIMESTAMP WHERE server_id = ? AND player_name = ?',
      [serverId, playerName]
    );
    
    // Send bounty announcement with specified colors and size
    const bountyMessage = `[BOUNTY] Eliminate the Bounty <color=#8B0000>${playerName}</color> reward =<color=#8B0000>${rewardAmount} ${currencyName}</color>`;
    sendRconCommand(ip, port, password, `say <size=35>${bountyMessage}</size>`);
    
    console.log(`🎯 New bounty set: ${playerName} on server ${serverId} for ${rewardAmount} ${currencyName}`);
    
    // Log to admin feed channel
    const [serverResult] = await pool.query(
      'SELECT rs.nickname, rs.guild_id FROM rust_servers rs WHERE rs.id = ?',
      [serverId]
    );
    
    if (serverResult.length > 0) {
      const serverName = serverResult[0].nickname;
      const guildId = serverResult[0].guild_id;
      
      // Get Discord client from global reference
      const client = global.discordClient;
      if (client) {
        await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🎯 **Bounty Set:** ${playerName} has become a bounty worth ${rewardAmount} ${currencyName}`);
      }
    }
    
  } catch (error) {
    console.error('Error setting new bounty:', error);
  }
}

async function handleBountyClaimed(guildId, serverName, killer, victim, serverId, rewardAmount, ip, port, password) {
  try {
    // Get currency name
    const { getCurrencyName } = require('../utils/economy');
    const currencyName = await getCurrencyName(serverId);
    
    // Find killer's player record
    const [playerResult] = await pool.query(
      'SELECT id, discord_id FROM players WHERE server_id = ? AND ign = ?',
      [serverId, killer]
    );
    
    if (playerResult.length === 0) {
      console.log(`💰 Bounty claimed by ${killer} but player not found in database`);
      return;
    }
    
    const playerId = playerResult[0].id;
    const discordId = playerResult[0].discord_id;
    
    // Check if player is Discord linked
    if (!discordId) {
      console.log(`💰 Bounty claimed by ${killer} but player not Discord linked`);
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${killer}</color> <color=white>claimed the bounty but needs to link Discord to receive reward</color>`);
      return;
    }
    
    // Get guild_id for the transaction
    const [guildResult] = await pool.query(
      'SELECT guild_id FROM rust_servers WHERE id = ?',
      [serverId]
    );
    
    if (guildResult.length === 0) return;
    
    const guildIdForTransaction = guildResult[0].guild_id;
    
    // Update player balance
    await pool.query(
      'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
      [rewardAmount, playerId]
    );
    
    // Record transaction
    await pool.query(
      'INSERT INTO transactions (player_id, amount, type, guild_id) VALUES (?, ?, ?, ?)',
      [playerId, rewardAmount, 'bounty_reward', guildIdForTransaction]
    );
    
    // Update bounty tracking
    await pool.query(
      'UPDATE bounty_tracking SET is_active_bounty = FALSE, bounty_claimed_at = CURRENT_TIMESTAMP, claimed_by = ? WHERE server_id = ? AND player_name = ?',
      [killer, serverId, victim]
    );
    
    // Clear active bounty
    activeBounties.delete(serverId);
    
    // Send success message
    sendRconCommand(ip, port, password, `say <color=#FFD700>[BOUNTY]</color> <color=#8B0000>${killer}</color> <color=white>eliminated the bounty and earned</color> <color=#8B0000>${rewardAmount} ${currencyName}</color>`);
    
    console.log(`💰 Bounty claimed: ${killer} earned ${rewardAmount} ${currencyName} for killing ${victim}`);
    
    // Log to admin feed channel
    const [serverResult] = await pool.query(
      'SELECT rs.nickname, rs.guild_id FROM rust_servers rs WHERE rs.id = ?',
      [serverId]
    );
    
    if (serverResult.length > 0) {
      const serverName = serverResult[0].nickname;
      const guildId = serverResult[0].guild_id;
      
      // Get Discord client from global reference
      const client = global.discordClient;
      if (client) {
        await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `💰 **Bounty Claimed:** ${killer} eliminated bounty ${victim} and earned ${rewardAmount} ${currencyName}`);
      }
    }
    
  } catch (error) {
    console.error('Error handling bounty claim:', error);
  }
}

async function handleKitEmotes(client, guildId, serverName, parsed, ip, port, password) {
  let kitMsg = parsed.Message;
  let foundEmotes = new Set(); // Track found emotes to prevent double processing
  
  if (typeof kitMsg === 'string' && kitMsg.trim().startsWith('{')) {
    try {
      kitMsg = JSON.parse(kitMsg);
    } catch (e) {
      // If parsing fails, leave as string
    }
  }

  for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {
    let player = null;
    let processedEmote = false;
    
    // Check string format first (more reliable for player name extraction)
    if (typeof kitMsg === 'string' && kitMsg.includes(emote)) {
      player = extractPlayerName(kitMsg);
      processedEmote = true;
    } 
    // Only check object format if string format didn't match
    else if (typeof kitMsg === 'object' && kitMsg.Message && kitMsg.Message.includes(emote)) {
      player = kitMsg.Username || null;
      processedEmote = true;
    }
    
    // Only process if we found a valid player and haven't processed this emote yet
    if (player && processedEmote && !foundEmotes.has(kitKey)) {
      foundEmotes.add(kitKey);
              Logger.kit('Processing kit claim:', kitKey, 'for player:', player);
      await handleKitClaim(client, guildId, serverName, ip, port, password, kitKey, player);
    }
  }
}

async function handleKitClaim(client, guildId, serverName, ip, port, password, kitKey, player) {
  try {
    // Deduplication check - prevent same kit claim within 10 seconds
    const dedupKey = `${serverName}:${player}:${kitKey}`;
    const now = Date.now();
    const lastClaim = kitClaimDeduplication.get(dedupKey);
    
    if (lastClaim && (now - lastClaim) < 10000) {
      return;
    }
    
    // Record this claim attempt
    kitClaimDeduplication.set(dedupKey, now);
    
    // Clean up old entries (older than 20 seconds)
    for (const [key, timestamp] of kitClaimDeduplication.entries()) {
      if (now - timestamp > 20000) {
        kitClaimDeduplication.delete(key);
      }
    }
    
    // Get server ID
    const [serverResult] = await pool.execute(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
              // Debug logging removed for production
      return;
    }
    
    const serverId = serverResult[0].id;

    // Check if kit is enabled
    const [autokitResult] = await pool.execute(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
      [serverId, kitKey]
    );

    if (autokitResult.length === 0 || !autokitResult[0].enabled) {
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
          // Debug logging removed for production
          sendRconCommand(ip, port, password, `say [AUTOKITS] <color=#FF69B4>${player}</color> please wait <color=white>before claiming again</color> <color=#800080>${remaining}m</color>`);
          return;
        }
      }
    }

    // Check if player is in the kit list for VIP and ELITE kits
    if (kitKey === 'VIPkit' || kitKey.startsWith('ELITEkit')) {
              // Debug logging removed for production
      
      // Get the kitlist name
      let kitlistName;
      if (kitKey === 'VIPkit') {
        kitlistName = 'VIPkit';
      } else {
        // ELITEkit1 -> Elite1, ELITEkit2 -> Elite2, etc.
        const eliteNumber = kitKey.replace('ELITEkit', '');
        kitlistName = `Elite${eliteNumber}`;
      }
      
      // For VIP kits, check both database list AND in-game VIP role
      if (kitKey === 'VIPkit') {
        // First check if player is in the VIP list (database)
        const [authResult] = await pool.query(
          `SELECT ka.* FROM kit_auth ka 
           LEFT JOIN players p ON ka.discord_id = p.discord_id 
           WHERE ka.server_id = ? AND (
             (ka.kit_name = ? AND LOWER(ka.player_name) = LOWER(?)) OR
             (p.ign = ? AND ka.kitlist = ?)
           )`,
          [serverId, kitKey, player, player, kitlistName]
        );
        
        // If not in database list, check in-game VIP role
        if (authResult.length === 0) {
          console.log(`[VIP KIT] Player ${player} not in VIP list, checking in-game VIP role...`);
          
          // Send getauthlevel command to check in-game VIP role
          const authLevelResponse = await sendRconCommandWithResponse(ip, port, password, `getauthlevel ${player}`);
          
          console.log(`[VIP KIT] Auth level response for ${player}: "${authLevelResponse}"`);
          
          // Enhanced VIP detection - check multiple possible formats
          const hasVipRole = authLevelResponse && (
            authLevelResponse.includes(' - VIP') ||
            authLevelResponse.includes(' - VIP ') ||
            authLevelResponse.includes(' VIP') ||
            authLevelResponse.includes('VIP') ||
            authLevelResponse.toLowerCase().includes('vip')
          );
          
          if (hasVipRole) {
            console.log(`[VIP KIT] Player ${player} has in-game VIP role, allowing kit claim`);
          } else {
            console.log(`[VIP KIT] Player ${player} not in VIP list and no in-game VIP role - silently ignoring`);
            // Don't send any message - just silently ignore
            return;
          }
        } else {
          console.log(`[VIP KIT] Player ${player} found in VIP list`);
        }
      } else {
        // For ELITE kits, only check database list (no in-game role check)
        const [authResult] = await pool.query(
          `SELECT ka.* FROM kit_auth ka 
           LEFT JOIN players p ON ka.discord_id = p.discord_id 
           WHERE ka.server_id = ? AND (
             (ka.kit_name = ? AND LOWER(ka.player_name) = LOWER(?)) OR
             (p.ign = ? AND ka.kitlist = ?)
           )`,
          [serverId, kitKey, player, player, kitlistName]
        );
        
        if (authResult.length === 0) {
          console.log(`[ELITE KIT] Player ${player} not authorized for ${kitKey}`);
          // Don't send any message - just silently ignore
          return;
        }
      }
    }

    // Record claim in database and give kit
    await pool.query(
      'INSERT INTO kit_cooldowns (server_id, kit_name, player_name) VALUES (?, ?, ?)',
      [serverId, kitKey, player]
    );
            // Debug logging removed for production
    sendRconCommand(ip, port, password, `kit givetoplayer ${kitName} ${player}`);
    sendRconCommand(ip, port, password, `say [AUTOKITS] <color=#FF69B4>${player}</color> <color=white>claimed</color> <color=#800080>${kitName}</color>`);

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
      // Debug logging removed for production
    }

    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
              Logger.warn(`No server found for ${serverName} in guild ${guildId}`);
      return;
    }
    
    const serverId = serverResult[0].id;
            // Debug logging removed for production

    // Check for Outpost emote
    if (msg.includes('d11_quick_chat_combat_slot_2')) {
      const player = extractPlayerName(msg);
              // Debug logging removed for production
      if (player) {
        await handlePositionTeleport(client, guildId, serverName, serverId, ip, port, password, 'outpost', player);
      }
    }

    // Check for Bandit Camp emote
    if (msg.includes('d11_quick_chat_combat_slot_0')) {
      const player = extractPlayerName(msg);
              // Debug logging removed for production
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
          // Debug logging removed for production
    
    // Get position configuration
    const configResult = await pool.query(
      'SELECT enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ? AND position_type = ?',
      [serverId.toString(), positionType]
    );

    if (configResult[0].length > 0) {
      const config = configResult[0][0];
      // Debug logging removed for production
      
      // Check if enabled (MySQL returns 1 for true, 0 for false)
      if (config.enabled === 1) {
        // Debug logging removed for production
      } else {
        // Debug logging removed for production
        return; // Position teleport is disabled
      }
    } else {
      Logger.warn(`No teleport config found for ${positionType}`);
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

    if (coordResult[0].length === 0) {
      Logger.warn(`No coordinates found for ${positionType}`);
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleport coordinates not configured</color>`);
      return;
    }

          // Debug logging removed for production

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
        
        // Note: Removed admin feed logging to prevent spam
        // await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🚀 **Position Teleport:** ${player} teleported to ${positionDisplayName}`);
        
      }, config.delay_seconds * 1000);
      return; // CRITICAL FIX: Prevent execution of immediate teleport code
    } else {
      // Execute teleport immediately
      const teleportCommand = `global.teleportposrot "${coords.x_pos},${coords.y_pos},${coords.z_pos}" "${player}" "1"`;
      // Debug logging removed for production
      sendRconCommand(ip, port, password, teleportCommand);
      
      // Send success message
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleported to</color> <color=#800080>${positionDisplayName}</color> <color=white>successfully</color>`);
      
      // Update cooldown
      recentTeleports.set(cooldownKey, now);
      
      // Note: Removed admin feed logging to prevent spam
      // await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🚀 **Position Teleport:** ${player} teleported to ${positionDisplayName}`);
      Logger.info(`Teleport completed: ${player} → ${positionDisplayName}`);
    }

  } catch (error) {
    console.error('Error handling position teleport:', error);
  }
}

async function handleBookARide(client, guildId, serverName, parsed, ip, port, password) {
  try {
    const msg = parsed.Message;
    if (!msg) return;

    // Debug logging for Book-a-Ride
    console.log(`[BOOK-A-RIDE DEBUG] Processing message: ${msg}`);
    console.log(`[BOOK-A-RIDE DEBUG] Server: ${serverName}, Guild: ${guildId}`);

    // Get server ID and check if Book-a-Ride is enabled
    const [serverResult] = await pool.query(
      'SELECT rs.id, rc.enabled, rc.cooldown, rc.horse_enabled, rc.rhib_enabled, rc.mini_enabled, rc.car_enabled, rc.fuel_amount FROM rust_servers rs LEFT JOIN rider_config rc ON rs.id = rc.server_id WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND rs.nickname = ?',
      [guildId, serverName]
    );

    if (serverResult.length === 0) return;
    
    const serverId = serverResult[0].id;
    const isEnabled = serverResult[0].enabled !== 0; // Default to enabled if no config
    const cooldownMinutes = serverResult[0].cooldown || 5; // Default 5 minutes
    const cooldown = cooldownMinutes * 60; // Convert minutes to seconds
    const horseEnabled = serverResult[0].horse_enabled !== 0; // Default to enabled
    const rhibEnabled = serverResult[0].rhib_enabled !== 0; // Default to enabled
    const miniEnabled = serverResult[0].mini_enabled !== 0; // Default to disabled
    const carEnabled = serverResult[0].car_enabled !== 0; // Default to disabled
    const fuelAmount = serverResult[0].fuel_amount || 100; // Default 100 fuel

    if (!isEnabled) return;

    // Check for Book-a-Ride request emote
    if (msg.includes(BOOKARIDE_EMOTE)) {
      console.log(`[BOOK-A-RIDE DEBUG] Request emote detected!`);
      const player = extractPlayerName(msg);
      console.log(`[BOOK-A-RIDE DEBUG] Extracted player: ${player}`);
      if (!player) return;

      Logger.info(`Ride requested: ${player} on ${serverName}`);

      // Check cooldowns for all vehicle types
      const now = Date.now();
      const horseKey = `${serverId}:${player}:horse`;
      const rhibKey = `${serverId}:${player}:rhib`;
      const miniKey = `${serverId}:${player}:mini`;
      const carKey = `${serverId}:${player}:car`;
      
      const horseLastUsed = bookARideCooldowns.get(horseKey) || 0;
      const rhibLastUsed = bookARideCooldowns.get(rhibKey) || 0;
      const miniLastUsed = bookARideCooldowns.get(miniKey) || 0;
      const carLastUsed = bookARideCooldowns.get(carKey) || 0;
      
      const horseAvailable = horseEnabled && (now - horseLastUsed) >= cooldown * 1000;
      const rhibAvailable = rhibEnabled && (now - rhibLastUsed) >= cooldown * 1000;
      const miniAvailable = miniEnabled && (now - miniLastUsed) >= cooldown * 1000;
      const carAvailable = carEnabled && (now - carLastUsed) >= cooldown * 1000;
      
      if (!horseAvailable && !rhibAvailable && !miniAvailable && !carAvailable) {
        const horseRemaining = horseEnabled ? Math.ceil((cooldown * 1000 - (now - horseLastUsed)) / 1000) : 0;
        const rhibRemaining = rhibEnabled ? Math.ceil((cooldown * 1000 - (now - rhibLastUsed)) / 1000) : 0;
        const miniRemaining = miniEnabled ? Math.ceil((cooldown * 1000 - (now - miniLastUsed)) / 1000) : 0;
        const carRemaining = carEnabled ? Math.ceil((cooldown * 1000 - (now - carLastUsed)) / 1000) : 0;
        const shortestWait = Math.min(horseRemaining, rhibRemaining, miniRemaining || Infinity, carRemaining || Infinity);
        const shortestWaitMinutes = Math.ceil(shortestWait / 60);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#ff6b6b>${player}</color> <color=white>you must wait</color> <color=#ffa500>${shortestWaitMinutes}</color> <color=white>minutes before booking another ride</color>`);
        
        return;
      }

      // Get player position
      sendRconCommand(ip, port, password, `printpos "${player}"`);
      
      // Store the player's request state with availability info
      const stateKey = `${guildId}:${serverName}:${player}`;
      bookARideState.set(stateKey, {
        player: player,
        serverId: serverId,
        timestamp: now,
        step: 'waiting_for_position',
        horseAvailable: horseAvailable,
        rhibAvailable: rhibAvailable,
        miniAvailable: miniAvailable,
        carAvailable: carAvailable,
        fuelAmount: fuelAmount
      });

      // Set timeout to clean up state
      setTimeout(() => {
        bookARideState.delete(stateKey);
      }, 30000); // 30 second timeout

      return;
    }

    // Check for ride choice responses (yes/no emotes)
    const player = extractPlayerName(msg);
    if (!player) return;

    const stateKey = `${guildId}:${serverName}:${player}`;
    const playerState = bookARideState.get(stateKey);
    
    console.log(`[BOOK-A-RIDE DEBUG] Checking ride choice for player: ${player}`);
    console.log(`[BOOK-A-RIDE DEBUG] State key: ${stateKey}`);
    console.log(`[BOOK-A-RIDE DEBUG] Player state exists: ${playerState ? 'YES' : 'NO'}`);

    if (playerState && playerState.step === 'waiting_for_choice') {
      let chosenRide = null;

      if (msg.includes(BOOKARIDE_CHOICES.horse)) {
        chosenRide = 'horse';
      } else if (msg.includes(BOOKARIDE_CHOICES.rhib)) {
        chosenRide = 'rhib';
      } else if (msg.includes(BOOKARIDE_CHOICES.mini)) {
        chosenRide = 'mini';
      } else if (msg.includes(BOOKARIDE_CHOICES.car)) {
        chosenRide = 'car';
      }

      if (chosenRide && playerState.position) {
        Logger.info(`Ride chosen: ${player} → ${chosenRide}`);

        // Check if the chosen vehicle is available (double-check)
        const isAvailable = (chosenRide === 'horse' && playerState.horseAvailable) || 
                           (chosenRide === 'rhib' && playerState.rhibAvailable) ||
                           (chosenRide === 'mini' && playerState.miniAvailable) ||
                           (chosenRide === 'car' && playerState.carAvailable);
        
        if (!isAvailable) {
          sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#ff6b6b>${player}</color> <color=white>that vehicle is on cooldown</color>`);
          bookARideState.delete(stateKey);
          return;
        }

        // Set specific vehicle cooldown
        const vehicleKey = `${serverId}:${player}:${chosenRide}`;
        bookARideCooldowns.set(vehicleKey, Date.now());

        // Clear nearby entities first, then spawn vehicles
        const [x, y, z] = playerState.position.split(', ').map(coord => parseFloat(coord));
        
        if (chosenRide === 'horse') {
          // Clear nearby entities and spawn horse
          console.log(`[BOOK-A-RIDE DEBUG] Spawning horse for ${player} at position: ${playerState.position}`);
          sendRconCommand(ip, port, password, `entcount`);
          sendRconCommand(ip, port, password, `entity.deleteby testridablehorse ${x} ${y} ${z} 15`);
          setTimeout(() => {
            const spawnPosition = `(${playerState.position.replace(/, /g, ',')})`;
            console.log(`[BOOK-A-RIDE DEBUG] Executing horse spawn command: entity.spawn testridablehorse ${spawnPosition}`);
            sendRconCommand(ip, port, password, `entity.spawn testridablehorse ${spawnPosition}`);
            sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${player}</color> <color=white>your</color> <color=#8b4513>Horse</color> <color=white>has been delivered!</color>`);
          }, 1000);
        } else if (chosenRide === 'rhib') {
          // Clear nearby entities and spawn rhib  
          console.log(`[BOOK-A-RIDE DEBUG] Spawning RHIB for ${player} at position: ${playerState.position}`);
          sendRconCommand(ip, port, password, `entcount`);
          sendRconCommand(ip, port, password, `entity.deleteby rhib ${x} ${y} ${z} 15`);
          setTimeout(() => {
            const spawnPosition = `(${playerState.position.replace(/, /g, ',')})`;
            console.log(`[BOOK-A-RIDE DEBUG] Executing RHIB spawn command: entity.spawn rhib ${spawnPosition}`);
            sendRconCommand(ip, port, password, `entity.spawn rhib ${spawnPosition}`);
            sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${player}</color> <color=white>your</color> <color=#4169e1>Rhib</color> <color=white>has been delivered!</color>`);
            
            // Give fuel if amount is greater than 0
            if (playerState.fuelAmount > 0) {
              setTimeout(() => {
                console.log(`[BOOK-A-RIDE DEBUG] Giving fuel to ${player}: inventory.giveto "${player}" "lowgradefuel" "${playerState.fuelAmount}"`);
                sendRconCommand(ip, port, password, `inventory.giveto "${player}" "lowgradefuel" "${playerState.fuelAmount}"`);
                sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${player}</color> <color=white>you also received</color> <color=#ffa500>${playerState.fuelAmount} fuel</color> <color=white>!</color>`);
              }, 500);
            }
          }, 1000);
        } else if (chosenRide === 'mini') {
          // Clear nearby entities and spawn minicopter
          console.log(`[BOOK-A-RIDE DEBUG] Spawning minicopter for ${player} at position: ${playerState.position}`);
          sendRconCommand(ip, port, password, `entcount`);
          sendRconCommand(ip, port, password, `entity.deleteby minicopter.entity ${x} ${y} ${z} 15`);
          setTimeout(() => {
            // Add offset to spawn minicopter slightly away from player (5 units forward)
            const coords = playerState.position.split(', ').map(coord => parseFloat(coord));
            const offsetX = coords[0] + 5; // 5 units forward
            const offsetY = coords[1];
            const offsetZ = coords[2] + 2; // 2 units up to avoid ground collision
            const spawnPosition = `(${offsetX},${offsetY},${offsetZ})`;
            console.log(`[BOOK-A-RIDE DEBUG] Executing minicopter spawn command: entity.spawn minicopter.entity ${spawnPosition}`);
            sendRconCommand(ip, port, password, `entity.spawn minicopter.entity ${spawnPosition}`);
            sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${player}</color> <color=white>your</color> <color=#ffd700>Minicopter</color> <color=white>has been delivered!</color>`);
            
            // Give fuel if amount is greater than 0
            if (playerState.fuelAmount > 0) {
              setTimeout(() => {
                console.log(`[BOOK-A-RIDE DEBUG] Giving fuel to ${player}: inventory.giveto "${player}" "lowgradefuel" "${playerState.fuelAmount}"`);
                sendRconCommand(ip, port, password, `inventory.giveto "${player}" "lowgradefuel" "${playerState.fuelAmount}"`);
                sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${player}</color> <color=white>you also received</color> <color=#ffa500>${playerState.fuelAmount} fuel</color> <color=white>!</color>`);
              }, 500);
            }
          }, 1000);
        } else if (chosenRide === 'car') {
          // Clear nearby entities and spawn car
          console.log(`[BOOK-A-RIDE DEBUG] Spawning car for ${player} at position: ${playerState.position}`);
          sendRconCommand(ip, port, password, `entcount`);
          sendRconCommand(ip, port, password, `entity.deleteby 2module_car_spawned ${x} ${y} ${z} 15`);
          setTimeout(() => {
            // Add offset to spawn car slightly away from player (3 units forward)
            const coords = playerState.position.split(', ').map(coord => parseFloat(coord));
            const offsetX = coords[0] + 3; // 3 units forward
            const offsetY = coords[1];
            const offsetZ = coords[2]; // Keep same height for car
            const spawnPosition = `(${offsetX},${offsetY},${offsetZ})`;
            console.log(`[BOOK-A-RIDE DEBUG] Executing car spawn command: entity.spawn 2module_car_spawned ${spawnPosition}`);
            sendRconCommand(ip, port, password, `entity.spawn 2module_car_spawned ${spawnPosition}`);
            sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${player}</color> <color=white>your</color> <color=#ff4500>Car</color> <color=white>has been delivered!</color>`);
            
            // Give fuel if amount is greater than 0
            if (playerState.fuelAmount > 0) {
              setTimeout(() => {
                console.log(`[BOOK-A-RIDE DEBUG] Giving fuel to ${player}: inventory.giveto "${player}" "lowgradefuel" "${playerState.fuelAmount}"`);
                sendRconCommand(ip, port, password, `inventory.giveto "${player}" "lowgradefuel" "${playerState.fuelAmount}"`);
                sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${player}</color> <color=white>you also received</color> <color=#ffa500>${playerState.fuelAmount} fuel</color> <color=white>!</color>`);
              }, 500);
            }
          }, 1000);
        }

        // Clean up state
        bookARideState.delete(stateKey);

        // Log to admin feed
        await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🏇 **Rider:** ${player} spawned a ${chosenRide} at position (${playerState.position})`);
      }
    }

  } catch (error) {
    console.error('Error handling Book-a-Ride:', error);
  }
}

async function handlePositionResponse(client, guildId, serverName, msg, ip, port, password) {
  try {
          // Debug logging removed for production
    
    // Position data checking (debug removed for production)
    
    // Check if this is a position response (format: "(x, y, z)")
    const positionMatch = msg.match(/^\(([^)]+)\)$/);
    if (!positionMatch) {
      // Position-like message but regex failed (debug removed for production)
      return;
    }

    const positionStr = positionMatch[1];
          // Debug logging removed for production

    // Find any pending Book-a-Ride requests for this server
    const serverStateKey = `${guildId}:${serverName}:`;
    let foundPlayerState = null;
    let foundStateKey = null;
    
    for (const [stateKey, playerState] of bookARideState.entries()) {
      if (stateKey.startsWith(serverStateKey) && playerState.step === 'waiting_for_position') {
        foundPlayerState = playerState;
        foundStateKey = stateKey;
        break;
      }
    }

    if (!foundPlayerState) {
      // Check for home teleport position requests (use same approach as Book-a-Ride)
      const serverStateKey = `${guildId}:${serverName}:`;
      let foundHomeTeleportState = null;
      
      for (const [stateKey, playerState] of homeTeleportState.entries()) {
        if (stateKey.startsWith(serverStateKey) && playerState.step === 'waiting_for_position') {
          foundHomeTeleportState = [stateKey, playerState];
          break;
        }
      }

      if (foundHomeTeleportState) {
        const [homeStateKey, homeStateData] = foundHomeTeleportState;
        const playerName = homeStateData.player;

        console.log(`[HOME TELEPORT] Position response received for ${playerName}: ${positionStr}`);
        console.log(`[HOME TELEPORT DEBUG] Processing position for state key: ${homeStateKey}`);
        console.log(`[HOME TELEPORT DEBUG] Current state data:`, homeStateData);

        // Parse position coordinates (handle both "x, y, z" and "x,y,z" formats)
        const coords = positionStr.split(',').map(coord => parseFloat(coord.trim()));
        if (coords.length !== 3 || coords.some(isNaN)) {
          console.log(`[HOME TELEPORT] Invalid position format: ${positionStr}`);
          homeTeleportState.delete(homeStateKey);
          return;
        }

        // Get server ID
        const [serverResult] = await pool.query(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          [guildId, serverName]
        );

        if (serverResult.length === 0) {
          console.log(`[HOME TELEPORT] No server found for ${serverName}`);
          homeTeleportState.delete(homeStateKey);
          return;
        }

        const serverId = serverResult[0].id;

        // Save home teleport location to database
        await pool.query(
          `INSERT INTO player_homes (guild_id, server_id, player_name, x_pos, y_pos, z_pos, set_at, updated_at) 
           VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE x_pos = VALUES(x_pos), y_pos = VALUES(y_pos), z_pos = VALUES(z_pos), updated_at = CURRENT_TIMESTAMP`,
          [guildId, serverId, playerName, coords[0], coords[1], coords[2]]
        );

        // Clear the state
        homeTeleportState.delete(homeStateKey);

        // Send success message
        await sendRconCommand(ip, port, password, `say <color=#00FF00><b>SUCCESS!</b></color> <color=white>${playerName} home location saved successfully!</color>`);

        console.log(`[HOME TELEPORT] Home teleport location saved for ${playerName} at coordinates: ${coords[0]}, ${coords[1]}, ${coords[2]}`);
        return;
      }

      // Check for vehicle purchase position requests
      if (global.vehiclePurchaseRequests && global.vehiclePurchaseRequests.size > 0) {
        console.log(`[VEHICLE PURCHASE] Checking ${global.vehiclePurchaseRequests.size} pending vehicle requests`);
        
        // Get server ID first
        const [serverResult] = await pool.query(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          [guildId, serverName]
        );

        if (serverResult.length === 0) {
          console.log(`[VEHICLE PURCHASE] No server found for ${serverName} in guild ${guildId}`);
          return;
        }

        const serverId = serverResult[0].id;
        console.log(`[VEHICLE PURCHASE] Server ID: ${serverId}`);
        
        // Find the most recent vehicle purchase request for this server
        let foundVehicleRequest = null;
        let foundKey = null;
        
        for (const [key, request] of global.vehiclePurchaseRequests.entries()) {
          const [requestServerId, playerIgn, shortName] = key.split(':');
          
          // Check if this request is for the current server
          if (requestServerId === serverId.toString()) {
            console.log(`[VEHICLE PURCHASE] Found matching request for server ${serverId}: ${playerIgn} - ${shortName}`);
            foundVehicleRequest = request;
            foundKey = key;
            break;
          }
        }

        if (foundVehicleRequest) {
          const playerName = foundVehicleRequest.playerIgn;

          console.log(`[VEHICLE PURCHASE] Position response received for ${playerName}: ${positionStr}`);

          // Parse position coordinates (handle both "x, y, z" and "x,y,z" formats)
          const coords = positionStr.split(',').map(coord => parseFloat(coord.trim()));
          if (coords.length !== 3 || coords.some(isNaN)) {
            console.log(`[VEHICLE PURCHASE] Invalid position format: ${positionStr}`);
            global.vehiclePurchaseRequests.delete(foundKey);
            return;
          }

          console.log(`[VEHICLE PURCHASE] Parsed coordinates: ${coords[0]}, ${coords[1]}, ${coords[2]}`);

          // Clean up nearby entities and spawn vehicle exactly like BAR
          console.log(`[VEHICLE PURCHASE] Spawning ${foundVehicleRequest.shortName} for ${playerName} at position: ${positionStr}`);
          await sendRconCommand(ip, port, password, `entcount`);
          await sendRconCommand(ip, port, password, `entity.deleteby ${foundVehicleRequest.shortName} ${coords[0]} ${coords[1]} ${coords[2]} 15`);
          
          setTimeout(async () => {
            // Add offset to spawn vehicle slightly away from player (1 unit forward) like BAR
            const offsetX = coords[0] + 1; // 1 unit forward (reduced from 3)
            const offsetY = coords[1];
            const offsetZ = coords[2]; // Keep same height
            const spawnPosition = `(${offsetX},${offsetY},${offsetZ})`;
            
            // Execute vehicle spawn command exactly like BAR
            const vehicleCommand = `entity.spawn ${foundVehicleRequest.shortName} ${spawnPosition}`;
            console.log(`[VEHICLE PURCHASE] Executing command: ${vehicleCommand}`);
            await sendRconCommand(ip, port, password, vehicleCommand);
            
            // Send success message
            await sendRconCommand(ip, port, password, `say <color=#00FF00><b>SUCCESS!</b></color> <color=white>${playerName} purchased ${foundVehicleRequest.displayName}!</color>`);
            
            // Complete the purchase transaction
            await completeVehiclePurchase(foundVehicleRequest);
            
            // Clear the request
            global.vehiclePurchaseRequests.delete(foundKey);
            
            console.log(`[VEHICLE PURCHASE] Vehicle ${foundVehicleRequest.displayName} spawned for ${playerName} at coordinates: ${offsetX}, ${offsetY}, ${offsetZ}`);
          }, 1000); // 1 second delay like BAR
          
          return;
        }
      }

      // Check for recycler position requests
      const foundRecyclerState = Array.from(recyclerState.entries()).find(([key, state]) => {
        return state.step === 'waiting_for_position';
      });

      if (foundRecyclerState) {
        const [recyclerStateKey, recyclerStateData] = foundRecyclerState;
        const playerName = recyclerStateData.player;

        // Parse position coordinates (handle both "x, y, z" and "x,y,z" formats)
        const coords = positionStr.split(',').map(coord => parseFloat(coord.trim()));
        if (coords.length !== 3 || coords.some(isNaN)) {
          Logger.warn(`Invalid position format for recycler: ${positionStr}`);
          return;
        }

        // Get server ID
        const [serverResult] = await pool.query(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          [guildId, serverName]
        );

        if (serverResult.length === 0) {
          Logger.warn(`No server found for ${serverName} in guild ${guildId}`);
          return;
        }

        const serverId = serverResult[0].id;

        // Get recycler configuration
        const [configResult] = await pool.query(
          'SELECT enabled, use_list, cooldown_minutes FROM recycler_configs WHERE server_id = ?',
          [serverId]
        );

        if (configResult.length === 0 || !configResult[0].enabled) {
          console.log(`[RECYCLER] Recycler system is disabled for server: ${serverName}`);
          recyclerState.delete(recyclerStateKey);
          return;
        }

        const config = configResult[0];

        // Check if player is in allowed list (if use_list is enabled)
        if (config.use_list) {
          const [allowedResult] = await pool.query(
            'SELECT * FROM recycler_allowed_users WHERE server_id = ? AND (ign = ? OR discord_id = ?)',
            [serverId, playerName, playerName]
          );
          
          if (allowedResult.length === 0) {
            console.log(`[RECYCLER] Player ${playerName} not in allowed list for server: ${serverName}`);
            recyclerState.delete(recyclerStateKey);
            return;
          }
        }

        // Check cooldown
        const [cooldownResult] = await pool.query(
          'SELECT last_used FROM recycler_cooldowns WHERE server_id = ? AND player_name = ?',
          [serverId, playerName]
        );

        if (cooldownResult.length > 0) {
          const lastUsed = new Date(cooldownResult[0].last_used);
          const now = new Date();
          const cooldownMs = config.cooldown_minutes * 60 * 1000;
          const timeSinceLastUse = now - lastUsed;
          
          if (timeSinceLastUse < cooldownMs) {
            const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastUse) / (60 * 1000));
            console.log(`[RECYCLER] Player ${playerName} is on cooldown for ${remainingMinutes} minutes`);
            await sendRconCommand(ip, port, password, `say <color=#FF6B35>[RECYCLER]</color> <color=#FFD700>${playerName}</color> <color=#FF6B35>please wait ${remainingMinutes} minutes before spawning another recycler</color>`);
            recyclerState.delete(recyclerStateKey);
            return;
          }
        }

        // Spawn recycler slightly in front of the player
        const [x, y, z] = coords;
        
        // Spawn recycler directly on the player (no offset)
        const spawnX = x;
        const spawnY = y;
        const spawnZ = z;

        console.log(`[RECYCLER] Spawning recycler at position: ${spawnX}, ${spawnY}, ${spawnZ} for ${playerName}`);

        // Spawn the recycler (no spaces in coordinates)
        sendRconCommand(ip, port, password, `entity.spawn recycler_static ${spawnX},${spawnY},${spawnZ}`);

        // Update cooldown
        await pool.query(
          'INSERT INTO recycler_cooldowns (server_id, player_name, last_used) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE last_used = CURRENT_TIMESTAMP',
          [serverId, playerName]
        );

        // Send success message
        await sendRconCommand(ip, port, password, `say <color=#FF6B35>[RECYCLER]</color> <color=#FFD700>${playerName}</color> <color=#FF6B35>recycler spawned successfully!</color>`);

        // Log to admin feed
        await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `♻️ **Recycler Spawned:** ${playerName} spawned a recycler at (${spawnX}, ${spawnY}, ${spawnZ})`);

        console.log(`[RECYCLER] Successfully spawned recycler for ${playerName} on ${serverName}`);

        // Clear state
        recyclerState.delete(recyclerStateKey);
        return;
      }

      // Check for home teleport position requests
      // Debug logging removed for production
      const foundHomeState = Array.from(homeTeleportState.entries()).find(([key, state]) => {
        return state.step === 'waiting_for_position';
      });

      if (foundHomeState) {
        const [homeStateKey, homeState] = foundHomeState;
        const playerName = homeState.player;

        // Parse position coordinates (handle both "x, y, z" and "x,y,z" formats)
        const coords = positionStr.split(',').map(coord => parseFloat(coord.trim()));
        if (coords.length !== 3 || coords.some(isNaN)) {
          Logger.warn(`Invalid position format for home teleport: ${positionStr}`);
          return;
        }

        // Get server ID
        const [serverResult] = await pool.query(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          [guildId, serverName]
        );

        if (serverResult.length === 0) {
          Logger.warn(`No server found for ${serverName} in guild ${guildId}`);
          return;
        }

        const serverId = serverResult[0].id;

        // Save home location to database
        // Debug logging removed for production
        await pool.query(
          `INSERT INTO player_homes (guild_id, server_id, player_name, x_pos, y_pos, z_pos, set_at, updated_at) 
           VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE x_pos = VALUES(x_pos), y_pos = VALUES(y_pos), z_pos = VALUES(z_pos), updated_at = CURRENT_TIMESTAMP`,
          [guildId, serverId, playerName, coords[0], coords[1], coords[2]]
        );
        // Debug logging removed for production

        // Clear state
        homeTeleportState.delete(homeStateKey);
        // Debug logging removed for production

        // Send success message
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${playerName}</color> <color=white>home location saved successfully!</color>`);

        // Send to admin feed
        await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🏠 **Home Set:** ${playerName} set their home at (${coords[0]}, ${coords[1]}, ${coords[2]})`);

        Logger.info(`Home location saved for ${playerName}: (${coords[0]}, ${coords[1]}, ${coords[2]})`);
        return;
      }

      // Debug logging removed for production
      return;
    }

    const playerName = foundPlayerState.player;
          // Debug logging removed for production

    // Use the found player state
    const stateKey = foundStateKey;
    const playerState = foundPlayerState;

    if (playerState && playerState.step === 'waiting_for_position') {
      console.log(`[BOOK-A-RIDE DEBUG] Position received for ${playerName}: ${positionStr}`);
      console.log(`[BOOK-A-RIDE DEBUG] Position bytes: ${Buffer.from(positionStr).toString('hex')}`);
      console.log(`[BOOK-A-RIDE DEBUG] Position length: ${positionStr.length}`);
      
      // Clean the position string by removing invisible characters
      const cleanPosition = positionStr.replace(/[\x00-\x1F\x7F]/g, '').trim();
      console.log(`[BOOK-A-RIDE DEBUG] Cleaned position: ${cleanPosition}`);
      console.log(`[BOOK-A-RIDE DEBUG] Cleaned position bytes: ${Buffer.from(cleanPosition).toString('hex')}`);
      console.log(`[BOOK-A-RIDE DEBUG] Updating state from 'waiting_for_position' to 'waiting_for_choice'`);

      // Store the cleaned position and update state
      playerState.position = cleanPosition;
      playerState.step = 'waiting_for_choice';

      // Show ride selection message with availability (using <br> to avoid rate limiting)
      let horseOption = '';
      let rhibOption = '';
      let miniOption = '';
      let carOption = '';
      
      if (playerState.horseAvailable) {
        horseOption = `<color=#00ff00>Horse</color> <color=white>- Use Yes emote</color>`;
      } else {
        // Calculate remaining cooldown for horse
        const [serverResult] = await pool.query(
          'SELECT cooldown FROM rider_config WHERE server_id = ?',
          [playerState.serverId]
        );
        const cooldown = serverResult.length > 0 ? serverResult[0].cooldown : 300;
        const horseKey = `${playerState.serverId}:${playerName}:horse`;
        const horseLastUsed = bookARideCooldowns.get(horseKey) || 0;
        const horseRemaining = Math.ceil((cooldown * 1000 - (Date.now() - horseLastUsed)) / 1000);
        horseOption = `<color=#ff6b6b>Horse</color> <color=white>- Cooldown:</color> <color=#ffa500>${horseRemaining}s</color>`;
      }
      
      if (playerState.rhibAvailable) {
        rhibOption = `<color=#00ff00>Rhib</color> <color=white>- Use No emote</color>`;
      } else {
        // Calculate remaining cooldown for rhib
        const [serverResult2] = await pool.query(
          'SELECT cooldown FROM rider_config WHERE server_id = ?',
          [playerState.serverId]
        );
        const cooldown = serverResult2.length > 0 ? serverResult2[0].cooldown : 300;
        const rhibKey = `${playerState.serverId}:${playerName}:rhib`;
        const rhibLastUsed = bookARideCooldowns.get(rhibKey) || 0;
        const rhibRemaining = Math.ceil((cooldown * 1000 - (Date.now() - rhibLastUsed)) / 1000);
        rhibOption = `<color=#ff6b6b>Rhib</color> <color=white>- Cooldown:</color> <color=#ffa500>${rhibRemaining}s</color>`;
      }
      
      if (playerState.miniAvailable) {
        miniOption = `<color=#00ff00>Ok-Minicopter</color> <color=white>- Use Ok emote</color>`;
      } else {
        // Calculate remaining cooldown for mini
        const [serverResult3] = await pool.query(
          'SELECT cooldown FROM rider_config WHERE server_id = ?',
          [playerState.serverId]
        );
        const cooldown = serverResult3.length > 0 ? serverResult3[0].cooldown : 300;
        const miniKey = `${playerState.serverId}:${playerName}:mini`;
        const miniLastUsed = bookARideCooldowns.get(miniKey) || 0;
        const miniRemaining = Math.ceil((cooldown * 1000 - (Date.now() - miniLastUsed)) / 1000);
        miniOption = `<color=#ff6b6b>Ok-Minicopter</color> <color=white>- Cooldown:</color> <color=#ffa500>${miniRemaining}s</color>`;
      }
      
      if (playerState.carAvailable) {
        carOption = `<color=#00ff00>thank you-Car</color> <color=white>- Use thank you emote</color>`;
      } else {
        // Calculate remaining cooldown for car
        const [serverResult4] = await pool.query(
          'SELECT cooldown FROM rider_config WHERE server_id = ?',
          [playerState.serverId]
        );
        const cooldown = serverResult4.length > 0 ? serverResult4[0].cooldown : 300;
        const carKey = `${playerState.serverId}:${playerName}:car`;
        const carLastUsed = bookARideCooldowns.get(carKey) || 0;
        const carRemaining = Math.ceil((cooldown * 1000 - (Date.now() - carLastUsed)) / 1000);
        carOption = `<color=#ff6b6b>thank you-Car</color> <color=white>- Cooldown:</color> <color=#ffa500>${carRemaining}s</color>`;
      }
      
      // Send all options in a single message using <br> for line breaks
      sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${playerName}</color> <color=white>which ride would you like to book?</color><br>${horseOption}<br>${rhibOption}<br>${miniOption}<br>${carOption}`);

      // Update timeout for choice selection
      setTimeout(() => {
        const currentState = bookARideState.get(stateKey);
        if (currentState && currentState.step === 'waiting_for_choice') {
          bookARideState.delete(stateKey);
          sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#ff6b6b>${playerName}</color> <color=white>ride request timed out</color>`);
        }
      }, 30000); // 30 second timeout for choice
    }

  } catch (error) {
    console.error('Error handling position response:', error);
  }
}

async function handleNotePanel(client, guildId, serverName, msg, ip, port, password) {
  try {
    // Handle note panel messages - this is a backup handler for any note-related messages
    // The main note panel detection is already handled in the main message handler
    
    // Check for note panel messages that might have been missed
    if (msg.match(/\[NOTE PANEL\] Player \[ .*? \] changed name from \[ .*? \] to \[ .*? \]/)) {
      const match = msg.match(/\[NOTE PANEL\] Player \[ (.*?) \] changed name from \[ .*? \] to \[ (.*?) \]/);
      if (match) {
        const player = match[1];
        const note = match[2].replace(/\\n/g, '\n').trim();
        if (note) {
          // Send green and bold message in-game
          sendRconCommand(ip, port, password, `say <color=green><b>${note}</b></color>`);
          // Send to notefeed
          await sendFeedEmbed(client, guildId, serverName, 'notefeed', `**${player}** says: ${note}`);
          Logger.event(`[NOTEFEED] Note from ${player}: ${note}`);
        }
      }
    }
  } catch (error) {
    Logger.error('Error in handleNotePanel:', error);
  }
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
  if (match) {
    return match[1];
  }
  
  // Try JSON format
  if (logLine.includes('"Username"')) {
    try {
      const parsed = JSON.parse(logLine);
      if (parsed.Username) return parsed.Username;
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  
  // Try direct format but exclude chat server messages
  match = logLine.match(/^([^:]+) :/);
  if (match) {
    let playerName = match[1];
    // Filter out chat server prefixes and system messages
    if (playerName.includes('[CHAT SERVER]')) {
      // Extract actual player name from "[CHAT SERVER] PlayerName"
      const serverMatch = playerName.match(/\[CHAT SERVER\]\s*(.+)/);
      if (serverMatch) {
        playerName = serverMatch[1].trim();
      } else {
        return null; // Invalid format
      }
    }
    
    // Filter out other system prefixes
    if (playerName.startsWith('[') || playerName.includes('SERVER') || playerName.length < 2) {
      return null;
    }
    
    return playerName;
  }
  
  return null;
}

function sendRconCommand(ip, port, password, command) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
    
    let responseReceived = false;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ Identifier: 1, Message: command, Name: 'WebRcon' }));
    });
    
    ws.on('error', (error) => {
      console.error(`[RCON] WebSocket error for ${ip}:${port}:`, error.message);
      if (!responseReceived) {
        reject(new Error(`RCON connection failed: ${error.message}`));
      }
    });
    
    ws.on('message', async (data) => {
      try {
        const parsed = JSON.parse(data);
        
        if (parsed.Message) {
          // Check if this is a position response and inject it into main message handler
          
          // Clean the message by removing invisible characters
          const cleanMessage = parsed.Message.replace(/[\x00-\x1F\x7F]/g, '').trim();
          
          if (cleanMessage.match(/^\([^)]+\)$/)) {
            // Inject this message into the main WebSocket handler by triggering it manually
            // Find the main connection for this server by looking up server details
            
            try {
              // Look up the server details from database to get guildId and serverName
              const [serverResult] = await pool.execute(
                'SELECT rs.nickname, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.ip = ? AND rs.port = ?',
                [ip, port]
              );
              
              if (serverResult.length > 0) {
                const serverName = serverResult[0].nickname;
                const guildId = serverResult[0].discord_id;
                const connectionKey = `${guildId}_${serverName}`;
                
                const mainConnection = activeConnections[connectionKey];
                if (mainConnection && mainConnection.readyState === 1) {
                  // Simulate a message event on the main connection
                  const simulatedData = JSON.stringify({ Message: cleanMessage });
                  // We'll trigger the main handler by emitting a message event
                  mainConnection.emit('message', simulatedData);
                }
              } else {
                Logger.warn(`Server not found in database for ${ip}:${port}`);
              }
            } catch (error) {
              Logger.error(`Error looking up server: ${error.message}`);
            }
          }
          
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
    
    // Timeout after 20 seconds (increased from 10)
    setTimeout(() => {
      if (!responseReceived) {
        console.error(`[RCON] Timeout for command to ${ip}:${port}: ${command}`);
        ws.close();
        reject(new Error('RCON command timeout'));
      }
    }, 20000);
  });
}

// Function to send RCON command and get response (for commands that return data)
async function sendRconCommandWithResponse(ip, port, password, command) {
  try {
    const response = await sendRconCommand(ip, port, password, command);
    return response;
  } catch (error) {
    console.error(`[RCON] Error getting response for command ${command}:`, error.message);
    return null;
  }
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
      return;
    }

    const channelId = result[0].channel_id;
    
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      Logger.error(`Channel not found: ${channelId}`);
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00) // Orange color
      .setTitle(`${channelType.charAt(0).toUpperCase() + channelType.slice(1)} - ${serverName}`)
      .setDescription(message)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    Logger.adminFeed(`Sent to ${serverName}: ${message}`);
  } catch (error) {
    Logger.error('Error sending feed embed:', error);
  }
}

async function updatePlayerCountChannel(client, guildId, serverName, online, queued) {
  try {
    // Get the channel ID and original name from database
    const [result] = await pool.query(
      `SELECT cs.channel_id, cs.original_name 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = ? AND rs.nickname = ? AND cs.channel_type = 'playercount'`,
      [guildId, serverName]
    );

    if (result.length === 0) {
      return;
    }

    const channelId = result[0].channel_id;
    const originalName = result[0].original_name;
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.error(`[PLAYER COUNT] Channel not found: ${channelId}`);
      return;
    }

    if (channel.type !== 2) { // 2 = voice channel
      console.error(`[PLAYER COUNT] Channel is not a voice channel: ${channelId}`);
      return;
    }

    // Update voice channel name - append to original name if available, otherwise use current logic
    let newName;
    if (originalName) {
      newName = `${originalName} 🌐${online} 🕑${queued}`;
    } else {
      // Fallback for channels without stored original name
      newName = `🌐${online}🕑${queued}`;
    }
    
    await channel.setName(newName);
    Logger.playerCount(`Updated ${serverName}: ${newName}`);
  } catch (error) {
    Logger.error('Error updating player count channel:', error);
  }
}

function addToKillFeedBuffer(client, guildId, serverName, message) {
  const key = `${guildId}_${serverName}`;
  if (!killFeedBuffer[key]) {
    killFeedBuffer[key] = {
      messages: [],
      lastKillTime: Date.now(),
      isHighVolume: false
    };
  }
  
  const buffer = killFeedBuffer[key];
  const now = Date.now();
  const timeSinceLastKill = now - buffer.lastKillTime;
  
  // If we get kills very quickly (less than 2 seconds apart), mark as high volume
  if (timeSinceLastKill < 2000) {
    buffer.isHighVolume = true;
  }
  
  buffer.messages.push(message);
  buffer.lastKillTime = now;
  
  // If low volume, send immediately
  if (!buffer.isHighVolume && buffer.messages.length === 1) {
    // Send this single kill immediately
    setTimeout(() => {
      if (killFeedBuffer[key] && killFeedBuffer[key].messages.length === 1) {
        const singleMessage = killFeedBuffer[key].messages[0];
        sendFeedEmbed(client, guildId, serverName, 'killfeed', singleMessage);
        killFeedBuffer[key] = { messages: [], lastKillTime: Date.now(), isHighVolume: false };
      }
    }, 100); // Small delay to allow for potential additional kills
  }
}

async function flushKillFeedBuffers(client) {
  for (const key in killFeedBuffer) {
    const [guildId, serverName] = key.split('_');
    const buffer = killFeedBuffer[key];
    if (!buffer.messages.length) continue;
    
    // Only flush if we have multiple messages (high volume scenario)
    if (buffer.messages.length > 1) {
      // Limit to last 20 messages to prevent huge embeds
      const recentMessages = buffer.messages.slice(-20);
      const desc = recentMessages.join('<br>');
      await sendFeedEmbed(client, guildId, serverName, 'killfeed', desc);
    }
    
    // Reset buffer
    killFeedBuffer[key] = { messages: [], lastKillTime: Date.now(), isHighVolume: false };
  }
}

// Event detection state tracking

async function checkAllEvents(client) {
  try {
    // Debug logging removed for production
    
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
      // Debug logging removed for production
      return;
    }

    // Debug logging removed for production

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

          // Debug logging removed for production

    // Process each server
    for (const [key, server] of servers) {
      try {
        // Debug logging removed for production
        
        if (!eventFlags.has(key)) {
          eventFlags.set(key, new Set());
        }
        const serverFlags = eventFlags.get(key);

        // Check for Bradley events
        const bradleyConfig = server.configs.find(c => c.event_type === 'bradley');
        // Bradley and Helicopter events are now handled by checkEventGibs function
        // This prevents duplicate event detection and spam messages
        // if (bradleyConfig) {
        //   console.log(`[EVENT] Bradley config found for ${server.nickname}:`, bradleyConfig.kill_message);
        //   await checkBradleyEvent(client, server.guild_id, server.nickname, server.ip, server.port, server.password, bradleyConfig, serverFlags);
        // }

        // Check for Helicopter events
        // const helicopterConfig = server.configs.find(c => c.event_type === 'helicopter');
        // if (helicopterConfig) {
        //   console.log(`[EVENT] Helicopter config found for ${server.nickname}:`, helicopterConfig.kill_message);
        //   await checkHelicopterEvent(client, server.guild_id, server.nickname, server.ip, server.port, server.password, helicopterConfig, serverFlags);
        // }
      } catch (serverError) {
        console.error(`[EVENT] Error checking events for server ${server.nickname}:`, serverError);
      }
    }
    
    // Check for crate events on all servers
    await checkCrateEvents(client);
    
    // Debug logging removed for production
  } catch (error) {
    console.error('[EVENT] Error checking all events:', error);
  }
}

async function handleEventDetection(client, guildId, serverName, msg, ip, port, password) {
  // This function is now deprecated - events are checked periodically instead
  // Keeping it for backward compatibility but it does nothing
}

async function checkBradleyEvent(client, guildId, serverName, ip, port, password, config, serverFlags) {
  try {
    // Check cooldown to prevent spam
    const serverKey = `${guildId}_${serverName}`;
    const lastCheck = eventDetectionCooldowns.get(serverKey);
    const now = Date.now();
    
    if (lastCheck && (now - lastCheck) < EVENT_DETECTION_COOLDOWN) {
      return; // Skip if on cooldown
    }
    
    // Update cooldown
    eventDetectionCooldowns.set(serverKey, now);
    
    // Debug logging removed for production
    
    // Try multiple detection methods for better reliability
    const bradley = await sendRconCommand(ip, port, password, "find_entity servergibs_bradley");
    
    // Clean the response to remove invisible characters
    const cleanResponse = bradley ? bradley.replace(/[\x00-\x1F\x7F]/g, '').trim() : '';
    
    // Debug logging removed for production
    
    if (cleanResponse && cleanResponse.includes("servergibs_bradley") && !serverFlags.has("BRADLEY")) {
      serverFlags.add("BRADLEY");
      
      console.log(`[EVENT] Bradley event detected on ${serverName}, sending message: ${config.kill_message}`);
      
      // Send kill message
      await sendRconCommand(ip, port, password, `say "${config.kill_message}"`);
      
      // Send to Discord feed
      await sendFeedEmbed(client, guildId, serverName, 'eventfeed', `🎯 **Bradley APC Event Started!**\n${config.kill_message}`);
      
      // Clear flag after 15 minutes
      setTimeout(() => {
        const flags = eventFlags.get(serverKey);
        if (flags) {
          flags.delete("BRADLEY");
          console.log(`[EVENT] Bradley flag cleared for ${serverName}`);
        }
      }, 60_000 * 15);
      
      console.log(`[EVENT] Bradley event started on ${serverName}`);
    } else if (cleanResponse && !cleanResponse.includes("servergibs_bradley") && serverFlags.has("BRADLEY")) {
      // Bradley debris is gone, clear the flag
      serverFlags.delete("BRADLEY");
      console.log(`[EVENT] Bradley debris cleared for ${serverName}`);
    }
  } catch (error) {
    console.error(`[EVENT] Error checking Bradley event on ${serverName}:`, error.message);
  }
}

async function checkHelicopterEvent(client, guildId, serverName, ip, port, password, config, serverFlags) {
  try {
    // Check cooldown to prevent spam
    const serverKey = `${guildId}_${serverName}`;
    const lastCheck = eventDetectionCooldowns.get(serverKey);
    const now = Date.now();
    
    if (lastCheck && (now - lastCheck) < EVENT_DETECTION_COOLDOWN) {
      return; // Skip if on cooldown
    }
    
    // Update cooldown
    eventDetectionCooldowns.set(serverKey, now);
    
    // Debug logging removed for production
    
    // Try multiple detection methods for better reliability
    const helicopter = await sendRconCommand(ip, port, password, "find_entity servergibs_patrolhelicopter");
    
    // Clean the response to remove invisible characters
    const cleanResponse = helicopter ? helicopter.replace(/[\x00-\x1F\x7F]/g, '').trim() : '';
    
    // Debug logging removed for production
    
    if (cleanResponse && cleanResponse.includes("servergibs_patrolhelicopter") && !serverFlags.has("HELICOPTER")) {
      serverFlags.add("HELICOPTER");
      
      console.log(`[EVENT] Helicopter event detected on ${serverName}, sending message: ${config.kill_message}`);
      
      // Send kill message
      await sendRconCommand(ip, port, password, `say "${config.kill_message}"`);
      
      // Send to Discord feed
      await sendFeedEmbed(client, guildId, serverName, 'eventfeed', `🚁 **Patrol Helicopter Event Started!**\n${config.kill_message}`);
      
      // Clear flag after 15 minutes
      setTimeout(() => {
        const flags = eventFlags.get(serverKey);
        if (flags) {
          flags.delete("HELICOPTER");
          console.log(`[EVENT] Helicopter flag cleared for ${serverName}`);
        }
      }, 60_000 * 15);
      
      console.log(`[EVENT] Helicopter event started on ${serverName}`);
    } else if (cleanResponse && !cleanResponse.includes("servergibs_patrolhelicopter") && serverFlags.has("HELICOPTER")) {
      // Helicopter debris is gone, clear the flag
      serverFlags.delete("HELICOPTER");
      console.log(`[EVENT] Helicopter debris cleared for ${serverName}`);
    }
  } catch (error) {
    console.error(`[EVENT] Error checking Helicopter event on ${serverName}:`, error.message);
  }
}

async function checkCrateEvents(client) {
  try {
    // Get all enabled crate events from all servers
    const [crateConfigs] = await pool.query(`
      SELECT 
        rs.id, rs.nickname, rs.ip, rs.port, rs.password, 
        g.discord_id as guild_id,
        cec.crate_type, cec.spawn_interval_minutes, cec.spawn_amount, cec.spawn_message, cec.last_spawn
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      JOIN crate_event_configs cec ON rs.id = cec.server_id 
      WHERE cec.enabled = TRUE
    `);

    if (crateConfigs.length === 0) {
      return; // No enabled crate events
    }

    const now = new Date();

    for (const config of crateConfigs) {
      try {
        // Check if it's time to spawn a crate
        if (!config.last_spawn) {
          // First time spawning - set initial spawn time
          await pool.query(
            'UPDATE crate_event_configs SET last_spawn = CURRENT_TIMESTAMP WHERE server_id = ? AND crate_type = ?',
            [config.id, config.crate_type]
          );
          console.log(`[CRATE] Initial spawn time set for ${config.crate_type} on ${config.nickname}`);
          continue;
        }

        const lastSpawn = new Date(config.last_spawn);
        const timeSinceLastSpawn = (now - lastSpawn) / (1000 * 60); // Convert to minutes
        const intervalMinutes = config.spawn_interval_minutes || 60; // Default to 60 minutes

        if (timeSinceLastSpawn >= intervalMinutes) {
          console.log(`[CRATE] Time to spawn ${config.crate_type} on ${config.nickname} (${timeSinceLastSpawn.toFixed(1)} minutes since last spawn)`);
          
          // Get the position coordinates for this crate event
          const positionType = config.crate_type.toLowerCase().replace('crate-', 'crate-event-');
          const [positions] = await pool.query(
            'SELECT x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = ? AND position_type = ?',
            [config.id, positionType]
          );

          if (positions.length === 0) {
            console.log(`[CRATE] No position set for ${config.crate_type} on ${config.nickname}, skipping spawn`);
            continue;
          }

          const position = positions[0];
          const coordinates = `${position.x_pos},${position.y_pos},${position.z_pos}`;

          // Send spawn message if configured
          if (config.spawn_message && config.spawn_message.trim()) {
            try {
              await sendRconCommand(config.ip, config.port, config.password, `say "${config.spawn_message}"`);
              console.log(`[CRATE] Sent spawn message for ${config.crate_type} on ${config.nickname}: ${config.spawn_message}`);
            } catch (error) {
              console.error(`[CRATE] Failed to send spawn message for ${config.crate_type} on ${config.nickname}:`, error);
            }
          }

          // Spawn crates according to configured amount
          const spawnAmount = Math.min(Math.max(config.spawn_amount || 1, 1), 2);
          let spawnSuccess = 0;

          for (let i = 0; i < spawnAmount; i++) {
            try {
              await sendRconCommand(config.ip, config.port, config.password, `entity.spawn codelockedhackablecrate ${coordinates}`);
              spawnSuccess++;
              console.log(`[CRATE] Spawned crate ${i + 1}/${spawnAmount} for ${config.crate_type} on ${config.nickname} at ${coordinates}`);
            } catch (error) {
              console.error(`[CRATE] Failed to spawn crate ${i + 1}/${spawnAmount} for ${config.crate_type} on ${config.nickname}:`, error);
            }
          }

          // Update the last_spawn timestamp
          await pool.query(
            'UPDATE crate_event_configs SET last_spawn = CURRENT_TIMESTAMP WHERE server_id = ? AND crate_type = ?',
            [config.id, config.crate_type]
          );

          console.log(`[CRATE] Successfully spawned ${spawnSuccess}/${spawnAmount} crates for ${config.crate_type} on ${config.nickname}`);

          // Send to Discord feed if configured
          try {
            await sendFeedEmbed(client, config.guild_id, config.nickname, 'eventfeed', 
              `📦 **${config.crate_type.toUpperCase()} Event Spawned!**\n${config.spawn_message || 'Crate event has spawned!'}\nNext spawn in ${intervalMinutes} minutes`);
          } catch (error) {
            console.error(`[CRATE] Failed to send Discord feed for ${config.crate_type} on ${config.nickname}:`, error);
          }

        } else {
          const remainingTime = intervalMinutes - timeSinceLastSpawn;
          console.log(`[CRATE] ${config.crate_type} on ${config.nickname} - ${remainingTime.toFixed(1)} minutes until next spawn`);
        }

      } catch (error) {
        console.error(`[CRATE] Error checking crate event ${config.crate_type} on ${config.nickname}:`, error);
      }
    }

  } catch (error) {
    console.error('[CRATE] Error checking crate events:', error);
  }
}

async function handleAirdropEvent(client, guildId, serverName, ip, port, password) {
  try {
    console.log(`[EVENT] Processing airdrop event for ${serverName}`);
    
    // Get the channel ID from database
    const [result] = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = ? AND rs.nickname = ? AND cs.channel_type = ?`,
      [guildId, serverName, 'events']
    );

    if (result.length === 0) {
      console.log(`[EVENTS] No events channel configured for ${serverName}`);
      return;
    }

    const channelId = result[0].channel_id;
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.error(`[EVENTS] Channel not found: ${channelId}`);
      return;
    }

    // Create embed with local image attachment
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00) // Orange color
      .setTitle(`${serverName} - An Airdrop Is Inbound`)
      .setDescription('An Air Drop Is Falling From The Sky, Can You Find It?')
      .setImage('attachment://airdrop.png')
      .setTimestamp();

    console.log(`[EVENTS] Sending airdrop embed to channel ${channelId} for ${serverName}`);
    
    // Create file attachment with error handling
    try {
      const airdropImagePath = path.join(__dirname, '../../assets/images/airdrop.png');
      console.log(`[EVENTS] Attempting to load airdrop image from: ${airdropImagePath}`);
      
      const attachment = new AttachmentBuilder(airdropImagePath, { name: 'airdrop.png' });
      await channel.send({ embeds: [embed], files: [attachment] });
      console.log(`[EVENTS] Airdrop event message sent with image attachment for ${serverName}`);
    } catch (imageError) {
      console.error(`[EVENTS] Failed to send airdrop with image, sending without image: ${imageError.message}`);
      // Fallback: send embed without image
      await channel.send({ embeds: [embed] });
      console.log(`[EVENTS] Airdrop event message sent without image for ${serverName}`);
    }
    console.log(`[EVENTS] Airdrop event message sent to Discord for ${serverName}`);
    
  } catch (error) {
    console.error(`[EVENT] Error handling airdrop event on ${serverName}:`, error.message);
  }
}

async function handleLockedCrateEvent(client, guildId, serverName, ip, port, password) {
  try {
    console.log(`[EVENT] Processing locked crate event for ${serverName}`);
    
    // Get the channel ID from database
    const [result] = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = ? AND rs.nickname = ? AND cs.channel_type = ?`,
      [guildId, serverName, 'events']
    );

    if (result.length === 0) {
      console.log(`[EVENTS] No events channel configured for ${serverName}`);
      return;
    }

    const channelId = result[0].channel_id;
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.error(`[EVENTS] Channel not found: ${channelId}`);
      return;
    }

    // Create embed with local image attachment
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00) // Orange color
      .setTitle(`${serverName} - A Locked Crate Is Inbound`)
      .setDescription('A locked crate is dropping somewhere on the map can you find it?')
      .setImage('attachment://locked_crate.png')
      .setTimestamp();

    // Create file attachment with error handling
    try {
      const lockedCrateImagePath = path.join(__dirname, '../../assets/images/locked_crate.png');
      console.log(`[EVENTS] Attempting to load locked crate image from: ${lockedCrateImagePath}`);
      
      const attachment = new AttachmentBuilder(lockedCrateImagePath, { name: 'locked_crate.png' });
      await channel.send({ embeds: [embed], files: [attachment] });
      console.log(`[EVENTS] Locked crate event message sent with image attachment for ${serverName}`);
    } catch (imageError) {
      console.error(`[EVENTS] Failed to send locked crate with image, sending without image: ${imageError.message}`);
      // Fallback: send embed without image
      await channel.send({ embeds: [embed] });
      console.log(`[EVENTS] Locked crate event message sent without image for ${serverName}`);
    }
    console.log(`[EVENTS] Locked crate event message sent to Discord for ${serverName}`);
    
  } catch (error) {
    console.error(`[EVENT] Error handling locked crate event on ${serverName}:`, error.message);
  }
}

async function handlePatrolHelicopterEvent(client, guildId, serverName, ip, port, password) {
  try {
    console.log(`[EVENT] Processing patrol helicopter event for ${serverName}`);
    
    // Get the channel ID from database
    const [result] = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = ? AND rs.nickname = ? AND cs.channel_type = ?`,
      [guildId, serverName, 'events']
    );

    if (result.length === 0) {
      console.log(`[EVENTS] No events channel configured for ${serverName}`);
      return;
    }

    const channelId = result[0].channel_id;
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.error(`[EVENTS] Channel not found: ${channelId}`);
      return;
    }

    // Create embed with local image attachment
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00) // Orange color
      .setTitle(`${serverName} - Gear up and get ready`)
      .setDescription('A Patrol Helicopter Is Circling The Map, Ready To Take It Down?')
      .setImage('attachment://patrol_helicopter.png')
      .setTimestamp();

    // Create file attachment with error handling
    try {
      const patrolHelicopterImagePath = path.join(__dirname, '../../assets/images/patrol_helicopter.png');
      console.log(`[EVENTS] Attempting to load patrol helicopter image from: ${patrolHelicopterImagePath}`);
      
      const attachment = new AttachmentBuilder(patrolHelicopterImagePath, { name: 'patrol_helicopter.png' });
      await channel.send({ embeds: [embed], files: [attachment] });
      console.log(`[EVENTS] Patrol helicopter event message sent with image attachment for ${serverName}`);
    } catch (imageError) {
      console.error(`[EVENTS] Failed to send patrol helicopter with image, sending without image: ${imageError.message}`);
      // Fallback: send embed without image
      await channel.send({ embeds: [embed] });
      console.log(`[EVENTS] Patrol helicopter event message sent without image for ${serverName}`);
    }
    console.log(`[EVENTS] Patrol helicopter event message sent to Discord for ${serverName}`);
    
  } catch (error) {
    console.error(`[EVENT] Error handling patrol helicopter event on ${serverName}:`, error.message);
  }
}

async function handleNightSkipVote(client, guildId, serverName, msg, ip, port, password) {
  try {
    const serverKey = `${guildId}:${serverName}`;
    
    // Check if night skip voting is active
    if (!nightSkipVotes.has(serverKey)) {
      console.log(`[NIGHT SKIP] No active voting session for ${serverName}`);
      return;
    }

    // Extract player name from the message
    const playerMatch = msg.match(/\[CHAT LOCAL\] ([^:]+) :/);
    if (!playerMatch) {
      console.log(`[NIGHT SKIP] Could not extract player name from vote message`);
      return;
    }

    const playerName = playerMatch[1].trim();
    console.log(`[NIGHT SKIP] Vote received from ${playerName} on ${serverName}`);

    // Get server ID to fetch settings
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`[NIGHT SKIP] Server not found in database: ${serverName}`);
      return;
    }
    
    const serverId = serverResult[0].id;
    
    // Get night skip settings from database
    const [settingsResult] = await pool.query(
      'SELECT minimum_voters, enabled FROM night_skip_settings WHERE server_id = ?',
      [serverId]
    );
    
    // Default settings if none exist
    const settings = settingsResult.length > 0 ? settingsResult[0] : { minimum_voters: 5, enabled: true };
    
    // Check if night skip is enabled
    if (!settings.enabled) {
      console.log(`[NIGHT SKIP] Night skip voting is disabled for ${serverName}`);
      return;
    }

    // Get current vote count
    const voteCount = nightSkipVoteCounts.get(serverKey) || 0;
    const newVoteCount = voteCount + 1;
    nightSkipVoteCounts.set(serverKey, newVoteCount);

    console.log(`[NIGHT SKIP] Vote count for ${serverName}: ${newVoteCount}/${settings.minimum_voters}`);

    // Check if we reached the minimum votes
    if (newVoteCount >= settings.minimum_voters) {
      console.log(`[NIGHT SKIP] Vote threshold reached for ${serverName}! Finalizing vote with success=true`);
      // Clear the voting session BEFORE calling finalize to prevent race condition with timeout
      nightSkipVotes.delete(serverKey);
      nightSkipVoteCounts.delete(serverKey);
      await finalizeNightSkipVote(client, guildId, serverName, newVoteCount, ip, port, password, true);
    }

  } catch (error) {
    console.error(`[NIGHT SKIP] Error handling vote on ${serverName}:`, error.message);
  }
}

async function finalizeNightSkipVote(client, guildId, serverName, voteCount, ip, port, password, success) {
  try {
    const serverKey = `${guildId}:${serverName}`;
    
    // CRITICAL: Check if voting session still exists to prevent duplicate execution
    if (!nightSkipVotes.has(serverKey) && success) {
      console.log(`[NIGHT SKIP] Voting session already finalized for ${serverName}, skipping duplicate execution`);
      return;
    }
    
    // Get server ID to fetch settings
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`[NIGHT SKIP] Server not found in database: ${serverName}`);
      return;
    }
    
    const serverId = serverResult[0].id;
    
    // Get night skip settings from database
    const [settingsResult] = await pool.query(
      'SELECT minimum_voters, enabled FROM night_skip_settings WHERE server_id = ?',
      [serverId]
    );
    
    // Default settings if none exist
    const settings = settingsResult.length > 0 ? settingsResult[0] : { minimum_voters: 5, enabled: true };
    
    // Clear the voting session (if not already cleared)
    nightSkipVotes.delete(serverKey);
    nightSkipVoteCounts.delete(serverKey);

    if (success) {
      // Clear failed attempts since we succeeded
      nightSkipFailedAttempts.delete(serverKey);
      
      console.log(`[NIGHT SKIP] Sending success message to ${serverName} with ${voteCount} votes`);
      
      // Send success message in game
      const successMessage = `say <color=#00FF00><b>🎉 Skipping night!! Total votes: ${voteCount}</b></color>`;
      sendRconCommand(ip, port, password, successMessage);
      console.log(`[NIGHT SKIP] Success message sent to ${serverName}: ${successMessage}`);
      
      // Wait 2 seconds before sending time command to avoid rate limiting
      setTimeout(() => {
        // Set time to noon (12:00)
        sendRconCommand(ip, port, password, 'time 12');
        console.log(`[NIGHT SKIP] Time command sent to ${serverName}: time 12`);
      }, 2000);
      console.log(`[NIGHT SKIP] Night skip successful on ${serverName} with ${voteCount} votes - time set to 12:00`);
      
      // Send to admin feed
      await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🌙 **Night Skip Successful:** ${voteCount} players voted to skip night - time set to 12:00`);
      console.log(`[NIGHT SKIP] Admin feed message sent for ${serverName}`);
    } else {
      // Mark this as a failed attempt to prevent re-triggering
      nightSkipFailedAttempts.set(serverKey, Date.now());
      
      // Send failure message in game
      const failureMessage = `say <color=#FF0000><b>😴 Pretty boring! We didn't get enough votes. Total votes: ${voteCount}</b></color>`;
      sendRconCommand(ip, port, password, failureMessage);
      console.log(`[NIGHT SKIP] Night skip failed on ${serverName} with ${voteCount} votes (needed ${settings.minimum_voters})`);

      // Send to admin feed
      await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🌙 **Night Skip Failed:** Only ${voteCount} players voted (needed ${settings.minimum_voters})`);
    }

  } catch (error) {
    console.error(`[NIGHT SKIP] Error finalizing vote on ${serverName}:`, error.message);
  }
}

async function checkTimeAndStartNightSkipVote(client, guildId, serverName, ip, port, password) {
  try {
    console.log(`[NIGHT SKIP] Checking time for ${serverName}`);
    
    // Get server ID to fetch settings
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`[NIGHT SKIP] Server not found in database: ${serverName}`);
      return;
    }
    
    const serverId = serverResult[0].id;
    
    // Get night skip settings from database
    const [settingsResult] = await pool.query(
      'SELECT minimum_voters, enabled FROM night_skip_settings WHERE server_id = ?',
      [serverId]
    );
    
    // Default settings if none exist
    const settings = settingsResult.length > 0 ? settingsResult[0] : { minimum_voters: 5, enabled: true };
    
    // Check if night skip is enabled
    if (!settings.enabled) {
      console.log(`[NIGHT SKIP] Night skip voting is disabled for ${serverName}`);
      return;
    }
    
    // Send time command to get current game time
    const timeResponse = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ Identifier: 1, Message: 'time', Name: 'WebRcon' }));
      });
      
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data);
          if (response.Message && response.Message.includes('time')) {
            ws.close();
            resolve(response.Message);
          }
        } catch (error) {
          console.error(`[NIGHT SKIP] Error parsing time response:`, error.message);
        }
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout getting time'));
      }, 5000);
    });

    // Extract time from response (handles both "time: 18" and "env.time: "18.55865"" formats)
    let timeMatch = timeResponse.match(/time:\s*(\d+)/i);
    if (!timeMatch) {
      // Try alternative format: env.time: "18.55865"
      timeMatch = timeResponse.match(/env\.time:\s*"(\d+)\.\d+"/i);
    }
    if (!timeMatch) {
      console.log(`[NIGHT SKIP] Could not parse time from response: ${timeResponse}`);
      return;
    }

    const currentTime = parseInt(timeMatch[1]);
    console.log(`[NIGHT SKIP] Current time on ${serverName}: ${currentTime}`);

    // Check if it's 18:00 (6 PM) and no voting is already active
    const serverKey = `${guildId}:${serverName}`;
    if (currentTime === 18 && !nightSkipVotes.has(serverKey)) {
      // Check if we had a recent failed attempt (within the last 5 minutes)
      const lastFailedAttempt = nightSkipFailedAttempts.get(serverKey);
      if (lastFailedAttempt && (Date.now() - lastFailedAttempt) < 300000) { // 5 minutes = 300000ms
        console.log(`[NIGHT SKIP] Skipping night skip vote on ${serverName} - recent failed attempt within 5 minutes`);
        return;
      }
      
      console.log(`[NIGHT SKIP] Starting night skip vote on ${serverName}`);
      
      // Start voting session
      nightSkipVotes.set(serverKey, true);
      nightSkipVoteCounts.set(serverKey, 0);

      // Send vote message in game
      const voteMessage = `say <color=#FF0000><b>🌙 Bye-Bye Night, Hello Light</b></color><br><color=#00FFFF><b>VOTE TO SKIP NIGHT</b></color><br><color=#FFFF00><b>use the (YES) emote</b></color>`;
      sendRconCommand(ip, port, password, voteMessage);
      console.log(`[NIGHT SKIP] Vote message sent to ${serverName}`);

      // Send to admin feed
      await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🌙 **Night Skip Vote Started:** Players can now vote to skip night using the YES emote (need ${settings.minimum_voters} votes)`);

      // Set timeout to end voting after 30 seconds
      setTimeout(async () => {
        // Check if voting session is still active (might have been cleared by successful vote)
        if (!nightSkipVotes.has(serverKey)) {
          console.log(`[NIGHT SKIP] Voting session already ended for ${serverName}, skipping timeout finalization`);
          return;
        }
        const finalVoteCount = nightSkipVoteCounts.get(serverKey) || 0;
        await finalizeNightSkipVote(client, guildId, serverName, finalVoteCount, ip, port, password, finalVoteCount >= settings.minimum_voters);
      }, 30000);

      console.log(`[NIGHT SKIP] 30-second voting timer started for ${serverName}`);
    }

  } catch (error) {
    console.error(`[NIGHT SKIP] Error checking time on ${serverName}:`, error.message);
  }
}

async function checkAllServersForNightSkip(client) {
  try {
    console.log(`[NIGHT SKIP] Checking all servers for night skip voting`);
    
    const [result] = await pool.execute('SELECT * FROM rust_servers');
    
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
        continue;
      }
      
      // Validate IP format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(server.ip)) {
        continue;
      }
      
      const [guildResult] = await pool.execute('SELECT discord_id FROM guilds WHERE id = ?', [server.guild_id]);
      if (guildResult.length > 0) {
        const guildId = guildResult[0].discord_id;
        await checkTimeAndStartNightSkipVote(client, guildId, server.nickname, server.ip, server.port, server.password);
      }
    }
  } catch (error) {
    console.error('[NIGHT SKIP] Error checking all servers for night skip:', error.message);
  }
}

// ZORP System Functions
async function handleZorpEmote(client, guildId, serverName, parsed, ip, port, password) {
  try {
    const msg = parsed.Message;
    if (!msg) return;

    // Check for ZORP emote in multiple chat types: LOCAL, TEAM, or SERVER
    if ((msg.includes('[CHAT LOCAL]') || msg.includes('[CHAT TEAM]') || msg.includes('[CHAT SERVER]')) && msg.includes(ZORP_EMOTE)) {
      const player = extractPlayerName(msg);
      if (player) {
        // Determine chat type for logging
        let chatType = 'LOCAL';
        if (msg.includes('[CHAT TEAM]')) chatType = 'TEAM';
        else if (msg.includes('[CHAT SERVER]')) chatType = 'SERVER';
        
        // Debug logging removed for production
        await createZorpZone(client, guildId, serverName, ip, port, password, player);
      } else {
        // Debug logging removed for production
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

    // Check for ZORP delete emote in multiple chat types: LOCAL, TEAM, or SERVER
    if ((msg.includes('[CHAT LOCAL]') || msg.includes('[CHAT TEAM]') || msg.includes('[CHAT SERVER]')) && msg.includes('d11_quick_chat_responses_slot_6')) {
      // Determine chat type for logging
      let chatType = 'LOCAL';
      if (msg.includes('[CHAT TEAM]')) chatType = 'TEAM';
      else if (msg.includes('[CHAT SERVER]')) chatType = 'SERVER';
      
      // Debug logging removed for production
      const player = extractPlayerName(msg);
      if (player) {
        // Debug logging removed for production
        
        // Get server ID for database operations
        const [serverResult] = await pool.query(
          'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          [guildId, serverName]
        );
        
        if (serverResult.length === 0) {
          // Debug logging removed for production
          return;
        }
        
        const serverId = serverResult[0].id;
        
        // Check if player has a zone (try by owner first, then by any zone if owner is Unknown)
        let [zoneResult] = await pool.query(
          'SELECT name FROM zorp_zones WHERE server_id = ? AND LOWER(owner) = LOWER(?)',
          [serverId, player]
        );

        // Debug logging removed for production

        // If no zone found by owner, try to find any zone for this player (for synced zones with Unknown owner)
        if (zoneResult.length === 0) {
          [zoneResult] = await pool.query(
            'SELECT name FROM zorp_zones WHERE server_id = ? LIMIT 1',
            [serverId]
          );
        }

        if (zoneResult.length === 0) {
          return;
        }

        const zoneName = zoneResult[0].name;

        // Delete zone from game
        await sendRconCommand(ip, port, password, `zones.deletecustomzone "${zoneName}"`);

        // Clear offline expiration timer if it exists
        await clearOfflineExpirationTimer(zoneName);
        
        // Delete zone from database by zone name (more reliable than owner)
        await pool.query('DELETE FROM zorp_zones WHERE name = ? AND server_id = ?', [zoneName, serverId]);

        // Send success message
        await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${player}</color> <color=white>Zorp successfully deleted!</color>`);

        // Log to zorp feed
        await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${player} Zorp deleted`);
      } else {
        // Debug logging removed for production
      }
    }
  } catch (error) {
    console.error('Error handling ZORP delete emote:', error);
  }
}

// Kit Delivery System Functions
async function handleKitDeliveryEmote(client, guildId, serverName, parsed, ip, port, password) {
  try {
    const msg = parsed.Message;
    if (!msg) return;

    // Check for Kit Delivery emote in all chat types: [CHAT LOCAL/TEAM/SERVER] player : d11_quick_chat_orders_slot_6
    if ((msg.includes('[CHAT LOCAL]') || msg.includes('[CHAT TEAM]') || msg.includes('[CHAT SERVER]')) && msg.includes(KIT_DELIVERY_EMOTE)) {
      const player = extractPlayerName(msg);
      if (player) {
        // Determine chat type for logging
        let chatType = 'LOCAL';
        if (msg.includes('[CHAT TEAM]')) chatType = 'TEAM';
        else if (msg.includes('[CHAT SERVER]')) chatType = 'SERVER';
        
        console.log(`[KIT DELIVERY] Emote detected for player: ${player} on server: ${serverName} (${chatType} chat)`);
        await processKitDelivery(client, guildId, serverName, ip, port, password, player);
      } else {
        console.log(`[KIT DELIVERY] Emote detected but could not extract player name from: ${msg}`);
      }
    }
  } catch (error) {
    console.error('Error handling kit delivery emote:', error);
  }
}

// Recycler System Functions
async function handleRecyclerEmote(client, guildId, serverName, parsed, ip, port, password) {
  try {
    const msg = parsed.Message;
    if (!msg) return;

    // Check for Recycler emote in all chat types: [CHAT LOCAL/TEAM/SERVER] player : d11_quick_chat_orders_slot_2
    if ((msg.includes('[CHAT LOCAL]') || msg.includes('[CHAT TEAM]') || msg.includes('[CHAT SERVER]')) && msg.includes(RECYCLER_EMOTE)) {
      const player = extractPlayerName(msg);
      if (player) {
        // Determine chat type for logging
        let chatType = 'LOCAL';
        if (msg.includes('[CHAT TEAM]')) chatType = 'TEAM';
        else if (msg.includes('[CHAT SERVER]')) chatType = 'SERVER';
        
        console.log(`[RECYCLER] Emote detected for player: ${player} on server: ${serverName} (${chatType} chat)`);
        await processRecyclerSpawn(client, guildId, serverName, ip, port, password, player);
      } else {
        console.log(`[RECYCLER] Emote detected but could not extract player name from: ${msg}`);
      }
    }
  } catch (error) {
    console.error('Error handling recycler emote:', error);
  }
}

async function processRecyclerSpawn(client, guildId, serverName, ip, port, password, player) {
  try {
    console.log(`[RECYCLER] Processing recycler spawn for ${player} on ${serverName}`);
    
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`[RECYCLER] Server not found: ${serverName}`);
      return;
    }
    
    const serverId = serverResult[0].id;
    
    // Get recycler configuration
    const [configResult] = await pool.query(
      'SELECT enabled, use_list, cooldown_minutes FROM recycler_configs WHERE server_id = ?',
      [serverId]
    );
    
    if (configResult.length === 0) {
      console.log(`[RECYCLER] No recycler configuration found for server: ${serverName}`);
      return;
    }
    
    const config = configResult[0];
    
    // Check if recycler system is enabled
    if (!config.enabled) {
      console.log(`[RECYCLER] Recycler system is disabled for server: ${serverName}`);
      await sendRconCommand(ip, port, password, `say <color=#FF6B35>[RECYCLER]</color> <color=#FFD700>${player}</color> <color=#FF6B35>recycler spawning is disabled</color>`);
      return;
    }
    
    // Check if player is in allowed list (if use_list is enabled)
    if (config.use_list) {
      const [allowedResult] = await pool.query(
        'SELECT * FROM recycler_allowed_users WHERE server_id = ? AND (ign = ? OR discord_id = ?)',
        [serverId, player, player]
      );
      
      if (allowedResult.length === 0) {
        console.log(`[RECYCLER] Player ${player} not in allowed list for server: ${serverName}`);
        await sendRconCommand(ip, port, password, `say <color=#FF6B35>[RECYCLER]</color> <color=#FFD700>${player}</color> <color=#FF6B35>you are not allowed to spawn recyclers</color>`);
        return;
      }
    }
    
    // Check cooldown
    const [cooldownResult] = await pool.query(
      'SELECT last_used FROM recycler_cooldowns WHERE server_id = ? AND player_name = ?',
      [serverId, player]
    );
    
    if (cooldownResult.length > 0) {
      const lastUsed = new Date(cooldownResult[0].last_used);
      const now = new Date();
      const cooldownMs = config.cooldown_minutes * 60 * 1000;
      const timeSinceLastUse = now - lastUsed;
      
      if (timeSinceLastUse < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastUse) / (60 * 1000));
        console.log(`[RECYCLER] Player ${player} is on cooldown for ${remainingMinutes} minutes`);
        await sendRconCommand(ip, port, password, `say <color=#FF6B35>[RECYCLER]</color> <color=#FFD700>${player}</color> <color=#FF6B35>please wait ${remainingMinutes} minutes before spawning another recycler</color>`);
        return;
      }
    }
    
    // Get player position (similar to Book-a-Ride)
    console.log(`[RECYCLER] Getting position for ${player}`);
    sendRconCommand(ip, port, password, `printpos "${player}"`);
    
    // Store the player's request state
    const stateKey = `${guildId}:${serverName}:${player}`;
    recyclerState.set(stateKey, {
      player: player,
      serverId: serverId,
      timestamp: Date.now(),
      step: 'waiting_for_position'
    });

    // Set timeout to clean up state
    setTimeout(() => {
      recyclerState.delete(stateKey);
    }, 10000); // 10 second timeout

    return;

  } catch (error) {
    console.error('Error processing recycler spawn:', error);
  }
}

async function processKitDelivery(client, guildId, serverName, ip, port, password, player) {
  try {
    console.log(`[KIT DELIVERY] Processing delivery for ${player} on ${serverName}`);
    
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`[KIT DELIVERY] Server not found: ${serverName}`);
      return;
    }
    
    const serverId = serverResult[0].id;
    
    // Get player ID
    const [playerResult] = await pool.query(
      'SELECT id FROM players WHERE server_id = ? AND ign = ?',
      [serverId, player]
    );
    
    if (playerResult.length === 0) {
      console.log(`[KIT DELIVERY] Player not found: ${player} on server ${serverId}`);
      return;
    }
    
    const playerId = playerResult[0].id;
    
    // Check if player has any pending kit deliveries
    const [queueResult] = await pool.query(
      'SELECT * FROM kit_delivery_queue WHERE player_id = ? AND server_id = ? AND remaining_quantity > 0 ORDER BY created_at ASC LIMIT 1',
      [playerId, serverId]
    );
    
    if (queueResult.length === 0) {
      console.log(`[KIT DELIVERY] No pending deliveries for ${player}`);
      // Send message to player
      await sendRconCommand(ip, port, password, `say <color=#FF6B35>[KIT DELIVERY]</color> <color=#FFD700>${player}</color> <color=#FF6B35>you have no pending kit deliveries</color>`);
      return;
    }
    
    const queueEntry = queueResult[0];
    
    // Check cooldown (anti-spam protection)
    const now = new Date();
    if (queueEntry.last_delivered_at) {
      const timeSinceLastDelivery = (now - new Date(queueEntry.last_delivered_at)) / 1000;
      if (timeSinceLastDelivery < queueEntry.cooldown_seconds) {
        const remainingCooldown = Math.ceil(queueEntry.cooldown_seconds - timeSinceLastDelivery);
        console.log(`[KIT DELIVERY] Player ${player} is on cooldown for ${remainingCooldown} seconds`);
        
        // Send cooldown message
        await sendRconCommand(ip, port, password, `say <color=#FF6B35>[KIT DELIVERY]</color> <color=#FFD700>${player}</color> <color=#FF6B35>please wait ${remainingCooldown} seconds before claiming another kit</color>`);
        return;
      }
    }
    
    console.log(`[KIT DELIVERY] Delivering kit ${queueEntry.kit_name} to ${player}`);
    
    // Send the kit via RCON
    const kitCommand = `kit givetoplayer ${queueEntry.kit_name} ${player}`;
    await sendRconCommand(ip, port, password, kitCommand);
    console.log(`[KIT DELIVERY] Kit command sent: ${kitCommand}`);
    
    // Update the queue entry
    const newRemainingQuantity = queueEntry.remaining_quantity - 1;
    await pool.query(
      'UPDATE kit_delivery_queue SET remaining_quantity = ?, last_delivered_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newRemainingQuantity, queueEntry.id]
    );
    
    console.log(`[KIT DELIVERY] Updated queue - remaining quantity: ${newRemainingQuantity}`);
    
    // Send confirmation message in-game with same colors as shop
    if (newRemainingQuantity > 0) {
      await sendRconCommand(ip, port, password, `say <color=#00FF00>[KIT DELIVERY]</color> <color=#FFD700>${player}</color> <color=#00FF00>received</color> <color=#FFD700>${queueEntry.display_name}</color> <color=#00FF00>- ${newRemainingQuantity} remaining</color>`);
    } else {
      await sendRconCommand(ip, port, password, `say <color=#00FF00>[KIT DELIVERY]</color> <color=#FFD700>${player}</color> <color=#00FF00>received final</color> <color=#FFD700>${queueEntry.display_name}</color> <color=#00FF00>- all kits delivered!</color>`);
      
      // Delete the queue entry since it's complete
      await pool.query('DELETE FROM kit_delivery_queue WHERE id = ?', [queueEntry.id]);
      console.log(`[KIT DELIVERY] Deleted completed queue entry ${queueEntry.id}`);
    }
    
    // Send to admin feed
    await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `📦 **Kit Delivered:** ${player} claimed ${queueEntry.display_name} (${newRemainingQuantity} remaining)`);
    
  } catch (error) {
    console.error('Error processing kit delivery:', error);
    
    // Send error message to player
    try {
      await sendRconCommand(ip, port, password, `say <color=#FF6B35>[KIT DELIVERY]</color> <color=#FFD700>${player}</color> <color=#FF6B35>delivery failed - please contact an admin</color>`);
    } catch (msgError) {
      console.error(`[KIT DELIVERY] Failed to send error message: ${msgError.message}`);
    }
  }
}

async function handleZorpZoneStatus(client, guildId, serverName, msg, ip, port, password) {
  try {
    // Only process zone entry/exit messages, not general online/offline
    const entryMatch = msg.match(/You entered (.+) Zorp/);
    const exitMatch = msg.match(/You left (.+) Zorp/);
    
    if (entryMatch) {
      const zoneOwner = entryMatch[1];
      // Debug logging removed for production
    } else if (exitMatch) {
      const zoneOwner = exitMatch[1];
      // Debug logging removed for production
    }
    
    // Handle zone deletion messages
    const deleteMatch = msg.match(/Zone (.+) has been deleted/);
    if (deleteMatch) {
      const zoneName = deleteMatch[1];
      
      // Delete from database
      const [deleteResult] = await pool.query(
        'DELETE FROM zorp_zones WHERE name = ?',
        [zoneName]
      );
      
      if (deleteResult.affectedRows > 0) {
        // Send to zorp feed
        await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${zoneName} deleted`);
      }
    }
  } catch (error) {
    console.error('Error handling ZORP zone status:', error);
  }
}

async function setZoneToGreen(ip, port, password, playerName) {
  try {
    console.log(`[ZORP DEBUG] setZoneToGreen called for player: ${playerName}`);
    console.log(`[ZORP DEBUG] Current time: ${new Date().toISOString()}`);
    // Get zone name from database
    const [zoneResult] = await pool.query(
      'SELECT * FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    console.log(`[ZORP DEBUG] Found ${zoneResult.length} zones for player ${playerName}`);
    if (zoneResult.length > 0) {
      console.log(`[ZORP DEBUG] Zone details: name=${zoneResult[0].name}, current_state=${zoneResult[0].current_state}, color_online=${zoneResult[0].color_online}`);
    }
    
    if (zoneResult.length > 0) {
      const zone = zoneResult[0];
      
      // Clear any existing transition timers
      clearZorpTransitionTimer(zone.name);
      
      // Clear offline expiration timer when zone goes green
      await clearOfflineExpirationTimer(zone.name);
      
      // Clear expire countdown timer when player comes back online (pause the countdown)
      await clearExpireCountdownTimer(zone.name);
      
      // Set zone to green settings: allow building (1), allow building damage (1), allow PvP (1)
      console.log(`[ZORP DEBUG] Setting zone ${zone.name} to green - sending RCON commands...`);
      const result1 = await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuilding 1`);
      console.log(`[ZORP DEBUG] allowbuilding result: ${result1}`);
      const result2 = await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuildingdamage 1`);
      console.log(`[ZORP DEBUG] allowbuildingdamage result: ${result2}`);
      const result3 = await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowpvpdamage 1`);
      console.log(`[ZORP DEBUG] allowpvpdamage result: ${result3}`);
      const result4 = await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" color (${zone.color_online})`);
      console.log(`[ZORP DEBUG] color result: ${result4}`);
      
      // Update database state
      await pool.query(
        'UPDATE zorp_zones SET current_state = ?, last_online_at = NOW() WHERE id = ?',
        ['green', zone.id]
      );
      
      // Update in-memory state
      zorpZoneStates.set(zone.name, 'green');
      console.log(`[ZORP DEBUG] Successfully set zone ${zone.name} to green for player ${playerName}`);
      console.log(`[ZORP DEBUG] Zone state updated in memory: ${zorpZoneStates.get(zone.name)}`);
    }
  } catch (error) {
    console.error('Error setting zone to green:', error);
  }
}

async function setZoneToYellow(ip, port, password, playerName) {
  try {
    console.log(`[ZORP YELLOW DEBUG] ===== STARTING setZoneToYellow FOR ${playerName} =====`);
    
    // Get zone name from database
    const [zoneResult] = await pool.query(
      'SELECT * FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    console.log(`[ZORP YELLOW DEBUG] Found ${zoneResult.length} zones for ${playerName}`);
    
    if (zoneResult.length > 0) {
      const zone = zoneResult[0];
      const yellowColor = zone.color_yellow || '255,255,0';
      
      console.log(`[ZORP YELLOW DEBUG] Zone: ${zone.name}, Delay: ${zone.delay} minutes, Yellow color: ${yellowColor}`);
      
      // Set zone to yellow (always yellow during delay period - user can't change this)
      console.log(`[ZORP YELLOW DEBUG] Setting zone ${zone.name} to yellow color...`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuilding 1`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuildingdamage 1`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowpvpdamage 1`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" color (${yellowColor})`);
      
      console.log(`[ZORP YELLOW DEBUG] Zone color set to yellow, updating database state...`);
      
      // Update database state
      await pool.query(
        'UPDATE zorp_zones SET current_state = ? WHERE id = ?',
        ['yellow', zone.id]
      );
      
      // Update in-memory state
      zorpZoneStates.set(zone.name, 'yellow');
      
      console.log(`[ZORP YELLOW DEBUG] Database and memory state updated to yellow`);
      
      // Start timer for transition to red (delay is in minutes, convert to milliseconds)
      const delayMs = (zone.delay || 5) * 60 * 1000;
      console.log(`[ZORP YELLOW DEBUG] Starting timer for ${zone.delay || 5} minutes (${delayMs}ms) to transition to red`);
      
      await safeSetTransitionTimer(zone.name, async () => {
        console.log(`[ZORP YELLOW DEBUG] Timer fired - calling setZoneToRed for ${playerName}`);
        await setZoneToRed(ip, port, password, playerName);
      }, delayMs);
      
      console.log(`[ZORP YELLOW DEBUG] Timer set successfully for zone ${zone.name}`);
    } else {
      console.log(`[ZORP YELLOW DEBUG] No active zones found for ${playerName}`);
    }
    
    console.log(`[ZORP YELLOW DEBUG] ===== COMPLETED setZoneToYellow FOR ${playerName} =====`);
  } catch (error) {
    console.error('Error setting zone to yellow:', error);
  }
}

async function setZoneToRed(ip, port, password, playerName) {
  try {
    // Get zone name from database
    const [zoneResult] = await pool.query(
      'SELECT * FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    if (zoneResult.length > 0) {
      const zone = zoneResult[0];
      
      // Clear any existing transition timers
      clearZorpTransitionTimer(zone.name);
      
      // Set zone to red settings: allow building (1), no building damage (0), PvP enabled (1) - players can take damage but buildings cannot
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuilding 1`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowbuildingdamage 0`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" allowpvpdamage 1`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zone.name}" color (${zone.color_offline})`);
      
      // Update database state
      await pool.query(
        'UPDATE zorp_zones SET current_state = ? WHERE id = ?',
        ['red', zone.id]
      );
      
                    // Start expire countdown timer (this is the timer that counts down the expire time when offline)
      console.log(`[ZORP DEBUG] Starting expire countdown timer for ${playerName} (${zone.name}) with expire time: ${zone.expire} seconds`);
      await startExpireCountdownTimer(ip, port, password, playerName, zone.name, zone.expire);
      
      // Update in-memory state
      zorpZoneStates.set(zone.name, 'red');
    }
  } catch (error) {
    console.error('Error setting zone to red:', error);
  }
}

// Robust offline timer management functions
async function startOfflineExpirationTimer(ip, port, password, playerName, zoneName, expireSeconds) {
  try {
    console.log(`[ZORP OFFLINE TIMER] Starting offline expiration timer for ${playerName} (${zoneName}) - ${expireSeconds} seconds`);
    
    // Validate inputs
    if (!zoneName || !playerName || !expireSeconds || expireSeconds <= 0) {
      console.error(`[ZORP OFFLINE TIMER] Invalid parameters: zoneName=${zoneName}, playerName=${playerName}, expireSeconds=${expireSeconds}`);
      return;
    }
    
    // Record when player went offline
    zorpOfflineStartTimes.set(zoneName, Date.now());
    
    // Clear any existing offline timer
    clearOfflineExpirationTimer(zoneName);
    
    // Start new offline timer
    const timerId = setTimeout(async () => {
      try {
        await handleOfflineExpiration(ip, port, password, playerName, zoneName);
      } catch (error) {
        console.error(`[ZORP OFFLINE TIMER] Error in timer callback for ${zoneName}:`, error);
        // Clean up timer references on error
        zorpOfflineTimers.delete(zoneName);
        zorpOfflineStartTimes.delete(zoneName);
      }
    }, expireSeconds * 1000);
    
    // Store timer reference
    zorpOfflineTimers.set(zoneName, timerId);
    
    console.log(`[ZORP OFFLINE TIMER] Timer set for ${playerName} - will expire in ${expireSeconds} seconds`);
  } catch (error) {
    console.error('Error starting offline expiration timer:', error);
    // Clean up on error
    zorpOfflineTimers.delete(zoneName);
    zorpOfflineStartTimes.delete(zoneName);
  }
}

async function clearOfflineExpirationTimer(zoneName) {
  try {
    const existingTimer = zorpOfflineTimers.get(zoneName);
    if (existingTimer) {
      clearTimeout(existingTimer);
      zorpOfflineTimers.delete(zoneName);
      zorpOfflineStartTimes.delete(zoneName);
      console.log(`[ZORP OFFLINE TIMER] Cleared offline timer for ${zoneName}`);
    }
  } catch (error) {
    console.error('Error clearing offline expiration timer:', error);
  }
}

async function handleOfflineExpiration(ip, port, password, playerName, zoneName) {
  try {
    console.log(`[ZORP OFFLINE TIMER] Offline expiration reached for ${playerName} (${zoneName}) - deleting Zorp`);
    
    // Get server info for feed message
    const [serverResult] = await pool.query(`
      SELECT rs.nickname, g.discord_id 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.name = ?
    `, [zoneName]);
    
    if (serverResult.length > 0) {
      const server = serverResult[0];
      
      // Delete zone from game
      await sendRconCommand(ip, port, password, `zones.deletecustomzone "${zoneName}"`);
      
      // Delete zone from database
      await pool.query('DELETE FROM zorp_zones WHERE name = ?', [zoneName]);
      
      // Clean up timer references
      zorpOfflineTimers.delete(zoneName);
      zorpOfflineStartTimes.delete(zoneName);
      zorpZoneStates.delete(zoneName);
      
      // Send to zorp feed
      await sendFeedEmbed(client, server.discord_id, server.nickname, 'zorpfeed', `[ZORP] ${playerName} Zorp deleted (offline expiration)`);
      
      console.log(`[ZORP OFFLINE TIMER] Successfully deleted expired Zorp for ${playerName}`);
    }
  } catch (error) {
    console.error('Error handling offline expiration:', error);
  }
}

// Expire countdown timer functions (separate from offline timers)
async function startExpireCountdownTimer(ip, port, password, playerName, zoneName, expireSeconds) {
  try {
    console.log(`[ZORP EXPIRE TIMER] Starting expire countdown timer for ${playerName} (${zoneName}) - ${expireSeconds} seconds`);
    
    // Validate inputs
    if (!zoneName || !playerName || !expireSeconds || expireSeconds <= 0) {
      console.error(`[ZORP EXPIRE TIMER] Invalid parameters: zoneName=${zoneName}, playerName=${playerName}, expireSeconds=${expireSeconds}`);
      return;
    }
    
    // Clear any existing expire timer
    clearExpireCountdownTimer(zoneName);
    
    // Start new expire countdown timer
    console.log(`[ZORP DEBUG] Setting timeout for ${expireSeconds} seconds (${expireSeconds * 1000} ms) for zone ${zoneName}`);
    const timerId = setTimeout(async () => {
      try {
        console.log(`[ZORP DEBUG] Expire countdown timer fired for zone ${zoneName} - calling handleExpireCountdown`);
        await handleExpireCountdown(ip, port, password, playerName, zoneName);
      } catch (error) {
        console.error(`[ZORP EXPIRE TIMER] Error in timer callback for ${zoneName}:`, error);
        // Clean up timer references on error
        zorpOfflineExpireTimers.delete(zoneName);
      }
    }, expireSeconds * 1000);
    
    // Store timer reference
    zorpOfflineExpireTimers.set(zoneName, timerId);
    
    console.log(`[ZORP EXPIRE TIMER] Expire countdown timer set for ${playerName} - will delete zone in ${expireSeconds} seconds`);
  } catch (error) {
    console.error('Error starting expire countdown timer:', error);
    // Clean up on error
    zorpOfflineExpireTimers.delete(zoneName);
  }
}

async function clearExpireCountdownTimer(zoneName) {
  try {
    const existingTimer = zorpOfflineExpireTimers.get(zoneName);
    if (existingTimer) {
      clearTimeout(existingTimer);
      zorpOfflineExpireTimers.delete(zoneName);
      console.log(`[ZORP EXPIRE TIMER] Cleared expire countdown timer for ${zoneName}`);
    }
  } catch (error) {
    console.error('Error clearing expire countdown timer:', error);
  }
}

async function handleExpireCountdown(ip, port, password, playerName, zoneName) {
  try {
    console.log(`[ZORP EXPIRE TIMER] Expire countdown reached for ${playerName} (${zoneName}) - deleting Zorp`);
    
    // Get server info for feed message
    const [serverResult] = await pool.query(`
      SELECT rs.nickname, g.discord_id 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.name = ?
    `, [zoneName]);
    
    if (serverResult.length > 0) {
      const server = serverResult[0];
      
      // Delete zone from game
      await sendRconCommand(ip, port, password, `zones.deletecustomzone "${zoneName}"`);
      
      // Delete zone from database
      await pool.query('DELETE FROM zorp_zones WHERE name = ?', [zoneName]);
      
      // Clean up timer references
      zorpOfflineExpireTimers.delete(zoneName);
      zorpOfflineTimers.delete(zoneName);
      zorpOfflineStartTimes.delete(zoneName);
      zorpZoneStates.delete(zoneName);
      
      // Send to zorp feed
      await sendFeedEmbed(client, server.discord_id, server.nickname, 'zorpfeed', `[ZORP] ${playerName} Zorp deleted (expire countdown reached)`);
      
      console.log(`[ZORP EXPIRE TIMER] Successfully deleted expired Zorp for ${playerName}`);
    }
  } catch (error) {
    console.error('Error handling expire countdown:', error);
  }
}

async function getRemainingOfflineTime(zoneName) {
  const startTime = zorpOfflineStartTimes.get(zoneName);
  if (!startTime) return null;
  
  const [zoneResult] = await pool.query(
    'SELECT expire FROM zorp_zones WHERE name = ?',
    [zoneName]
  );
  
  if (zoneResult.length === 0) return null;
  
  const expireSeconds = zoneResult[0].expire;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const remaining = expireSeconds - elapsed;
  
  return Math.max(0, remaining);
}

async function initializeOfflineTimers(client) {
  try {
    console.log('[ZORP OFFLINE TIMER] Initializing offline timers for existing red zones...');
    
    // Get all zones that are currently in red state
    const [redZones] = await pool.query(`
      SELECT z.*, rs.ip, rs.port, rs.password
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.current_state = 'red' AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `);
    
    console.log(`[ZORP OFFLINE TIMER] Found ${redZones.length} red zones to initialize timers for`);
    
    for (const zone of redZones) {
      try {
        // Check if all team members are offline
        const allTeamOffline = await checkIfAllTeamMembersOffline(zone.ip, zone.port, zone.password, zone.owner);
        
        if (allTeamOffline) {
          // Start expire countdown timer for this zone (this is the timer that counts down the expire time)
          await startExpireCountdownTimer(zone.ip, zone.port, zone.password, zone.owner, zone.name, zone.expire);
          console.log(`[ZORP OFFLINE TIMER] Initialized expire countdown timer for ${zone.owner} (${zone.name}) - ${zone.expire} seconds`);
        } else {
          // Team members are online, set zone back to green
          await setZoneToGreen(zone.ip, zone.port, zone.password, zone.owner);
          console.log(`[ZORP OFFLINE TIMER] Team members online for ${zone.owner}, setting zone back to green`);
        }
      } catch (error) {
        console.error(`[ZORP OFFLINE TIMER] Error initializing timer for ${zone.name}:`, error);
      }
    }
    
    console.log('[ZORP OFFLINE TIMER] Offline timer initialization complete');
  } catch (error) {
    console.error('[ZORP OFFLINE TIMER] Error initializing offline timers:', error);
  }
}

async function handleTeamChanges(client, guildId, serverName, msg, ip, port, password) {
  try {
    // Check for team-related messages with team IDs
    const teamCreatedMatch = msg.match(/(.+) created a team, ID: \[(\d+)\]/);
    const teamJoinedMatch = msg.match(/(.+) has joined (.+)'?s team, ID: \[(\d+)\]/);
    const teamLeftMatch = msg.match(/(.+) has left (.+)'?s team, ID: \[(\d+)\]/);
    const teamKickedMatch = msg.match(/(.+) kicked (.+) from the team, ID: \[(\d+)\]/);
    const teamDisbandedMatch = msg.match(/(.+) disbanded the team, ID: \[(\d+)\]/);
    
    // Send team messages to Zorp feed
    if (teamCreatedMatch) {
      const playerName = teamCreatedMatch[1].trim();
      const teamId = teamCreatedMatch[2];
      await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[TEAM] (${teamId}) ${playerName} created`);
    }
    
    if (teamJoinedMatch) {
      const playerName = teamJoinedMatch[1].trim();
      const teamOwner = teamJoinedMatch[2].trim();
      const teamId = teamJoinedMatch[3];
      await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[TEAM] (${teamId}) ${playerName} joined`);
    }
    
    if (teamLeftMatch) {
      const playerName = teamLeftMatch[1].trim();
      const teamOwner = teamLeftMatch[2].trim();
      const teamId = teamLeftMatch[3];
      await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[TEAM] (${teamId}) ${playerName} left`);
    }
    
    if (teamKickedMatch) {
      const kicker = teamKickedMatch[1].trim();
      const kicked = teamKickedMatch[2].trim();
      const teamId = teamKickedMatch[3];
      await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[TEAM] (${teamId}) ${kicked} kicked by ${kicker}`);
    }
    
    if (teamDisbandedMatch) {
      const playerName = teamDisbandedMatch[1].trim();
      const teamId = teamDisbandedMatch[2];
      await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[TEAM] (${teamId}) disbanded by ${playerName}`);
    }
    
    if (teamCreatedMatch || teamJoinedMatch || teamLeftMatch || teamKickedMatch || teamDisbandedMatch) {
      // Debug logging removed for production
      console.log(`[ZORP DEBUG] Team change detected but NOT deleting zones - zones are individual player zones, not team zones`);
    }
  } catch (error) {
    console.error('Error handling team changes:', error);
  }
}

async function createZorpZone(client, guildId, serverName, ip, port, password, playerName) {
  try {
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
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
      return;
    }

    // Check ZORP list restrictions
    const [zorpConfig] = await pool.query(
      'SELECT use_list FROM zorp_configs WHERE server_id = ?',
      [serverId]
    );

    console.log(`[ZORP DEBUG] Server ID: ${serverId}, Player: ${playerName}`);
    console.log(`[ZORP DEBUG] ZORP Config found: ${zorpConfig.length > 0}, use_list: ${zorpConfig.length > 0 ? zorpConfig[0].use_list : 'N/A'}`);

    // Check if player is banned from ZORP (regardless of use_list setting)
    const [bannedResult] = await pool.query(
      'SELECT * FROM zorp_banned_users WHERE server_id = ? AND (discord_id = ? OR ign = ?)',
      [serverId, playerName, playerName]
    );

    console.log(`[ZORP DEBUG] Banned check: ${bannedResult.length} results`);

    if (bannedResult.length > 0) {
      console.log(`[ZORP DEBUG] Player ${playerName} is banned from ZORP`);
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You are banned from using ZORP zones.</color>`);
      return;
    }

    // If use_list is enabled, check if player is in allowed list
    if (zorpConfig.length > 0 && zorpConfig[0].use_list) {
      console.log(`[ZORP DEBUG] use_list is enabled, checking allowed list for ${playerName}`);
      
      const [allowedResult] = await pool.query(
        'SELECT * FROM zorp_allowed_users WHERE server_id = ? AND (discord_id = ? OR ign = ?)',
        [serverId, playerName, playerName]
      );

      console.log(`[ZORP DEBUG] Allowed check: ${allowedResult.length} results`);

      if (allowedResult.length === 0) {
        console.log(`[ZORP DEBUG] Player ${playerName} is not in allowed list`);
        await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You are not allowed to use ZORP zones. Contact an administrator.</color>`);
        return;
      } else {
        console.log(`[ZORP DEBUG] Player ${playerName} is in allowed list`);
      }
    } else {
      console.log(`[ZORP DEBUG] use_list is disabled or not found, allowing all players`);
    }

    // Check if player already has a zone
    const [existingZone] = await pool.query(
      'SELECT name FROM zorp_zones WHERE server_id = ? AND LOWER(owner) = LOWER(?)',
      [serverId, playerName]
    );

    if (existingZone.length > 0) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You already have an active Zorp zone. Use the goodbye emote to remove it first.</color>`);
      return;
    }

    // Get player position for proximity check
    const positionResponse = await sendRconCommand(ip, port, password, `printpos ${playerName}`);
          // Debug logging removed for production
    
    // Extract coordinates from position response
    const coords = extractCoordinates(positionResponse);
    if (!coords) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Could not get your position. Please try again.</color>`);
      return;
    }

    // Check proximity to other zones (minimum 150 units apart)
    const [nearbyZones] = await pool.query(
      'SELECT name, owner, position FROM zorp_zones WHERE server_id = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [serverId]
    );

    const MIN_DISTANCE = 150; // Minimum distance between zones
    for (const zone of nearbyZones) {
      if (zone.position) {
        let zoneCoords = typeof zone.position === 'string' ? JSON.parse(zone.position) : zone.position;
        // Convert object format {x,y,z} to array format [x,y,z] if needed
        if (typeof zoneCoords === 'object' && !Array.isArray(zoneCoords)) {
          zoneCoords = [zoneCoords.x, zoneCoords.y, zoneCoords.z];
        }
        const distance = Math.sqrt(
          Math.pow(coords[0] - zoneCoords[0], 2) + 
          Math.pow(coords[2] - zoneCoords[2], 2) // Use X and Z for ground distance
        );
        
        if (distance < MIN_DISTANCE) {
          await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Too close to ${zone.owner}'s zone! Minimum distance: ${MIN_DISTANCE}m (Current: ${Math.floor(distance)}m)</color>`);
          return;
        }
      }
    }

    // Get player's team info
    const teamInfo = await getPlayerTeam(ip, port, password, playerName);
    
    // Check if player is in a team
    if (!teamInfo) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You must be in a team to create a ZORP zone.</color>`);
      return;
    }

    // Check if player is the team owner
    if (teamInfo.owner !== playerName) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Only team owners can create ZORP zones.</color>`);
      return;
    }
    
    // Get server defaults for ZORP configuration
    const [defaultsResult] = await pool.query(
      'SELECT size, color_online, color_offline, radiation, delay, expire, min_team, max_team FROM zorp_defaults WHERE server_id = ?',
      [serverId]
    );

          // Debug logging removed for production
          // Debug logging removed for production

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

          // Debug logging removed for production
          // Debug logging removed for production

    // Check team size limits
    const teamSize = teamInfo.members.length;
    const minTeam = defaults.min_team;
    const maxTeam = defaults.max_team;

    if (teamSize < minTeam) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Your team is too small. Minimum: ${minTeam} players</color>`);
      return;
    }

    if (teamSize > maxTeam) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Your team is too large. Maximum: ${maxTeam} players</color>`);
      return;
    }

    // Use coordinates from proximity check (already extracted above)
    // Debug logging removed for production

    // Check for overlapping zones
    const [existingZones] = await pool.query(
      'SELECT name, position, size FROM zorp_zones WHERE server_id = ?',
      [serverId]
    );

    const newZonePos = { x: coords[0], y: coords[1], z: coords[2] };
    const newZoneSize = defaults.size;

    for (const zone of existingZones) {
      if (zone.position) {
        let existingPos = typeof zone.position === 'string' ? JSON.parse(zone.position) : zone.position;
        // Convert object format {x,y,z} to array format [x,y,z] if needed
        if (typeof existingPos === 'object' && !Array.isArray(existingPos)) {
          existingPos = [existingPos.x, existingPos.y, existingPos.z];
        }
        const existingSize = zone.size || 75; // Default size if not set

        // Debug logging removed for production

        if (zonesOverlap(newZonePos, newZoneSize, existingPos, existingSize)) {
          const overlapMessage = `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You are too close to another ZORP!</color>`;
          await sendRconCommand(ip, port, password, overlapMessage);
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
    console.log(`[ZORP DEBUG] Creating zone with command: ${zoneCommand}`);
    const createResult = await sendRconCommand(ip, port, password, zoneCommand);
    console.log(`[ZORP DEBUG] Zone creation result: ${createResult}`);

    // Set zone to white initially (2-minute transition to green)
    console.log(`[ZORP DEBUG] Setting zone ${zoneName} to white state`);
    await setZoneToWhite(ip, port, password, zoneName);

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
      position: coords,
      size: defaults.size,
      color_online: defaults.color_online,
      color_offline: defaults.color_offline,
      color_yellow: defaults.color_yellow || '255,255,0',
      radiation: defaults.radiation,
      delay: defaults.delay,
      expire: defaults.expire, // Use server default expiration time
      min_team: minTeam,
      max_team: maxTeam,
      current_state: 'white',
      last_online_at: new Date()
    };

    console.log(`[ZORP DEBUG] Inserting zone into database: ${zoneName} for player ${playerName}`);
    await pool.query(`
      INSERT INTO zorp_zones (server_id, name, owner, team, position, size, color_online, color_offline, color_yellow, radiation, delay, expire, min_team, max_team, current_state, last_online_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      zoneData.server_id, zoneData.name, zoneData.owner, JSON.stringify(zoneData.team),
      JSON.stringify(zoneData.position), zoneData.size, zoneData.color_online, zoneData.color_offline, zoneData.color_yellow,
      zoneData.radiation, zoneData.delay, zoneData.expire, zoneData.min_team, zoneData.max_team, zoneData.current_state, zoneData.last_online_at
    ]);
    console.log(`[ZORP DEBUG] Successfully inserted zone ${zoneName} into database`);

    // Now that the zone is in the database, create the timer with the correct delay
    console.log(`[ZORP DEBUG] About to query delay for zone ${zoneName} (after database insertion)`);
    const [delayResult] = await pool.query(
      'SELECT delay FROM zorp_zones WHERE name = ?',
      [zoneName]
    );
    
    console.log(`[ZORP DEBUG] Delay query result: ${delayResult.length} rows, delay value: ${delayResult.length > 0 ? delayResult[0].delay : 'N/A'}`);
    const delayMinutes = delayResult.length > 0 ? (delayResult[0].delay || 1) : 1;
    const delayMs = delayMinutes * 60 * 1000;
    
    console.log(`[ZORP DEBUG] Starting ${delayMinutes}-minute timer for zone ${zoneName} to transition from white to green`);
    console.log(`[ZORP DEBUG] Timer will fire at: ${new Date(Date.now() + delayMs).toISOString()}`);
    
    console.log(`[ZORP DEBUG] About to create setTimeout with ${delayMs}ms delay`);
    
    await safeSetTransitionTimer(zoneName, async () => {
      console.log(`[ZORP DEBUG] ${delayMinutes}-minute timer fired for zone ${zoneName} - transitioning to green`);
      console.log(`[ZORP DEBUG] Current time: ${new Date().toISOString()}`);
      // Get zone owner from database instead of parsing zone name
      const [ownerResult] = await pool.query(
        'SELECT owner FROM zorp_zones WHERE name = ?',
        [zoneName]
      );
      
      if (ownerResult.length > 0) {
        const playerName = ownerResult[0].owner;
        console.log(`[ZORP DEBUG] Found owner ${playerName} for zone ${zoneName}, calling setZoneToGreen`);
        await setZoneToGreen(ip, port, password, playerName);
      } else {
        console.log(`[ZORP DEBUG] No owner found for zone ${zoneName} in database`);
      }
    }, delayMs);
    
    console.log(`[ZORP] Started ${delayMinutes}-minute timer for zone ${zoneName} to go green`);
    console.log(`[ZORP DEBUG] Delay: ${delayMs}ms, Stored in zorpTransitionTimers: ${zorpTransitionTimers.has(zoneName)}`);
    


    // Send success message
    await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Zorp successfully created.</color>`);

    // Log to zorp feed
    await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${playerName} Zorp created`);

    // Verify zone was created by checking if it exists in the game
    console.log(`[ZORP DEBUG] Verifying zone ${zoneName} was created successfully...`);
    try {
      const verifyResult = await sendRconCommand(ip, port, password, `zones.list`);
      console.log(`[ZORP DEBUG] Zones list result: ${verifyResult}`);
    } catch (verifyError) {
      console.log(`[ZORP DEBUG] Zone verification failed (non-critical): ${verifyError.message}`);
    }

    // Debug logging removed for production

  } catch (error) {
    console.error('Error creating ZORP zone:', error);
  }
}

async function deleteZorpZone(client, guildId, serverName, ip, port, password, playerName) {
  try {
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      return;
    }
    
    const serverId = serverResult[0].id;

    // Check if player has a zone
    const [zoneResult] = await pool.query(
      'SELECT name FROM zorp_zones WHERE server_id = ? AND LOWER(owner) = LOWER(?)',
      [serverId, playerName]
    );

    if (zoneResult.length === 0) {
      await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>You don't have a Zorp zone to delete.</color>`);
      return;
    }

    const zoneName = zoneResult[0].name;

    // Delete zone from game
    await sendRconCommand(ip, port, password, `zones.deletecustomzone "${zoneName}"`);

    // Delete zone from database
    await pool.query('DELETE FROM zorp_zones WHERE server_id = ? AND LOWER(owner) = LOWER(?)', [serverId, playerName]);

    // Send success message
    await sendRconCommand(ip, port, password, `say <color=#FF69B4>[ZORP]${playerName}</color> <color=white>Zorp successfully deleted!</color>`);

    // Log to zorp feed
    await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${playerName} Zorp deleted`);

  } catch (error) {
    console.error('Error deleting ZORP zone:', error);
  }
}

async function getPlayerTeam(ip, port, password, playerName) {
  try {
    // Check if we have a tracked team ID for this player
    const teamId = playerTeamIds.get(playerName);
    if (!teamId) {
      // Debug logging removed for production
      
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
              }
            }
          }
          
          // Check the last team
          if (currentTeamId && teamMembers.includes(playerName)) {
            // Cache this team info
            playerTeamIds.set(playerName, currentTeamId);
            
            const playerTeam = { 
              id: currentTeamId, 
              owner: teamOwner, 
              members: teamMembers 
            };
            
            return playerTeam;
          }
        }
      } catch (fallbackError) {
        console.error('[ZORP DEBUG] Fallback team query failed:', fallbackError);
      }
      
      return null;
    }
    
    // Get detailed team info using the team ID
    const detailedTeamInfo = await sendRconCommand(ip, port, password, `relationshipmanager.teaminfo "${teamId}"`);
    
    if (!detailedTeamInfo) {
      return null;
    }
    
    const teamLines = detailedTeamInfo.split('\n');
    const teamMembers = [];
    let teamOwner = null;
    
    for (const teamLine of teamLines) {
      if (teamLine.includes('(LEADER)')) {
        const leaderMatch = teamLine.match(/(.+) \[(\d+)\] \(LEADER\)/);
        if (leaderMatch) {
          teamOwner = leaderMatch[1];
          teamMembers.push(leaderMatch[1]);
        }
      } else if (teamLine.includes('Member:')) {
        const memberMatch = teamLine.match(/Member: (.+)/);
        if (memberMatch) {
          const member = memberMatch[1];
          teamMembers.push(member);
        }
      }
    }
    
    if (teamMembers.length === 0) {
      return null;
    }
    
    const playerTeam = { 
      id: teamId, 
      owner: teamOwner, 
      members: teamMembers 
    };
    
    return playerTeam;
    
  } catch (error) {
    console.error('Error getting player team:', error);
    return null;
  }
}

// Helper functions for ZORP enhanced system
function extractCoordinates(positionString) {
  try {
    if (!positionString) return null;
    
    // Handle both string and object inputs
    let coordString = positionString;
    if (typeof positionString === 'object' && positionString.Message) {
      coordString = positionString.Message;
    }
    
    console.log(`[ZORP DEBUG] Extracting coordinates from: "${coordString}"`);
    
    // Look for coordinates in format: (-516.50, 28.89, 853.84)
    const match = coordString.match(/\(([^)]+)\)/);
    if (!match) {
      console.log(`[ZORP DEBUG] No coordinate pattern found in: "${coordString}"`);
      return null;
    }
    
    const coords = match[1].split(',').map(c => parseFloat(c.trim()));
    if (coords.length !== 3 || coords.some(isNaN)) {
      console.log(`[ZORP DEBUG] Invalid coordinates parsed:`, coords);
      return null;
    }
    
    console.log(`[ZORP DEBUG] Successfully extracted coordinates:`, coords);
    return coords;
  } catch (error) {
    console.error('[ZORP] Error extracting coordinates:', error);
    return null;
  }
}

function clearZorpTransitionTimer(zoneName) {
  const timerId = zorpTransitionTimers.get(zoneName);
  if (timerId) {
    clearTimeout(timerId);
    zorpTransitionTimers.delete(zoneName);
    console.log(`[ZORP] Cleared transition timer for zone ${zoneName}`);
  } else {
    console.log(`[ZORP DEBUG] No transition timer found to clear for zone ${zoneName}`);
  }
}

// Safe timer management with locks to prevent race conditions
async function safeSetTransitionTimer(zoneName, callback, delayMs) {
  // Check if timer is already being set for this zone
  if (zorpTimerLocks.has(zoneName)) {
    console.log(`[ZORP DEBUG] Timer operation already in progress for zone ${zoneName}, skipping`);
    return;
  }
  
  try {
    // Set lock
    zorpTimerLocks.set(zoneName, true);
    
    // Clear any existing timer first
    clearZorpTransitionTimer(zoneName);
    
    // Set new timer
    const timerId = setTimeout(async () => {
      try {
        await callback();
      } finally {
        // Always clear lock when timer fires
        zorpTimerLocks.delete(zoneName);
        zorpTransitionTimers.delete(zoneName);
      }
    }, delayMs);
    
    // Store timer reference
    zorpTransitionTimers.set(zoneName, timerId);
    console.log(`[ZORP DEBUG] Set transition timer for zone ${zoneName} with ${delayMs}ms delay`);
    
  } catch (error) {
    console.error(`[ZORP ERROR] Failed to set transition timer for zone ${zoneName}:`, error);
    zorpTimerLocks.delete(zoneName);
  }
}

async function setZoneToWhite(ip, port, password, zoneName, whiteColor = '255,255,255') {
  try {
    // Set zone to white (initial creation state)
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" allowbuilding 1`);
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" allowbuildingdamage 1`);
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" allowpvpdamage 1`);
    await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" color (${whiteColor})`);
    
    // Update in-memory state
    zorpZoneStates.set(zoneName, 'white');
    
    console.log(`[ZORP] Set zone ${zoneName} to white (initial creation)`);
    console.log(`[ZORP DEBUG] setZoneToWhite function completed successfully for zone ${zoneName}`);
  } catch (error) {
    console.error(`Error setting zone to white:`, error);
    console.error(`[ZORP DEBUG] setZoneToWhite function failed for zone ${zoneName}:`, error.message);
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

async function processStuckWhiteZones() {
  try {
    console.log('🔍 Checking for stuck white zones...');
    
    // Find zones that are stuck in white state and should have turned green
    const [stuckZones] = await pool.query(`
      SELECT z.*, rs.ip, rs.port, rs.password, g.discord_id as guild_id, rs.nickname
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.current_state = 'white' 
      AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      AND z.created_at + INTERVAL (z.delay * 60) SECOND < CURRENT_TIMESTAMP
    `);

    console.log(`[ZORP DEBUG] Found ${stuckZones.length} stuck white zones that should be green`);

    for (const zone of stuckZones) {
      try {
        console.log(`[ZORP DEBUG] Processing stuck white zone: ${zone.name} (${zone.owner}) - should have turned green ${zone.delay} minutes ago`);
        
        // Set zone to green immediately
        await setZoneToGreen(zone.ip, zone.port, zone.password, zone.owner);
        
        console.log(`[ZORP DEBUG] Successfully processed stuck white zone: ${zone.name}`);
        
      } catch (error) {
        console.error(`[ZORP DEBUG] Error processing stuck white zone ${zone.name}:`, error);
      }
    }
    
    if (stuckZones.length > 0) {
      console.log(`[ZORP] Processed ${stuckZones.length} stuck white zones`);
    }
    
  } catch (error) {
    console.error('Error processing stuck white zones:', error);
  }
}

async function restoreZonesOnStartup(client) {
  try {
    console.log('🔄 Restoring zones on bot startup...');
    
    // First, process any stuck white zones
    await processStuckWhiteZones();
    
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
        
        // Parse position - handle both array [x,y,z] and object {x,y,z} formats
        let position = typeof zone.position === 'string' ? JSON.parse(zone.position) : zone.position;
        
        // Convert array format [x,y,z] to object format {x,y,z}
        if (Array.isArray(position) && position.length >= 3) {
          position = { x: position[0], y: position[1], z: position[2] };
        }
        
        if (!position || typeof position.x === 'undefined' || typeof position.y === 'undefined' || typeof position.z === 'undefined') {
          console.log(`[ZORP] Skipping zone ${zone.name} - invalid position data:`, position);
          continue;
        }

        console.log(`[ZORP DEBUG] Zone position: x=${position.x}, y=${position.y}, z=${position.z}`);

        // Recreate zone in-game - NO SPACES in coordinates
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
    // Get all active zones that might need cleanup
    const [result] = await pool.query(`
      SELECT z.*, rs.ip, rs.port, rs.password, g.discord_id as guild_id, rs.nickname
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `);

    for (const zone of result) {
      try {
        // Check if this zone has an active offline timer
        const offlineStartTime = zorpOfflineStartTimes.get(zone.name);
        
        if (offlineStartTime) {
          // Zone has offline timer - check if it should be expired
          const elapsed = Math.floor((Date.now() - offlineStartTime) / 1000);
          
          if (elapsed >= zone.expire) {
            console.log(`[ZORP] Offline expiration reached for ${zone.name} (${elapsed}s elapsed, ${zone.expire}s limit)`);
            
            // Delete from game
            await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zone.name}"`);
            
            // Delete from database
            await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
            
            // Clean up timer references
            zorpOfflineTimers.delete(zone.name);
            zorpOfflineStartTimes.delete(zone.name);
            zorpZoneStates.delete(zone.name);
            
            // Send to zorp feed
            await sendFeedEmbed(client, zone.guild_id, zone.nickname, 'zorpfeed', `[ZORP] ${zone.owner} Zorp deleted (offline expiration)`);
            
            console.log(`[ZORP] Deleted offline-expired zone: ${zone.name}`);
          }
        } else {
          // Zone has no offline timer - check if it's been created too long ago (fallback cleanup)
          const createdTime = new Date(zone.created_at).getTime();
          const elapsed = Math.floor((Date.now() - createdTime) / 1000);
          
          if (elapsed >= zone.expire * 2) { // Double the expire time as fallback
            console.log(`[ZORP] Fallback cleanup for old zone ${zone.name} (${elapsed}s elapsed)`);
            
            // Delete from game
            await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zone.name}"`);
            
            // Delete from database
            await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
            
            // Clean up timer references
            zorpOfflineTimers.delete(zone.name);
            zorpOfflineStartTimes.delete(zone.name);
            zorpZoneStates.delete(zone.name);
            
            // Send to zorp feed
            await sendFeedEmbed(client, zone.guild_id, zone.nickname, 'zorpfeed', `[ZORP] ${zone.owner} Zorp deleted (fallback cleanup)`);
            
            console.log(`[ZORP] Deleted old zone (fallback): ${zone.name}`);
          }
        }
      } catch (error) {
        console.error(`Error processing zone ${zone.name}:`, error);
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
    // Try 'status' command first (most reliable for player list)
    let result = null;
    let players = new Set();
    
    try {
      result = await sendRconCommand(ip, port, password, 'status');
    } catch (error) {
      console.log('[ZORP DEBUG] status command failed, trying players command...');
    }
    
    if (result) {
      const lines = result.split('\n');
      for (const line of lines) {
        // Look for lines that contain player info (usually have steam ID)
        if (line.trim() && line.includes('(') && line.includes(')') && !line.includes('died')) {
          // Extract player name from format like "PlayerName (SteamID)"
          const match = line.match(/^([^(]+)/);
          if (match) {
            const playerName = match[1].trim();
            // Filter out death messages and other non-player data
            if (playerName && !playerName.includes('died') && !playerName.includes('Generic') && 
                !playerName.includes('<slot:') && !playerName.includes('1users') && 
                !playerName.includes('id ;name') && !playerName.includes('NA ;') &&
                !playerName.includes('status') && !playerName.includes('players') &&
                !playerName.includes('0users') && !playerName.includes('users')) {
              players.add(playerName);
            }
          }
        }
      }
    }
    
    // If 'status' command failed or returned no results, try 'players' as fallback
    if (players.size === 0) {
      try {
        result = await sendRconCommand(ip, port, password, 'players');
      } catch (error) {
        console.log('[ZORP DEBUG] players command failed, trying users command...');
      }
      
      if (result) {
        const lines = result.split('\n');
        for (const line of lines) {
          if (line.trim() && line.includes('(') && line.includes(')')) {
            // Extract player name from format like "PlayerName (SteamID)"
            const match = line.match(/^([^(]+)/);
            if (match) {
              const playerName = match[1].trim();
              // Filter out death messages and other non-player data
              if (playerName && !playerName.includes('died') && !playerName.includes('Generic') && 
                  !playerName.includes('<slot:') && !playerName.includes('1users') && 
                  !playerName.includes('id ;name') && !playerName.includes('NA ;') &&
                  !playerName.includes('0users') && !playerName.includes('users')) {
                players.add(playerName);
              }
            }
          }
        }
      }
    }
    
    // If 'players' command failed or returned no results, try 'users' as last resort
    if (players.size === 0) {
      try {
        result = await sendRconCommand(ip, port, password, 'users');
      } catch (error) {
        console.log('[ZORP DEBUG] users command failed, returning empty player list');
      }
      
      if (result) {
        const lines = result.split('\n');
        for (const line of lines) {
          if (line.trim() && !line.includes('Users:') && !line.includes('Total:')) {
            const playerName = line.trim();
            // Filter out death messages and other non-player data
            if (playerName && !playerName.includes('died') && !playerName.includes('Generic') && 
                !playerName.includes('<slot:') && !playerName.includes('1users') && 
                !playerName.includes('id ;name') && !playerName.includes('NA ;') &&
                !playerName.includes('0users') && !playerName.includes('users')) {
              players.add(playerName);
            }
          }
        }
      }
    }
    
    console.log(`[ZORP DEBUG] Found ${players.size} online players: ${Array.from(players).join(', ')}`);
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
    
    console.log(`[ZORP DEBUG] Checking online status for ${serverName}:`);
    console.log(`  Previous online: ${Array.from(previousOnline).join(', ')}`);
    console.log(`  Current online: ${Array.from(currentOnline).join(', ')}`);
    
    // Only process if we have valid data
    if (currentOnline.size === 0 && previousOnline.size === 0) {
      return; // Skip if no players detected
    }
    
    // Check who went offline - PRIMARY METHOD FOR ZORP OFFLINE DETECTION
    for (const player of previousOnline) {
      if (!currentOnline.has(player)) {
        // Only trigger offline if player was actually online before
        console.log(`[ZORP] Player ${player} went offline on ${serverName} (via polling)`);
        
        // Always handle playtime tracking for offline players
        await handlePlaytimeOffline(guildId, serverName, player);
        
        // Check if this player has a Zorp zone before processing offline
        const [zoneResult] = await pool.query(
          'SELECT name FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
          [player]
        );
        
        if (zoneResult.length > 0) {
          // Only handle offline if player has a Zorp zone
          await handlePlayerOffline(client, guildId, serverName, player, ip, port, password);
        } else {
          console.log(`[ZORP] Player ${player} went offline but has no Zorp zone - skipping Zorp processing`);
        }
      }
    }
    
    // Check who came online - PRIMARY METHOD FOR ZORP ONLINE DETECTION
    for (const player of currentOnline) {
      if (!previousOnline.has(player)) {
        // Only trigger online if player wasn't online before
        console.log(`[ZORP] Player ${player} came online on ${serverName} (via polling)`);
        
        // Always handle playtime tracking for online players
        await handlePlaytimeOnline(guildId, serverName, player);
        
        // Check if this player has a Zorp zone or is part of a team with a Zorp zone
        const [zoneResult] = await pool.query(
          'SELECT name FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
          [player]
        );
        
        if (zoneResult.length > 0) {
          // Player has their own Zorp zone
          await handlePlayerOnline(client, guildId, serverName, player, ip, port, password);
        } else {
          // Check if player is part of a team that has a Zorp zone
          const teamInfo = await getPlayerTeam(ip, port, password, player);
          if (teamInfo && teamInfo.owner) {
            const [teamZoneResult] = await pool.query(
              'SELECT name FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
              [teamInfo.owner]
            );
            
            if (teamZoneResult.length > 0) {
              // Team member came online, handle team owner's zone
              await handlePlayerOnline(client, guildId, serverName, player, ip, port, password);
            } else {
              console.log(`[ZORP] Player ${player} came online but has no Zorp zone and team has no Zorp - skipping Zorp processing`);
            }
          } else {
            console.log(`[ZORP] Player ${player} came online but has no Zorp zone and is not in a team - skipping Zorp processing`);
          }
        }
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
    
    // Deduplication: prevent multiple calls for the same player within 15 seconds
    const playerKey = `${guildId}_${serverName}_${cleanPlayerName}`;
    const now = Date.now();
    const lastCall = lastOfflineCall.get(playerKey) || 0;
    
    if (now - lastCall < 30000) { // Increased to 30 seconds for better stability on high-population servers
      console.log(`[ZORP] Skipping duplicate offline call for ${cleanPlayerName} (last call was ${Math.round((now - lastCall) / 1000)}s ago)`);
      return;
    }
    
    lastOfflineCall.set(playerKey, now);
    
    console.log(`[ZORP OFFLINE DEBUG] ===== STARTING OFFLINE PROCESSING FOR ${cleanPlayerName} =====`);
    console.log(`[ZORP OFFLINE DEBUG] Processing offline for ${cleanPlayerName} on ${serverName}`);
    console.log(`[ZORP OFFLINE DEBUG] Current time: ${new Date().toISOString()}`);
    
    // Check if player has a Zorp zone before processing
    const [zoneResult] = await pool.query(
      'SELECT name, current_state FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [cleanPlayerName]
    );
    
    console.log(`[ZORP OFFLINE DEBUG] Found ${zoneResult.length} zones for ${cleanPlayerName}`);
    
    if (zoneResult.length > 0) {
      const zone = zoneResult[0];
      const currentState = zone.current_state || 'green';
      
      console.log(`[ZORP OFFLINE DEBUG] Zone ${zone.name} current state: ${currentState}`);
      
      // Only process offline if zone is currently green (online state)
      if (currentState === 'green') {
        console.log(`[ZORP OFFLINE DEBUG] Zone is green, checking if all team members are offline...`);
        
        // Check if ALL team members are offline (not just the owner)
        const allTeamOffline = await checkIfAllTeamMembersOffline(ip, port, password, cleanPlayerName);
        
        console.log(`[ZORP OFFLINE DEBUG] All team members offline result: ${allTeamOffline}`);
        
        if (allTeamOffline) {
          console.log(`[ZORP OFFLINE DEBUG] All team members offline - calling setZoneToYellow for ${cleanPlayerName}`);
          
          // Set zone to yellow first (which will start timer for red transition)
          await setZoneToYellow(ip, port, password, cleanPlayerName);
          
          console.log(`[ZORP OFFLINE DEBUG] setZoneToYellow completed for ${cleanPlayerName}`);
          
          // Get zone delay for feed message
          const [zoneInfo] = await pool.query(
            'SELECT delay FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
            [cleanPlayerName]
          );
          const delayMinutes = zoneInfo.length > 0 ? (zoneInfo[0].delay || 5) : 5;
          
          // Send offline message to zorp feed
          await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${cleanPlayerName} Zorp=yellow (All team offline, ${delayMinutes} min delay)`);
          
          console.log(`[ZORP] Player ${cleanPlayerName} went offline, ALL team members offline, zone set to yellow (${delayMinutes} min delay to red)`);
        } else {
          // At least one team member is still online, keep zone green
          console.log(`[ZORP] Player ${cleanPlayerName} went offline, but other team members are still online, keeping zone green`);
        }
      } else {
        console.log(`[ZORP] Player ${cleanPlayerName} went offline but zone is already in ${currentState} state - no transition needed`);
      }
    } else {
      // Check if this player is part of a team that has a zorp zone
      const teamInfo = await getPlayerTeam(ip, port, password, cleanPlayerName);
      if (teamInfo && teamInfo.owner) {
        // Check if team owner has a zorp zone
        const [teamZoneResult] = await pool.query(
          'SELECT name, current_state FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
          [teamInfo.owner]
        );
        
        if (teamZoneResult.length > 0) {
          const teamZone = teamZoneResult[0];
          const teamCurrentState = teamZone.current_state || 'green';
          
          // Only process offline if zone is currently green
          if (teamCurrentState === 'green') {
            // Check if ALL team members are offline
            const allTeamOffline = await checkIfAllTeamMembersOffline(ip, port, password, teamInfo.owner);
            
            if (allTeamOffline) {
              // Set team owner's zone to yellow
              await setZoneToYellow(ip, port, password, teamInfo.owner);
              
              // Get zone delay for feed message
              const [zoneInfo] = await pool.query(
                'SELECT delay FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
                [teamInfo.owner]
              );
              const delayMinutes = zoneInfo.length > 0 ? (zoneInfo[0].delay || 5) : 5;
              
              // Send offline message to zorp feed
              await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${teamInfo.owner} Zorp=yellow (All team offline, ${delayMinutes} min delay)`);
              
              console.log(`[ZORP] Team member ${cleanPlayerName} went offline, ALL team members offline, team owner ${teamInfo.owner}'s zone set to yellow (${delayMinutes} min delay to red)`);
            } else {
              console.log(`[ZORP] Team member ${cleanPlayerName} went offline, but other team members are still online, keeping team owner ${teamInfo.owner}'s zone green`);
            }
          } else {
            console.log(`[ZORP] Team member ${cleanPlayerName} went offline but team owner ${teamInfo.owner}'s zone is already in ${teamCurrentState} state - no transition needed`);
          }
        }
      } else {
        console.log(`[ZORP OFFLINE DEBUG] Player ${cleanPlayerName} went offline but has no Zorp zone and is not in a team with a zorp`);
      }
    }
    
    console.log(`[ZORP OFFLINE DEBUG] ===== COMPLETED OFFLINE PROCESSING FOR ${cleanPlayerName} =====`);
  } catch (error) {
    console.error('Error handling player offline:', error);
    console.log(`[ZORP OFFLINE DEBUG] ===== ERROR IN OFFLINE PROCESSING FOR ${cleanPlayerName} =====`);
  }
}

async function handlePlayerOnline(client, guildId, serverName, playerName, ip, port, password) {
  try {
    // Clean player name by removing quotes
    const cleanPlayerName = playerName.replace(/^"|"$/g, '');
    
    // Deduplication: prevent multiple calls for the same player within 15 seconds
    const playerKey = `${guildId}_${serverName}_${cleanPlayerName}`;
    const now = Date.now();
    const lastCall = lastOfflineCall.get(playerKey) || 0;
    
    if (now - lastCall < 30000) { // Increased to 30 seconds for better stability on high-population servers
      console.log(`[ZORP] Skipping duplicate online call for ${cleanPlayerName} (last call was ${Math.round((now - lastCall) / 1000)}s ago)`);
      return;
    }
    
    lastOfflineCall.set(playerKey, now);
    
    console.log(`[ZORP DEBUG] Processing online for ${cleanPlayerName} on ${serverName}`);
    
    // Check if player has a Zorp zone before processing
    const [zoneResult] = await pool.query(
      'SELECT name, current_state FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [cleanPlayerName]
    );
    
    console.log(`[ZORP DEBUG] Found ${zoneResult.length} zones for ${cleanPlayerName}`);
    
    if (zoneResult.length > 0) {
      const zone = zoneResult[0];
      const currentState = zone.current_state || 'green';
      
      // Only process online if zone is not already green
      if (currentState !== 'green') {
        // Set zone to green when ANY team member comes online
        await setZoneToGreen(ip, port, password, cleanPlayerName);
        
        // Clear offline expiration timer when player comes back online
        await clearOfflineExpirationTimer(zone.name);
        await clearExpireCountdownTimer(zone.name);
        
        // Send online message to zorp feed
        await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${cleanPlayerName} Zorp=green (Team member online)`);
        
        console.log(`[ZORP] Player ${cleanPlayerName} came online, zone set to green (was ${currentState}), offline timer cleared`);
      } else {
        console.log(`[ZORP] Player ${cleanPlayerName} came online but zone is already green - no transition needed`);
      }
    } else {
      // Check if this player is part of a team that has a zorp zone
      const teamInfo = await getPlayerTeam(ip, port, password, cleanPlayerName);
      if (teamInfo && teamInfo.owner) {
        // Check if team owner has a zorp zone
        const [teamZoneResult] = await pool.query(
          'SELECT name, current_state FROM zorp_zones WHERE LOWER(owner) = LOWER(?) AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
          [teamInfo.owner]
        );
        
        if (teamZoneResult.length > 0) {
          const teamZone = teamZoneResult[0];
          const teamCurrentState = teamZone.current_state || 'green';
          
          // Only process online if zone is not already green
          if (teamCurrentState !== 'green') {
            // Set team owner's zone to green since a team member came online
            await setZoneToGreen(ip, port, password, teamInfo.owner);
            
            // Clear offline expiration timer when team member comes back online
            await clearOfflineExpirationTimer(teamZone.name);
            await clearExpireCountdownTimer(teamZone.name);
            
            // Send online message to zorp feed
            await sendFeedEmbed(client, guildId, serverName, 'zorpfeed', `[ZORP] ${teamInfo.owner} Zorp=green (Team member ${cleanPlayerName} online)`);
            
            console.log(`[ZORP] Team member ${cleanPlayerName} came online, set team owner ${teamInfo.owner}'s zone to green (was ${teamCurrentState}), offline timer cleared`);
          } else {
            console.log(`[ZORP] Team member ${cleanPlayerName} came online but team owner ${teamInfo.owner}'s zone is already green - no transition needed`);
          }
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
      console.log(`[ZORP] Player ${playerName} joined team ${teamId} - updating team tracking for Zorp state management`);
      return;
    }

    // Track when players leave teams
    const leaveMatch = msg.match(/(.+) has left (.+)s team, ID: \[(\d+)\]/);
    if (leaveMatch) {
      const playerName = cleanPlayerName(leaveMatch[1]);
      const teamId = leaveMatch[3];
      playerTeamIds.delete(playerName);
      console.log(`[ZORP] Player ${playerName} left team ${teamId}`);
      
      // Zorp zones are individual player zones, not team zones
      // Do NOT delete zones when players leave teams, but update team tracking for state management
      console.log(`[ZORP] Player ${playerName} left team ${teamId} - keeping their Zorp zone intact, updating team tracking`);
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
      
      // Zorp zones are individual player zones, not team zones
      // Do NOT delete zones when players are kicked from teams, but update team tracking for state management
      console.log(`[ZORP] Player ${kickedPlayer} was kicked from team ${teamId} - keeping their Zorp zone intact, updating team tracking`);
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
          
          // Zorp zones are individual player zones, not team zones
          // Do NOT delete zones when teams are disbanded, but update team tracking for state management
          console.log(`[ZORP] Player ${player} removed from disbanded team ${teamId} - keeping their Zorp zone intact, updating team tracking`);
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

// Enhanced function to delete all Zorp zones for a player across all servers
async function deleteAllZorpZonesForPlayer(playerName) {
  try {
    console.log(`[ZORP] Deleting ALL zones for ${playerName} across all servers...`);
    
    // Get all active zones for this player across all servers
    const [zones] = await pool.query(`
      SELECT z.*, rs.nickname, rs.ip, rs.port, rs.password, g.discord_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.owner = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [playerName]);
    
    if (zones.length === 0) {
      console.log(`[ZORP] No active zones found for ${playerName} across any servers`);
      return;
    }
    
    console.log(`[ZORP] Found ${zones.length} zones to delete for ${playerName}`);
    
    for (const zone of zones) {
      try {
        console.log(`[ZORP] Deleting zone ${zone.name} for ${playerName} on server ${zone.nickname}...`);
        
        // Clear any transition timers
        clearZorpTransitionTimer(zone.name);
        
        // Delete from game if server is available
        if (zone.ip && zone.port && zone.password) {
          try {
            await sendRconCommand(zone.ip, zone.port, zone.password, `zones.deletecustomzone "${zone.name}"`);
            console.log(`[ZORP] Successfully deleted zone ${zone.name} from game on ${zone.nickname}`);
          } catch (rconError) {
            console.error(`[ZORP] Failed to delete zone ${zone.name} from game on ${zone.nickname}:`, rconError);
            // Continue with database deletion even if RCON fails
          }
        }
        
        // Delete from database
        await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
        console.log(`[ZORP] Deleted zone ${zone.name} from database`);
        
        // Clean up in-memory state
        zorpZoneStates.delete(zone.name);
        
        // Send notification in-game if possible
        if (zone.ip && zone.port && zone.password) {
          try {
            await sendRconCommand(zone.ip, zone.port, zone.password, 
              `say <color=#FF69B4>[ZORP]</color> <color=white>${playerName}'s Zorp was deleted due to team changes</color>`);
          } catch (msgError) {
            console.error(`[ZORP] Failed to send zone deletion message:`, msgError);
          }
        }
        
      } catch (deleteError) {
        console.error(`[ZORP] Error deleting zone ${zone.name} for ${playerName}:`, deleteError);
      }
    }
    
    console.log(`[ZORP] Successfully processed zone deletion for ${playerName} (${zones.length} zones)`);
    
  } catch (error) {
    console.error(`[ZORP] Error in deleteAllZorpZonesForPlayer for ${playerName}:`, error);
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
    console.log(`[ZORP TEAM DEBUG] ===== CHECKING TEAM OFFLINE STATUS FOR ${playerName} =====`);
    console.log(`[ZORP TEAM DEBUG] Checking if all team members are offline for: ${playerName}`);
    
    // Get player's team info
    const teamInfo = await getPlayerTeam(ip, port, password, playerName);
    
    if (!teamInfo) {
      console.log(`[ZORP TEAM DEBUG] No team found for ${playerName} - considering as all offline`);
      return true; // No team = consider as "all offline"
    }
    
    console.log(`[ZORP TEAM DEBUG] Team info for ${playerName}:`, teamInfo);
    console.log(`[ZORP TEAM DEBUG] Team members: ${teamInfo.members.join(', ')}`);
    
    // Get online players with retry mechanism for high-population servers
    let onlinePlayers = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!onlinePlayers && retryCount < maxRetries) {
      try {
        onlinePlayers = await getOnlinePlayers(ip, port, password);
        if (!onlinePlayers) {
          console.log(`[ZORP DEBUG] Attempt ${retryCount + 1}: Could not get online players list, retrying...`);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          }
        }
      } catch (error) {
        console.log(`[ZORP DEBUG] Attempt ${retryCount + 1}: Error getting online players, retrying...`);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    }
    
    if (!onlinePlayers) {
      console.log(`[ZORP TEAM DEBUG] Could not get online players list after ${maxRetries} attempts - assuming someone is online`);
      return false; // Assume someone is online if we can't check after retries
    }
    
    console.log(`[ZORP TEAM DEBUG] Online players count: ${onlinePlayers.size}`);
    console.log(`[ZORP TEAM DEBUG] Online players: ${Array.from(onlinePlayers).join(', ')}`);
    
    // Check if any team member is online
    let onlineCount = 0;
    for (const member of teamInfo.members) {
      if (onlinePlayers.has(member)) {
        console.log(`[ZORP TEAM DEBUG] Team member ${member} is ONLINE`);
        onlineCount++;
      } else {
        console.log(`[ZORP TEAM DEBUG] Team member ${member} is OFFLINE`);
      }
    }
    
    if (onlineCount > 0) {
      console.log(`[ZORP TEAM DEBUG] ${onlineCount} team members are online for ${playerName}'s team - NOT all offline`);
      return false; // At least one team member is online
    }
    
    console.log(`[ZORP TEAM DEBUG] All team members are offline for ${playerName} - ALL OFFLINE`);
    console.log(`[ZORP TEAM DEBUG] ===== COMPLETED TEAM OFFLINE CHECK FOR ${playerName} =====`);
    return true; // All team members are offline
  } catch (error) {
    console.error('Error checking team offline status:', error);
    console.log(`[ZORP TEAM DEBUG] ===== ERROR IN TEAM OFFLINE CHECK FOR ${playerName} =====`);
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

// Track current message pair index for each server
const currentMessagePairIndex = new Map();

async function displayScheduledMessages(client) {
  try {
    // Get all servers with their message pairs
    const [servers] = await pool.query(
      `SELECT DISTINCT rs.id, rs.nickname, rs.ip, rs.port, rs.password 
       FROM rust_servers rs 
       INNER JOIN scheduler_messages sm ON rs.id = sm.server_id`
    );

    for (const server of servers) {
      try {
        // Get all message pairs for this server
        const [messages] = await pool.query(
          'SELECT id, pair_number, message1, message2 FROM scheduler_messages WHERE server_id = ? ORDER BY pair_number ASC',
          [server.id]
        );

        if (messages.length > 0) {
          // Get current pair number for this server
          const currentPairNumber = currentMessagePairIndex.get(server.id) || 1;
          
          // Find the message pair with the current pair number
          const messagePair = messages.find(m => m.pair_number === currentPairNumber);
          
          if (messagePair && messagePair.message1 && messagePair.message2) {
            try {
              // Send first message
              console.log(`📢 [SCHEDULER] Sending message 1 to ${server.nickname}: ${messagePair.message1.substring(0, 50)}...`);
              await sendRconCommand(server.ip, server.port, server.password, `say ${messagePair.message1}`);
              
              // Wait 5 seconds to respect server cooldown
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // Send second message
              console.log(`📢 [SCHEDULER] Sending message 2 to ${server.nickname}: ${messagePair.message2.substring(0, 50)}...`);
              await sendRconCommand(server.ip, server.port, server.password, `say ${messagePair.message2}`);
              
              console.log(`📢 [SCHEDULER] Successfully sent message pair ${messagePair.pair_number} to ${server.nickname}`);
            } catch (error) {
              console.error(`❌ [SCHEDULER] Failed to send message pair ${messagePair.pair_number} to ${server.nickname}:`, error.message);
            }
          }
          
          // Move to next pair number - if only one pair exists, cycle back to it immediately
          let nextPairNumber;
          if (messages.length === 1) {
            // If only one pair exists, always send that pair
            nextPairNumber = messages[0].pair_number;
          } else {
            // Cycle through available pairs
            const availablePairs = messages.map(m => m.pair_number).sort((a, b) => a - b);
            const currentIndex = availablePairs.indexOf(currentPairNumber);
            const nextIndex = (currentIndex + 1) % availablePairs.length;
            nextPairNumber = availablePairs[nextIndex];
          }
          
          currentMessagePairIndex.set(server.id, nextPairNumber);
        }
      } catch (error) {
        console.error(`❌ [SCHEDULER] Failed to send messages to ${server.nickname}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ [SCHEDULER] Error displaying scheduled messages:', error);
  }
}

// Home Teleport Functions

async function handleSetHome(client, guildId, serverName, parsed, ip, port, password) {
  try {
    console.log(`[HOME TELEPORT DEBUG] Raw message: ${parsed.Message}`);
    const player = extractPlayerName(parsed.Message);
    console.log(`[HOME TELEPORT DEBUG] Extracted player: ${player}`);
    if (!player) {
      console.log(`[HOME TELEPORT DEBUG] No player extracted, returning`);
      return;
    }

    console.log(`[HOME TELEPORT DEBUG] Set home requested: ${player} on ${serverName}`);

    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );

    if (serverResult.length === 0) {
      Logger.warn(`No server found for ${serverName} in guild ${guildId}`);
      return;
    }

    const serverId = serverResult[0].id;

    // Check home teleport configuration
    const [configResult] = await pool.query(
      'SELECT use_list, cooldown_minutes FROM home_teleport_configs WHERE server_id = ?',
      [serverId]
    );

    let config = {
      use_list: false,
      cooldown_minutes: 5
    };

    if (configResult.length > 0) {
      config = {
        use_list: configResult[0].use_list !== 0,
        cooldown_minutes: configResult[0].cooldown_minutes || 5
      };
    }

    // Check if player is banned from home teleport
    const [bannedResult] = await pool.query(
      'SELECT * FROM home_teleport_banned_users WHERE server_id = ? AND (discord_id = (SELECT discord_id FROM players WHERE ign = ? AND server_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)) OR ign = ?)',
      [serverId, player, serverId, guildId, player]
    );

    if (bannedResult.length > 0) {
      // Player is banned - don't show any message, just return silently
      console.log(`[HOME TELEPORT] Player ${player} is banned from home teleport on ${serverName}`);
      return;
    }

    // Check allowed list if enabled
    if (config.use_list) {
      const [allowedResult] = await pool.query(
        'SELECT * FROM home_teleport_allowed_users WHERE server_id = ? AND (discord_id = (SELECT discord_id FROM players WHERE ign = ? AND server_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)) OR ign = ?)',
        [serverId, player, serverId, guildId, player]
      );

      if (allowedResult.length === 0) {
        // Player not in allowed list - don't show any message, just return silently
        console.log(`[HOME TELEPORT] Player ${player} not in allowed list for home teleport on ${serverName}`);
        return;
      }
    }

    // Check cooldown
    const cooldownKey = `${serverId}_${player}`;
    const now = Date.now();
    const lastTeleport = homeTeleportCooldowns.get(cooldownKey) || 0;
    const cooldownMs = config.cooldown_minutes * 60 * 1000;

    if (now - lastTeleport < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - (now - lastTeleport)) / (60 * 1000));
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>please wait</color> <color=#800080>${remainingMinutes} minutes</color> <color=white>before setting home again</color>`);
      return;
    }

    // Set state to waiting for respawn (use same format as Book-a-Ride)
    const stateKey = `${guildId}:${serverName}:${player}`;
    console.log(`[HOME TELEPORT] Setting state key: ${stateKey}`);
    console.log(`[HOME TELEPORT] Guild ID: ${guildId}, Server Name: ${serverName}, Player: ${player}`);
    console.log(`[HOME TELEPORT DEBUG] Server result:`, serverResult);
    
    homeTeleportState.set(stateKey, {
      player: player,
      step: 'waiting_for_respawn',
      timestamp: now,
      guildId: guildId,
      serverName: serverName,
      ip: ip,
      port: port,
      password: password
    });
    
    console.log(`[HOME TELEPORT] State set successfully. Total states: ${homeTeleportState.size}`);

    // Kill the player instantly - use correct Rust command format
    sendRconCommand(ip, port, password, `global.killplayer "${player}"`);
    
    // Set timeout to clean up state after 30 seconds
    setTimeout(() => {
      const currentState = homeTeleportState.get(stateKey);
      if (currentState && currentState.step === 'waiting_for_respawn') {
      homeTeleportState.delete(stateKey);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>home teleport setup timed out. Please try again.</color>`);
        Logger.info(`Home teleport setup timed out for ${player}`);
      }
    }, 30000); // 30 seconds timeout

    Logger.info(`Set home: killed ${player} to trigger respawn`);

  } catch (error) {
    Logger.error('Error handling set home:', error);
  }
}

// handleHomeChoice function removed - no longer using yes/no confirmation for home teleport

async function handleTeleportHome(client, guildId, serverName, parsed, ip, port, password) {
  try {
    const player = extractPlayerName(parsed.Message);
    if (!player) return;

    Logger.info(`Teleport home requested: ${player} on ${serverName}`);

    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );

    if (serverResult.length === 0) {
      Logger.warn(`No server found for ${serverName} in guild ${guildId}`);
      return;
    }

    const serverId = serverResult[0].id;

    // Check home teleport configuration
    const [configResult] = await pool.query(
      'SELECT use_list, cooldown_minutes FROM home_teleport_configs WHERE server_id = ?',
      [serverId]
    );

    let config = {
      use_list: false,
      cooldown_minutes: 5
    };

    if (configResult.length > 0) {
      config = {
        use_list: configResult[0].use_list !== 0,
        cooldown_minutes: configResult[0].cooldown_minutes || 5
      };
    }

    // Check if player is banned from home teleport
    const [bannedResult] = await pool.query(
      'SELECT * FROM home_teleport_banned_users WHERE server_id = ? AND (discord_id = (SELECT discord_id FROM players WHERE ign = ? AND server_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)) OR ign = ?)',
      [serverId, player, serverId, guildId, player]
    );

    if (bannedResult.length > 0) {
      // Player is banned - don't show any message, just return silently
      console.log(`[HOME TELEPORT] Player ${player} is banned from home teleport on ${serverName}`);
      return;
    }

    // Check allowed list if enabled
    if (config.use_list) {
      const [allowedResult] = await pool.query(
        'SELECT * FROM home_teleport_allowed_users WHERE server_id = ? AND (discord_id = (SELECT discord_id FROM players WHERE ign = ? AND server_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)) OR ign = ?)',
        [serverId, player, serverId, guildId, player]
      );

      if (allowedResult.length === 0) {
        // Player not in allowed list - don't show any message, just return silently
        console.log(`[HOME TELEPORT] Player ${player} not in allowed list for home teleport on ${serverName}`);
        return;
      }
    }

    // Check cooldown
    const cooldownKey = `${serverId}_${player}`;
    const now = Date.now();
    const lastTeleport = homeTeleportCooldowns.get(cooldownKey) || 0;
    const cooldownMs = config.cooldown_minutes * 60 * 1000;

    if (now - lastTeleport < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - (now - lastTeleport)) / (60 * 1000));
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>please wait</color> <color=#800080>${remainingMinutes} minutes</color> <color=white>before teleporting home again</color>`);
      return;
    }

    // Get player's home location
    console.log(`[HOME TELEPORT DEBUG] Looking for home for player: ${player}, serverId: ${serverId}, guildId: ${guildId}`);
    const [homeResult] = await pool.query(
      'SELECT x_pos, y_pos, z_pos FROM player_homes WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND player_name = ?',
      [guildId, serverId, player]
    );

    console.log(`[HOME TELEPORT DEBUG] Home query result:`, homeResult);

    if (homeResult.length === 0) {
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you don't have a home set. Use the building emote to set your home first.</color>`);
      return;
    }

    const home = homeResult[0];

    // Teleport player to home
    sendRconCommand(ip, port, password, `global.teleportposrot "${home.x_pos},${home.y_pos},${home.z_pos}" "${player}" "1"`);
    
    // Send success message
    sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleported home successfully!</color>`);

    // Update cooldown
    homeTeleportCooldowns.set(cooldownKey, now);

    // Send to admin feed
    await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🏠 **Home Teleport:** ${player} teleported to their home`);

    Logger.info(`Home teleport completed: ${player} → home`);

  } catch (error) {
    Logger.error('Error handling teleport home:', error);
  }
}

async function handleBotKillRespawn(client, guildId, serverName, player, ip, port, password) {
  try {
    console.log(`[BOT KILL] Checking respawn for bot kill tracking: ${player}`);
    
    // Check if this player was killed by the bot within the last 20 seconds
    const killKey = `${guildId}_${serverName}_${player}`;
    const killData = botKillTracking.get(killKey);
    
    if (!killData) {
      console.log(`[BOT KILL] No bot kill tracking found for ${player}`);
      return;
    }
    
    // Check if the respawn is within 20 seconds of the kill
    const timeSinceKill = Date.now() - killData.killTime;
    if (timeSinceKill > 20000) { // 20 seconds
      console.log(`[BOT KILL] Respawn too late for ${player} (${Math.round(timeSinceKill / 1000)}s after kill)`);
      botKillTracking.delete(killKey);
      return;
    }
    
    console.log(`[BOT KILL] Success! ${player} respawned within ${Math.round(timeSinceKill / 1000)}s of bot kill`);
    
    // Send success message in-game
    await sendRconCommand(ip, port, password, `say <color=#00FF00><b>SUCCESS!</b></color> <color=white>${player} has respawned after being killed by SCARLETT!</color>`);
    
    // Remove tracking for this player
    botKillTracking.delete(killKey);
    
    console.log(`[BOT KILL] Bot kill respawn tracking completed for ${player}`);
    
  } catch (error) {
    console.error('[BOT KILL] Error handling bot kill respawn:', error);
  }
}

async function handleHomeTeleportRespawn(client, guildId, serverName, player, ip, port, password) {
  try {
    console.log(`[HOME TELEPORT] Checking respawn for home teleport setup: ${player}`);
    console.log(`[HOME TELEPORT] Guild ID: ${guildId}, Server Name: ${serverName}`);
    
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );

    if (serverResult.length === 0) {
      console.log(`[HOME TELEPORT] No server found for ${serverName}`);
      return;
    }

    const serverId = serverResult[0].id;
    const stateKey = `${guildId}:${serverName}:${player}`;
    const playerState = homeTeleportState.get(stateKey);

    console.log(`[HOME TELEPORT] Guild ID: ${guildId}, Server Name: ${serverName}, State Key: ${stateKey}`);
    console.log(`[HOME TELEPORT] Player State:`, playerState);
    console.log(`[HOME TELEPORT DEBUG] All available states:`, Array.from(homeTeleportState.entries()));

    if (!playerState || playerState.step !== 'waiting_for_respawn') {
      console.log(`[HOME TELEPORT] No home teleport setup in progress for ${player}`);
      console.log(`[HOME TELEPORT] Available states:`, Array.from(homeTeleportState.keys()));
      return;
    }

    // Check if we've already processed a respawn for this player (prevent duplicate processing)
    if (playerState.respawnProcessed) {
      console.log(`[HOME TELEPORT] Respawn already processed for ${player}, skipping`);
      return;
    }

    console.log(`[HOME TELEPORT] Respawn detected for home teleport setup: ${player}`);

    // Mark respawn as processed to prevent duplicate handling
    playerState.respawnProcessed = true;
    
    // Update state to waiting for position
    playerState.step = 'waiting_for_position';
    homeTeleportState.set(stateKey, playerState);

    // Get player position after respawn
    console.log(`[HOME TELEPORT DEBUG] Sending printpos command for ${player}`);
    sendRconCommand(ip, port, password, `printpos "${player}"`);
    
    // Set timeout to clean up position waiting state after 30 seconds
    setTimeout(() => {
      const currentState = homeTeleportState.get(stateKey);
      console.log(`[HOME TELEPORT DEBUG] Timeout check for ${player}, current state:`, currentState);
      if (currentState && currentState.step === 'waiting_for_position') {
        console.log(`[HOME TELEPORT DEBUG] Position timeout reached for ${player}, cleaning up state`);
        homeTeleportState.delete(stateKey);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>home teleport setup timed out. Please try again.</color>`);
        Logger.info(`Home teleport position setup timed out for ${player}`);
      } else {
        console.log(`[HOME TELEPORT DEBUG] No timeout needed for ${player}, state already processed or cleared`);
      }
    }, 30000); // 30 seconds timeout

    Logger.info(`Home teleport: respawn detected for ${player}, getting position`);

  } catch (error) {
    Logger.error('Error handling home teleport respawn:', error);
  }
}



// Playtime tracking functions
async function handlePlaytimeOnline(guildId, serverName, playerName) {
  try {
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) return;
    const serverId = serverResult[0].id;

    // Check if playtime rewards are enabled for this server
    const [configResult] = await pool.query(
      'SELECT enabled FROM playtime_rewards_config WHERE server_id = ? AND enabled = true',
      [serverId]
    );
    
    if (configResult.length === 0) return; // Not enabled

    // Get player ID
    const [playerResult] = await pool.query(
      `SELECT id FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND server_id = ? 
       AND LOWER(ign) = LOWER(?) 
       AND is_active = true`,
      [guildId, serverId, playerName]
    );
    
    if (playerResult.length === 0) return; // Player not linked
    const playerId = playerResult[0].id;

    // Start or update playtime session
    await pool.query(
      `INSERT INTO player_playtime (player_id, session_start, last_online) 
       VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE 
         session_start = CURRENT_TIMESTAMP,
         last_online = CURRENT_TIMESTAMP`,
      [playerId]
    );

    console.log(`[PLAYTIME] Started tracking for ${playerName} on ${serverName}`);

  } catch (error) {
    console.error('Error handling playtime online:', error);
  }
}

async function handlePlaytimeOffline(guildId, serverName, playerName) {
  try {
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) return;
    const serverId = serverResult[0].id;

    // Check if playtime rewards are enabled for this server
    const [configResult] = await pool.query(
      'SELECT enabled, amount_per_30min FROM playtime_rewards_config WHERE server_id = ? AND enabled = true',
      [serverId]
    );
    
    if (configResult.length === 0) return; // Not enabled
    const rewardAmount = configResult[0].amount_per_30min;

    // Get player ID
    const [playerResult] = await pool.query(
      `SELECT id FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND server_id = ? 
       AND LOWER(ign) = LOWER(?) 
       AND is_active = true`,
      [guildId, serverId, playerName]
    );
    
    if (playerResult.length === 0) return; // Player not linked
    const playerId = playerResult[0].id;

    // Get current playtime session
    const [sessionResult] = await pool.query(
      'SELECT session_start, total_minutes, last_reward FROM player_playtime WHERE player_id = ?',
      [playerId]
    );
    
    if (sessionResult.length === 0 || !sessionResult[0].session_start) return;
    
    const session = sessionResult[0];
    const sessionStart = new Date(session.session_start);
    const sessionEnd = new Date();
    const sessionMinutes = Math.floor((sessionEnd - sessionStart) / (1000 * 60));
    
    if (sessionMinutes < 1) return; // Too short session
    
    // Update total playtime
    const newTotalMinutes = (session.total_minutes || 0) + sessionMinutes;
    
    // Calculate rewards (every 30 minutes)
    const lastReward = session.last_reward ? new Date(session.last_reward) : sessionStart;
    const totalPlaytimeSinceLastReward = Math.floor((sessionEnd - lastReward) / (1000 * 60));
    const rewardCycles = Math.floor(totalPlaytimeSinceLastReward / 30);
    
    let totalReward = 0;
    if (rewardCycles > 0 && rewardAmount > 0) {
      totalReward = rewardCycles * rewardAmount;
      
      // Give reward to player
      await pool.query(
        'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
        [totalReward, playerId]
      );
      
      // Update last reward time
      await pool.query(
        `UPDATE player_playtime 
         SET total_minutes = ?, 
             session_start = NULL, 
             last_reward = CURRENT_TIMESTAMP 
         WHERE player_id = ?`,
        [newTotalMinutes, playerId]
      );
      
      console.log(`[PLAYTIME] Rewarded ${playerName} ${totalReward} coins for ${rewardCycles * 30} minutes of playtime`);
    } else {
      // Update playtime without reward
      await pool.query(
        `UPDATE player_playtime 
         SET total_minutes = ?, 
             session_start = NULL 
         WHERE player_id = ?`,
        [newTotalMinutes, playerId]
      );
      
      console.log(`[PLAYTIME] Updated ${playerName} playtime: +${sessionMinutes} minutes (total: ${newTotalMinutes})`);
    }

  } catch (error) {
    console.error('Error handling playtime offline:', error);
  }
}

// Periodic playtime reward checker (for active players)
setInterval(async () => {
  try {
    // Check all active sessions that have been online for 30+ minutes since last reward
    const [activeSessions] = await pool.query(
      `SELECT pt.*, p.ign, rs.nickname as server_name, rs.guild_id, g.discord_id, prc.amount_per_30min
       FROM player_playtime pt
       JOIN players p ON pt.player_id = p.id
       JOIN rust_servers rs ON p.server_id = rs.id
       JOIN guilds g ON rs.guild_id = g.id
       JOIN playtime_rewards_config prc ON rs.id = prc.server_id
       WHERE pt.session_start IS NOT NULL
       AND prc.enabled = true
       AND prc.amount_per_30min > 0
       AND TIMESTAMPDIFF(MINUTE, pt.last_reward, CURRENT_TIMESTAMP) >= 30`
    );

    for (const session of activeSessions) {
      const minutesSinceLastReward = Math.floor((new Date() - new Date(session.last_reward)) / (1000 * 60));
      const rewardCycles = Math.floor(minutesSinceLastReward / 30);
      
      if (rewardCycles > 0) {
        const totalReward = rewardCycles * session.amount_per_30min;
        
        // Give reward
        await pool.query(
          'UPDATE economy SET balance = balance + ? WHERE player_id = ?',
          [totalReward, session.player_id]
        );
        
        // Update last reward time
        await pool.query(
          'UPDATE player_playtime SET last_reward = CURRENT_TIMESTAMP WHERE player_id = ?',
          [session.player_id]
        );
        
        console.log(`[PLAYTIME] Periodic reward: ${session.ign} received ${totalReward} coins for ${rewardCycles * 30} minutes`);
      }
    }
  } catch (error) {
    console.error('Error in periodic playtime rewards:', error);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Complete vehicle purchase transaction
async function completeVehiclePurchase(vehicleRequest) {
  try {
    const { playerId, userId, price, interaction } = vehicleRequest;

    console.log(`[VEHICLE PURCHASE] Starting transaction for ${vehicleRequest.playerIgn}: ${vehicleRequest.displayName}`);

    // Deduct balance from player's account
    await pool.query(
      'UPDATE economy SET balance = balance - ? WHERE player_id = ?',
      [price, playerId]
    );

    console.log(`[VEHICLE PURCHASE] Balance deducted: ${price} coins from player ${playerId}`);

    // Record the transaction
    await pool.query(
      'INSERT INTO transactions (player_id, amount, type, guild_id) VALUES (?, ?, ?, (SELECT guild_id FROM players WHERE id = ?))',
      [playerId, -price, 'vehicle_purchase', playerId]
    );

    console.log(`[VEHICLE PURCHASE] Transaction recorded`);

    // Record cooldown if timer exists
    if (vehicleRequest.timer && vehicleRequest.timer > 0) {
      await pool.query(
        'INSERT INTO shop_vehicle_cooldowns (player_id, vehicle_id, purchased_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [playerId, vehicleRequest.vehicleId]
      );
      console.log(`[VEHICLE PURCHASE] Cooldown recorded: ${vehicleRequest.timer} minutes`);
    }

    // Send success message to Discord
    try {
      const { successEmbed } = require('../embeds/format');
      const embed = successEmbed(
        '🚗 Vehicle Purchased!',
        `**Vehicle:** ${vehicleRequest.displayName}\n**Price:** ${price} coins\n**Server:** ${vehicleRequest.nickname}\n\nYour vehicle has been spawned at your location!`
      );

      await interaction.editReply({
        embeds: [embed],
        components: []
      });

      console.log(`[VEHICLE PURCHASE] Success message sent to Discord`);
    } catch (discordError) {
      console.error('[VEHICLE PURCHASE] Error sending Discord message:', discordError);
      // Don't fail the entire transaction if Discord message fails
    }

    console.log(`[VEHICLE PURCHASE] Transaction completed successfully for ${vehicleRequest.playerIgn}: ${vehicleRequest.displayName}`);

  } catch (error) {
    console.error('[VEHICLE PURCHASE] Error completing vehicle purchase:', error);
    
    // Try to send error message to Discord
    try {
      const { errorEmbed } = require('../embeds/format');
      const embed = errorEmbed(
        'Purchase Error',
        'There was an error processing your vehicle purchase. Please contact an administrator.'
      );

      if (vehicleRequest.interaction && typeof vehicleRequest.interaction.editReply === 'function') {
        await vehicleRequest.interaction.editReply({
          embeds: [embed],
          components: []
        });
      }
    } catch (discordError) {
      console.error('[VEHICLE PURCHASE] Error sending error message to Discord:', discordError);
    }
  }
}

// Teleport System Handler
async function handleTeleportSystem(client, guildId, serverName, serverId, ip, port, password, player, teleportName = 'default') {
  try {
    console.log(`[TELEPORT] Processing teleport for ${player} to teleport location: ${teleportName}`);
    
    // Get teleport configuration
    const configResult = await pool.query(
      'SELECT enabled, cooldown_minutes, delay_minutes, display_name, use_list, use_delay, use_kit, kit_name, position_x, position_y, position_z FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
      [serverId.toString(), teleportName]
    );

    console.log(`[TELEPORT DEBUG] Query result length: ${configResult[0].length}`);
    console.log(`[TELEPORT DEBUG] Looking for teleport_name: ${teleportName} on server_id: ${serverId}`);

    if (configResult[0].length === 0) {
      console.log(`[TELEPORT] No teleport config found for ${teleportName}`);
      sendRconCommand(ip, port, password, `say <color=#FF0000>${player}</color> <color=white>teleport system not configured for ${teleportName.toUpperCase()}</color>`);
      return;
    }

    const config = configResult[0][0];
    console.log(`[TELEPORT] Config found for ${teleportName}:`, {
      enabled: config.enabled,
      cooldown: config.cooldown_minutes,
      delay: config.delay_minutes,
      display_name: config.display_name,
      use_list: config.use_list,
      use_kit: config.use_kit,
      kit_name: config.kit_name,
      position: `${config.position_x}, ${config.position_y}, ${config.position_z}`
    });
    
    console.log(`[TELEPORT DEBUG] Raw config values from database:`, {
      use_kit: config.use_kit,
      kit_name: config.kit_name,
      use_kit_type: typeof config.use_kit,
      kit_name_type: typeof config.kit_name
    });
    
    // Debug: Log the exact query being used
    console.log(`[TELEPORT DEBUG] Query used: SELECT * FROM teleport_configs WHERE server_id = '${serverId.toString()}' AND teleport_name = '${teleportName}'`);
    
    // Check if enabled
    if (!Boolean(config.enabled)) {
      console.log(`[TELEPORT] Teleport is DISABLED`);
      sendRconCommand(ip, port, password, `say <color=#FF0000>${player}</color> <color=white>${teleportName.toUpperCase()} teleport is currently disabled</color>`);
      return;
    }

    // Get player info for Discord ID
    const playerResult = await pool.query(
      'SELECT discord_id FROM players WHERE ign = ? AND server_id = ?',
      [player, serverId.toString()]
    );

    if (playerResult[0].length === 0) {
      console.log(`[TELEPORT] Player ${player} not found in database`);
      sendRconCommand(ip, port, password, `say <color=#FF0000>${player}</color> <color=white>you are not linked to Discord. Please use /link first</color>`);
      return;
    }

    const playerData = playerResult[0][0];
    const discordId = playerData.discord_id;

    // Check if player is banned (if use_list is enabled)
    if (Boolean(config.use_list)) {
      console.log(`[TELEPORT DEBUG] Checking ban list for ${player} on ${teleportName}`);
      
      const bannedResult = await pool.query(
        'SELECT * FROM teleport_banned_users WHERE server_id = ? AND teleport_name = ? AND (discord_id = ? OR ign = ?)',
        [serverId.toString(), teleportName, discordId, player]
      );

      if (bannedResult[0].length > 0) {
        console.log(`[TELEPORT] Player ${player} is banned from ${teleportName}`);
        sendRconCommand(ip, port, password, `say <color=#FF0000>${player}</color> <color=white>you are banned from using ${teleportName.toUpperCase()} teleport</color>`);
        return;
      }

      // Check if player is allowed
      const allowedResult = await pool.query(
        'SELECT * FROM teleport_allowed_users WHERE server_id = ? AND teleport_name = ? AND (discord_id = ? OR ign = ?)',
        [serverId.toString(), teleportName, discordId, player]
      );

      if (allowedResult[0].length === 0) {
        console.log(`[TELEPORT] Player ${player} not allowed for ${teleportName}`);
        sendRconCommand(ip, port, password, `say <color=#FF0000>${player}</color> <color=white>you are not allowed to use ${teleportName.toUpperCase()} teleport</color>`);
        return;
      }
    }

    // Check cooldown using in-memory tracking for better performance
    const cooldownKey = `${serverId}_${teleportName}_${discordId}`;
    const now = Date.now();
    const lastTeleport = teleportCooldowns.get(cooldownKey) || 0;
    const cooldownMs = config.cooldown_minutes * 60 * 1000;

    if (now - lastTeleport < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - (now - lastTeleport)) / (60 * 1000));
      console.log(`[TELEPORT] Cooldown active: ${remainingMinutes} minutes remaining`);
      sendRconCommand(ip, port, password, `say <color=#FF0000>${player}</color> <color=white>teleport cooldown:</color> <color=#FFD700>${remainingMinutes} minutes</color> <color=white>remaining</color>`);
      return;
    }

    console.log(`[TELEPORT] Proceeding with teleport for ${player} to ${teleportName}`);

    const displayName = config.display_name || `${teleportName.toUpperCase()} Teleport`;

    // If there's a delay, show countdown
    if (config.delay_minutes > 0) {
      sendRconCommand(ip, port, password, `say <color=#00FF00>${player}</color> <color=white>teleporting to</color> <color=#FFD700>${displayName}</color> <color=white>in</color> <color=#FFD700>${config.delay_minutes} minutes</color>`);
      
      // Wait for delay
      setTimeout(async () => {
        await executeTeleport(ip, port, password, player, config, displayName, teleportName, guildId, serverName, cooldownKey);
      }, config.delay_minutes * 60 * 1000);
    } else {
      // Execute teleport immediately
      await executeTeleport(ip, port, password, player, config, displayName, teleportName, guildId, serverName, cooldownKey);
    }

  } catch (error) {
    console.error('[TELEPORT] Error in handleTeleportSystem:', error);
    sendRconCommand(ip, port, password, `say <color=#FF0000>${player}</color> <color=white>an error occurred while processing teleport</color>`);
  }
}

async function executeTeleport(ip, port, password, player, config, displayName, teleportName, guildId, serverName, cooldownKey) {
  try {
    console.log(`[TELEPORT DEBUG] executeTeleport called for ${player} with config:`, {
      use_kit: config.use_kit,
      kit_name: config.kit_name,
      position: `${config.position_x}, ${config.position_y}, ${config.position_z}`
    });

          // Teleport immediately
      await performTeleport(ip, port, password, player, config, displayName, cooldownKey);

  } catch (error) {
    console.error('[TELEPORT] Error executing teleport:', error);
  }
}

async function performTeleport(ip, port, password, player, config, displayName, cooldownKey) {
  try {
    console.log(`[TELEPORT] Performing teleport for ${player}`);
    console.log(`[TELEPORT DEBUG] Config being used:`, {
      position: `${config.position_x}, ${config.position_y}, ${config.position_z}`,
      use_kit: config.use_kit,
      kit_name: config.kit_name,
      display_name: config.display_name
    });

    // Execute teleport
    const teleportCommand = `global.teleportposrot "${config.position_x},${config.position_y},${config.position_z}" "${player}" "1"`;
    sendRconCommand(ip, port, password, teleportCommand);
    console.log(`[TELEPORT] Executed teleport command: ${teleportCommand}`);

    // Give kit if enabled
    console.log(`[TELEPORT DEBUG] Kit check - use_kit: ${config.use_kit} (type: ${typeof config.use_kit}), kit_name: ${config.kit_name} (type: ${typeof config.kit_name})`);
    
    // Convert numeric values to boolean (MySQL stores booleans as 0/1)
    const useKit = Boolean(config.use_kit);
    console.log(`[TELEPORT DEBUG] Converted use_kit to boolean: ${useKit}`);
    
    if (useKit && config.kit_name) {
      const kitCommand = `kit givetoplayer ${config.kit_name} ${player}`;
      sendRconCommand(ip, port, password, kitCommand);
      console.log(`[TELEPORT] Executed kit command: ${kitCommand}`);
    } else {
      console.log(`[TELEPORT DEBUG] Kit not given - use_kit: ${config.use_kit}, kit_name: ${config.kit_name}`);
      if (!useKit) console.log(`[TELEPORT DEBUG] Reason: use_kit is false/0`);
      if (!config.kit_name) console.log(`[TELEPORT DEBUG] Reason: kit_name is empty/null`);
    }

    // Send success message
    sendRconCommand(ip, port, password, `say <color=#00FF00>${player}</color> <color=white>teleported to</color> <color=#FFD700>${displayName}</color>`);
    console.log(`[TELEPORT] Successfully teleported ${player} to ${displayName}`);

    // Set cooldown only after successful teleport
    if (cooldownKey) {
      teleportCooldowns.set(cooldownKey, Date.now());
      console.log(`[TELEPORT] Cooldown set for ${player}: ${cooldownKey}`);
    }

  } catch (error) {
    console.error('[TELEPORT] Error performing teleport:', error);
  }
}

// Event detection function
async function checkEventGibs(client, guildId, serverName, serverId, ip, port, password) {
  try {
    // Get event configuration
    const [bradleyConfig] = await pool.query(
      'SELECT enabled, kill_message, respawn_message FROM event_configs WHERE server_id = ? AND event_type = ?',
      [serverId.toString(), 'bradley']
    );

    const [helicopterConfig] = await pool.query(
      'SELECT enabled, kill_message, respawn_message FROM event_configs WHERE server_id = ? AND event_type = ?',
      [serverId.toString(), 'helicopter']
    );

    // Check Bradley gibs
    if (bradleyConfig.length > 0 && bradleyConfig[0].enabled) {
      const bradleyResult = await sendRconCommand(ip, port, password, 'find_entity servergibs_bradley');
      
      if (bradleyResult && bradleyResult.includes('servergibs_bradley')) {
        const stateKey = `${serverId}_bradley`;
        const currentState = serverEventStates.get(stateKey);
        
        // Only send message if this is the FIRST time we detect debris (no active state)
        if (!currentState || !currentState.hasGibs) {
          serverEventStates.set(stateKey, { hasGibs: true, timestamp: Date.now() });
          
          // Send kill message ONLY ONCE when debris is first detected
          if (bradleyConfig[0].kill_message) {
            console.log(`[EVENT] Bradley event detected on ${serverName}, sending message: ${bradleyConfig[0].kill_message}`);
            await sendRconCommand(ip, port, password, `say ${bradleyConfig[0].kill_message}`);
          }
          
          // Send to Discord feed ONLY ONCE
          await sendFeedEmbed(client, guildId, serverName, 'eventfeed', `🎯 **Bradley APC Event Started!**\n${bradleyConfig[0].kill_message}`);
          
          // Set timeout to clear state after 15 minutes
          setTimeout(() => {
            const currentState = serverEventStates.get(stateKey);
            if (currentState && currentState.hasGibs) {
              currentState.hasGibs = false;
              serverEventStates.set(stateKey, currentState);
              
              // Send respawn message
              if (bradleyConfig[0].respawn_message) {
                console.log(`[EVENT] Bradley respawned on ${serverName}, sending message: ${bradleyConfig[0].respawn_message}`);
                sendRconCommand(ip, port, password, `say ${bradleyConfig[0].respawn_message}`);
              }
            }
          }, 900000); // 15 minutes
        }
        // If debris exists but we already have an active state, do nothing (prevents spam)
      } else if (bradleyResult && !bradleyResult.includes('servergibs_bradley')) {
        // Bradley debris is gone, clear the state
        const stateKey = `${serverId}_bradley`;
        const currentState = serverEventStates.get(stateKey);
        if (currentState && currentState.hasGibs) {
          currentState.hasGibs = false;
          serverEventStates.set(stateKey, currentState);
          console.log(`[EVENT] Bradley debris cleared for ${serverName}`);
        }
      }
    }

    // Check Helicopter gibs
    if (helicopterConfig.length > 0 && helicopterConfig[0].enabled) {
      const helicopterResult = await sendRconCommand(ip, port, password, 'find_entity servergibs_patrolhelicopter');
      
      if (helicopterResult && helicopterResult.includes('servergibs_patrolhelicopter')) {
        const stateKey = `${serverId}_helicopter`;
        const currentState = serverEventStates.get(stateKey);
        
        // Only send message if this is the FIRST time we detect debris (no active state)
        if (!currentState || !currentState.hasGibs) {
          serverEventStates.set(stateKey, { hasGibs: true, timestamp: Date.now() });
          
          // Send kill message ONLY ONCE when debris is first detected
          if (helicopterConfig[0].kill_message) {
            console.log(`[EVENT] Helicopter event detected on ${serverName}, sending message: ${helicopterConfig[0].kill_message}`);
            await sendRconCommand(ip, port, password, `say ${helicopterConfig[0].kill_message}`);
          }
          
          // Send to Discord feed ONLY ONCE
          await sendFeedEmbed(client, guildId, serverName, 'eventfeed', `🚁 **Patrol Helicopter Event Started!**\n${helicopterConfig[0].kill_message}`);
          
          // Set timeout to clear state after 15 minutes
          setTimeout(() => {
            const currentState = serverEventStates.get(stateKey);
            if (currentState && currentState.hasGibs) {
              currentState.hasGibs = false;
              serverEventStates.set(stateKey, currentState);
              
              // Send respawn message
              if (helicopterConfig[0].respawn_message) {
                console.log(`[EVENT] Helicopter respawned on ${serverName}, sending message: ${helicopterConfig[0].respawn_message}`);
                sendRconCommand(ip, port, password, `say ${helicopterConfig[0].respawn_message}`);
              }
            }
          }, 900000); // 15 minutes
        }
        // If debris exists but we already have an active state, do nothing (prevents spam)
      } else if (helicopterResult && !helicopterResult.includes('servergibs_patrolhelicopter')) {
        // Helicopter debris is gone, clear the state
        const stateKey = `${serverId}_helicopter`;
        const currentState = serverEventStates.get(stateKey);
        if (currentState && currentState.hasGibs) {
          currentState.hasGibs = false;
          serverEventStates.set(stateKey, currentState);
          console.log(`[EVENT] Helicopter debris cleared for ${serverName}`);
        }
      }
    }

  } catch (error) {
    console.error('[EVENT DETECTION] Error checking event gibs:', error);
  }
}

// Export functions for use in commands
module.exports = {
  startRconListeners,
  sendRconCommand,
  getServerInfo,
  activeConnections,
  restoreZonesOnStartup,
  processStuckWhiteZones,
  sendFeedEmbed,
  updatePlayerCountChannel,
  enableTeamActionLogging,
  populateTeamIds,
  checkEventGibs,
  clearOfflineExpirationTimer
}; 