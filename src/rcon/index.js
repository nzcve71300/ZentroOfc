const WebSocket = require('ws');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const pool = require('../db');
const { orangeEmbed } = require('../embeds/format');
const killfeedProcessor = require('../utils/killfeedProcessor');
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
const nightSkipVotes = new Map(); // Track night skip voting state
const nightSkipVoteCounts = new Map(); // Track vote counts per server
const nightSkipFailedAttempts = new Map(); // Track failed night skip attempts to prevent re-triggering

// Home Teleport state tracking
const homeTeleportState = new Map(); // Track home teleport state
const homeTeleportCooldowns = new Map(); // Track cooldowns per player

// Book-a-Ride constants
const BOOKARIDE_EMOTE = 'd11_quick_chat_orders_slot_5';
const BOOKARIDE_CHOICES = {
  horse: 'd11_quick_chat_responses_slot_0',
  rhib: 'd11_quick_chat_responses_slot_1',
};

// Home Teleport constants
const SET_HOME_EMOTE = 'd11_quick_chat_building_slot_3';
const TELEPORT_HOME_EMOTE = 'd11_quick_chat_combat_slot_1';
const HOME_CHOICES = {
  yes: 'd11_quick_chat_responses_slot_0',
  no: 'd11_quick_chat_responses_slot_1',
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

      Logger.quiet('[RCON MSG]', msg);
      
      // Debug: Log all messages that might be note panel related
      if (msg.includes('[NOTE PANEL]') || msg.includes('note:update')) {
        Logger.debug(`[NOTEFEED DEBUG] Potential note panel message detected: ${msg}`);
      }

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

      // Handle note panel messages FIRST (before other handlers)
      if (msg.match(/\[NOTE PANEL\] Player \[ .*? \] changed name from \[ .*? \] to \[ .*? \]/)) {
        Logger.debug(`[NOTEFEED] Note panel message detected: ${msg}`);
        const match = msg.match(/\[NOTE PANEL\] Player \[ (.*?) \] changed name from \[ .*? \] to \[ (.*?) \]/);
        if (match) {
          const player = match[1];
          const note = match[2].replace(/\\n/g, '\n').trim();
          Logger.debug(`[NOTEFEED] Parsed - Player: ${player}, Note: ${note}`);
          if (note) {
            Logger.debug(`[NOTEFEED] Sending in-game message: ${note}`);
            // Send green and bold message in-game
            sendRconCommand(ip, port, password, `say <color=green><b>${note}</b></color>`);
            // Send to notefeed
            await sendFeedEmbed(client, guildId, serverName, 'notefeed', `**${player}** says: ${note}`);
            Logger.event(`[NOTEFEED] Note sent to Discord from ${player}: ${note}`);
          } else {
            Logger.debug(`[NOTEFEED] Note is empty, skipping`);
          }
        } else {
          Logger.debug(`[NOTEFEED] Regex match failed for note panel message`);
        }
        // Return early to prevent other handlers from processing this message
        return;
      }
      
      // Alternative note panel detection (in case the format is different)
      if (msg.includes('[NOTE PANEL]') && msg.includes('changed name from')) {
        Logger.debug(`[NOTEFEED] Alternative note panel message detected: ${msg}`);
        // Try a more flexible regex
        const altMatch = msg.match(/\[NOTE PANEL\] Player \[ (.*?) \] changed name from \[ (.*?) \] to \[ (.*?) \]/);
        if (altMatch) {
          const player = altMatch[1];
          const oldNote = altMatch[2];
          const newNote = altMatch[3].replace(/\\n/g, '\n').trim();
          Logger.debug(`[NOTEFEED] Alternative parsing - Player: ${player}, Old: "${oldNote}", New: "${newNote}"`);
          if (newNote && newNote !== oldNote) {
            Logger.debug(`[NOTEFEED] Sending in-game message: ${newNote}`);
            // Send green and bold message in-game
            sendRconCommand(ip, port, password, `say <color=green><b>${newNote}</b></color>`);
            // Send to notefeed
            await sendFeedEmbed(client, guildId, serverName, 'notefeed', `**${player}** says: ${newNote}`);
            Logger.event(`[NOTEFEED] Note sent to Discord from ${player}: ${newNote}`);
          } else {
            Logger.debug(`[NOTEFEED] New note is empty or same as old note, skipping`);
          }
        } else {
          Logger.debug(`[NOTEFEED] Alternative regex also failed`);
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

      // Handle Home choice emotes (Yes/No)
      if (msg.includes(HOME_CHOICES.yes) || msg.includes(HOME_CHOICES.no)) {
        await handleHomeChoice(client, guildId, serverName, parsed, ip, port, password);
      }

      // Handle ZORP emotes
      await handleZorpEmote(client, guildId, serverName, parsed, ip, port, password);
      await handleZorpDeleteEmote(client, guildId, serverName, parsed, ip, port, password);

      // Handle ZORP zone entry/exit messages
      await handleZorpZoneStatus(client, guildId, serverName, msg, ip, port, password);

      // Handle team changes
      await handleTeamChanges(client, guildId, serverName, msg, ip, port, password);

      // Track team changes for ZORP system
      await trackTeamChanges(msg);

      // Handle position responses for Book-a-Ride
      try {
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
      
      // Handle coin rewards for kills (both player kills and scientist kills)
      if (killData.isPlayerKill) {
        const rewardResult = await handleKillRewards(guildId, serverName, killData.killer, killData.victim, false);
        if (rewardResult && rewardResult.reward > 0) {
          // Get currency name for this server
          const { getCurrencyName } = require('../utils/economy');
          const currencyName = await getCurrencyName(serverId);
          
          sendRconCommand(ip, port, password, `say <color=#FFD700>${killData.killer}</color> <color=white>earned</color> <color=#00FF00>${rewardResult.reward} ${currencyName}</color> <color=white>for the kill!</color>`);
        }
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

        Logger.debug('Processing kit message:', kitMsg);

  for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {
    let player = null;
    let processedEmote = false;
    
    // Check string format first (more reliable for player name extraction)
    if (typeof kitMsg === 'string' && kitMsg.includes(emote)) {
      player = extractPlayerName(kitMsg);
      processedEmote = true;
              Logger.debug('Found kit emote in string:', kitKey, 'player:', player);
    } 
    // Only check object format if string format didn't match
    else if (typeof kitMsg === 'object' && kitMsg.Message && kitMsg.Message.includes(emote)) {
      player = kitMsg.Username || null;
      processedEmote = true;
              Logger.debug('Found kit emote in object:', kitKey, 'player:', player);
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
    console.log('[KIT CLAIM DEBUG] Processing claim for:', kitKey, 'player:', player, 'server:', serverName);
    
    // Deduplication check - prevent same kit claim within 10 seconds
    const dedupKey = `${serverName}:${player}:${kitKey}`;
    const now = Date.now();
    const lastClaim = kitClaimDeduplication.get(dedupKey);
    
    if (lastClaim && (now - lastClaim) < 10000) {
      console.log('[KIT CLAIM DEBUG] Duplicate claim detected, skipping:', dedupKey);
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
          sendRconCommand(ip, port, password, `say [AUTOKITS] <color=#FF69B4>${player}</color> please wait <color=white>before claiming again</color> <color=#800080>${remaining}m</color>`);
          return;
        }
      }
    }

    // Check if player is in the kit list for VIP and ELITE kits
    if (kitKey === 'VIPkit' || kitKey.startsWith('ELITEkit')) {
      console.log('[KIT CLAIM DEBUG] Checking kit list authorization for:', kitKey, 'player:', player);
      
      // Get the kitlist name
      let kitlistName;
      if (kitKey === 'VIPkit') {
        kitlistName = 'VIPkit';
      } else {
        // ELITEkit1 -> Elite1, ELITEkit2 -> Elite2, etc.
        const eliteNumber = kitKey.replace('ELITEkit', '');
        kitlistName = `Elite${eliteNumber}`;
      }
      
      // Check if player is in the kit list (support both old and new schema)
      const [authResult] = await pool.query(
        `SELECT ka.* FROM kit_auth ka 
         LEFT JOIN players p ON ka.discord_id = p.discord_id 
         WHERE ka.server_id = ? AND (
           (ka.kit_name = ? AND LOWER(ka.player_name) = LOWER(?)) OR
           (p.ign = ? AND ka.kitlist = ?)
         )`,
        [serverId, kitKey, player, player, kitlistName]
      );
      
      console.log('[KIT CLAIM DEBUG] Kit list check for', kitlistName, ':', authResult.length > 0 ? 'AUTHORIZED' : 'NOT AUTHORIZED');
      
      if (authResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Player not in kit list:', player, 'for kit:', kitKey);
        // Don't send any message - just silently ignore
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
      Logger.debug('Teleport emote detected:', msg);
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
            Logger.debug(`Server ID: ${serverId} for ${serverName}`);

    // Check for Outpost emote
    if (msg.includes('d11_quick_chat_combat_slot_2')) {
      const player = extractPlayerName(msg);
              Logger.debug(`Outpost emote detected for player: ${player}`);
      if (player) {
        await handlePositionTeleport(client, guildId, serverName, serverId, ip, port, password, 'outpost', player);
      }
    }

    // Check for Bandit Camp emote
    if (msg.includes('d11_quick_chat_combat_slot_0')) {
      const player = extractPlayerName(msg);
              Logger.debug(`Bandit Camp emote detected for player: ${player}`);
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
          Logger.debug(`Processing teleport for ${player} to ${positionType}`);
    
    // Get position configuration
    const configResult = await pool.query(
      'SELECT enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ? AND position_type = ?',
      [serverId.toString(), positionType]
    );

    if (configResult[0].length > 0) {
      const config = configResult[0][0];
      Logger.debug(`Teleport config: enabled=${config.enabled}, delay=${config.delay_seconds}s, cooldown=${config.cooldown_minutes}m`);
      
      // Check if enabled (MySQL returns 1 for true, 0 for false)
      if (config.enabled === 1) {
        Logger.debug(`Teleport is ENABLED for ${positionType}`);
      } else {
        Logger.debug(`Teleport is DISABLED for ${positionType}`);
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

    Logger.debug(`Proceeding with teleport for ${player} to ${positionType}`);

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
      Logger.debug(`Executing teleport command for ${player}`);
      sendRconCommand(ip, port, password, teleportCommand);
      
      // Send success message
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>teleported to</color> <color=#800080>${positionDisplayName}</color> <color=white>successfully</color>`);
      
      // Update cooldown
      recentTeleports.set(cooldownKey, now);
      
      // Send to admin feed
      await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🚀 **Position Teleport:** ${player} teleported to ${positionDisplayName}`);
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

    // Get server ID and check if Book-a-Ride is enabled
    const [serverResult] = await pool.query(
      'SELECT rs.id, rc.enabled, rc.cooldown FROM rust_servers rs LEFT JOIN rider_config rc ON rs.id = rc.server_id WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND rs.nickname = ?',
      [guildId, serverName]
    );

    if (serverResult.length === 0) return;
    
    const serverId = serverResult[0].id;
    const isEnabled = serverResult[0].enabled !== 0; // Default to enabled if no config
    const cooldown = serverResult[0].cooldown || 300; // Default 5 minutes

    if (!isEnabled) return;

    // Check for Book-a-Ride request emote
    if (msg.includes(BOOKARIDE_EMOTE)) {
      const player = extractPlayerName(msg);
      if (!player) return;

      Logger.info(`Ride requested: ${player} on ${serverName}`);

      // Check cooldowns for both vehicle types
      const now = Date.now();
      const horseKey = `${serverId}:${player}:horse`;
      const rhibKey = `${serverId}:${player}:rhib`;
      
      const horseLastUsed = bookARideCooldowns.get(horseKey) || 0;
      const rhibLastUsed = bookARideCooldowns.get(rhibKey) || 0;
      
      const horseAvailable = (now - horseLastUsed) >= cooldown * 1000;
      const rhibAvailable = (now - rhibLastUsed) >= cooldown * 1000;
      
      if (!horseAvailable && !rhibAvailable) {
        const horseRemaining = Math.ceil((cooldown * 1000 - (now - horseLastUsed)) / 1000);
        const rhibRemaining = Math.ceil((cooldown * 1000 - (now - rhibLastUsed)) / 1000);
        const shortestWait = Math.min(horseRemaining, rhibRemaining);
        sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#ff6b6b>${player}</color> <color=white>you must wait</color> <color=#ffa500>${shortestWait}</color> <color=white>seconds before booking another ride</color>`);
        
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
        rhibAvailable: rhibAvailable
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

    if (playerState && playerState.step === 'waiting_for_choice') {
      let chosenRide = null;

      if (msg.includes(BOOKARIDE_CHOICES.horse)) {
        chosenRide = 'horse';
      } else if (msg.includes(BOOKARIDE_CHOICES.rhib)) {
        chosenRide = 'rhib';
      }

      if (chosenRide && playerState.position) {
        Logger.info(`Ride chosen: ${player} → ${chosenRide}`);

        // Check if the chosen vehicle is available (double-check)
        const isAvailable = (chosenRide === 'horse' && playerState.horseAvailable) || 
                           (chosenRide === 'rhib' && playerState.rhibAvailable);
        
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
          sendRconCommand(ip, port, password, `entcount`);
          sendRconCommand(ip, port, password, `entity.deleteby testridablehorse ${x} ${y} ${z} 15`);
          setTimeout(() => {
            sendRconCommand(ip, port, password, `entity.spawn testridablehorse ${playerState.position}`);
            sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${player}</color> <color=white>your</color> <color=#8b4513>Horse</color> <color=white>has been delivered!</color>`);
          }, 1000);
        } else if (chosenRide === 'rhib') {
          // Clear nearby entities and spawn rhib  
          sendRconCommand(ip, port, password, `entcount`);
          sendRconCommand(ip, port, password, `entity.deleteby rhib ${x} ${y} ${z} 15`);
          setTimeout(() => {
            sendRconCommand(ip, port, password, `entity.spawn rhib ${playerState.position}`);
            sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${player}</color> <color=white>your</color> <color=#4169e1>Rhib</color> <color=white>has been delivered!</color>`);
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
          Logger.debug('Position response received');
    
    // Only debug position-like messages to reduce spam
    if (msg.includes('(') && msg.includes(')')) {
      Logger.debug('Checking for position data');
    }
    
    // Check if this is a position response (format: "(x, y, z)")
    const positionMatch = msg.match(/^\(([^)]+)\)$/);
    if (!positionMatch) {
      if (msg.includes('(') && msg.includes(')')) {
        Logger.debug('Position-like message but regex failed');
      }
      return;
    }

    const positionStr = positionMatch[1];
          Logger.debug('Position data extracted');

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
      // Check for home teleport position requests
      console.log(`[HOME TELEPORT DEBUG] Checking for home teleport state, current states:`, Array.from(homeTeleportState.entries()));
      const foundHomeState = Array.from(homeTeleportState.entries()).find(([key, state]) => {
        return state.step === 'waiting_for_position';
      });

      if (foundHomeState) {
        const [homeStateKey, homeState] = foundHomeState;
        const playerName = homeState.player;

        // Parse position coordinates
        const coords = positionStr.split(', ').map(coord => parseFloat(coord.trim()));
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
        console.log(`[HOME TELEPORT DEBUG] Saving home location to database: guildId=${guildId}, serverId=${serverId}, player=${playerName}, coords=(${coords[0]}, ${coords[1]}, ${coords[2]})`);
        await pool.query(
          `INSERT INTO player_homes (guild_id, server_id, player_name, x_pos, y_pos, z_pos, set_at, updated_at) 
           VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE x_pos = VALUES(x_pos), y_pos = VALUES(y_pos), z_pos = VALUES(z_pos), updated_at = CURRENT_TIMESTAMP`,
          [guildId, serverId, playerName, coords[0], coords[1], coords[2]]
        );
        console.log(`[HOME TELEPORT DEBUG] Database insert completed`);

        // Clear state
        homeTeleportState.delete(homeStateKey);
        console.log(`[HOME TELEPORT DEBUG] Home location saved and state cleared for ${playerName}`);

        // Send success message
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${playerName}</color> <color=white>home location saved successfully!</color>`);

        // Send to admin feed
        await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🏠 **Home Set:** ${playerName} set their home at (${coords[0]}, ${coords[1]}, ${coords[2]})`);

        Logger.info(`Home location saved for ${playerName}: (${coords[0]}, ${coords[1]}, ${coords[2]})`);
        return;
      }

      Logger.debug('No pending position request found');
      return;
    }

    const playerName = foundPlayerState.player;
          Logger.debug(`Position matched to player: ${playerName}`);

    // Use the found player state
    const stateKey = foundStateKey;
    const playerState = foundPlayerState;

    if (playerState && playerState.step === 'waiting_for_position') {
      Logger.debug(`Found pending request for ${playerName}`);

      // Store the position and update state
      playerState.position = positionStr;
      playerState.step = 'waiting_for_choice';

      // Show ride selection message with availability (using <br> to avoid rate limiting)
      let horseOption = '';
      let rhibOption = '';
      
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
      
      // Send all options in a single message using <br> for line breaks
      sendRconCommand(ip, port, password, `say <color=#FF69B4>[RIDER]</color> <color=#00ff00>${playerName}</color> <color=white>which ride would you like to book?</color><br>${horseOption}<br>${rhibOption}`);

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
  console.log(`[EXTRACT DEBUG] Processing logLine: ${logLine}`);
  // Try multiple formats for player name extraction
  let match = logLine.match(/\[CHAT LOCAL\] (.*?) :/);
  if (match) {
    console.log(`[EXTRACT DEBUG] Found match: ${match[1]}`);
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
    
    ws.on('message', async (data) => {
      try {
        const parsed = JSON.parse(data);
        console.log(`[RCON] Received response from ${ip}:${port}:`, parsed);
        
        if (parsed.Message) {
          // Check if this is a position response and inject it into main message handler
                Logger.debug('Processing command response');
          
          // Clean the message by removing invisible characters
          const cleanMessage = parsed.Message.replace(/[\x00-\x1F\x7F]/g, '').trim();
          Logger.debug('Message cleaned');
          
          if (cleanMessage.match(/^\([^)]+\)$/)) {
            Logger.debug('Position response from command handler');
            // Inject this message into the main WebSocket handler by triggering it manually
            // Find the main connection for this server by looking up server details
                  Logger.debug('Looking for server connection');
            
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
                console.log(`[BOOK-A-RIDE DEBUG] Looking for connection key: ${connectionKey}`);
                
                const mainConnection = activeConnections[connectionKey];
                if (mainConnection && mainConnection.readyState === 1) {
                  // Simulate a message event on the main connection
                  const simulatedData = JSON.stringify({ Message: cleanMessage });
                  Logger.debug('Injecting position response into main handler');
                  // We'll trigger the main handler by emitting a message event
                  mainConnection.emit('message', simulatedData);
                } else {
                  Logger.debug('Main connection not ready');
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

async function sendFeedEmbed(client, guildId, serverName, channelType, message) {
  try {
    Logger.debug(`[SEND_FEED] Attempting to send ${channelType} message for ${serverName}: ${message}`);
    
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
      Logger.debug(`No ${channelType} channel configured for ${serverName}`);
      return;
    }

    const channelId = result[0].channel_id;
    Logger.debug(`[SEND_FEED] Found channel ID: ${channelId} for ${channelType}`);
    
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      Logger.error(`Channel not found: ${channelId}`);
      return;
    }

    Logger.debug(`[SEND_FEED] Channel found: #${channel.name} (${channel.type})`);

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0xFF8C00) // Orange color
      .setTitle(`${channelType.charAt(0).toUpperCase() + channelType.slice(1)} - ${serverName}`)
      .setDescription(message)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    Logger.adminFeed(`Sent to ${serverName}: ${message}`);
    Logger.debug(`[SEND_FEED] Successfully sent ${channelType} message to ${serverName}`);
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
      Logger.debug(`No player count channel configured for ${serverName}`);
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
      Logger.debug('No servers with enabled events found');
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

    Logger.debug(`Checking events for ${servers.size} servers`);

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
        Logger.error(`Error checking events for server ${server.nickname}:`, serverError);
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
      await finalizeNightSkipVote(client, guildId, serverName, newVoteCount, ip, port, password, true);
    }

  } catch (error) {
    console.error(`[NIGHT SKIP] Error handling vote on ${serverName}:`, error.message);
  }
}

async function finalizeNightSkipVote(client, guildId, serverName, voteCount, ip, port, password, success) {
  try {
    const serverKey = `${guildId}:${serverName}`;
    
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
    
    // Clear the voting session
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

    // Check for ZORP delete emote in the correct format: [CHAT LOCAL] player : d11_quick_chat_responses_slot_6
    if (msg.includes('[CHAT LOCAL]') && msg.includes('d11_quick_chat_responses_slot_6')) {
      console.log(`[ZORP DEBUG] ZORP delete emote detected: ${msg}`);
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
    
    // Deduplication: prevent multiple calls for the same player within 10 seconds
    const playerKey = `${guildId}_${serverName}_${cleanPlayerName}`;
    const now = Date.now();
    const lastCall = lastOfflineCall.get(playerKey) || 0;
    
    if (now - lastCall < 10000) { // 10 seconds instead of 30 seconds
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
    
    // Deduplication: prevent multiple calls for the same player within 10 seconds
    const playerKey = `${guildId}_${serverName}_${cleanPlayerName}`;
    const now = Date.now();
    const lastCall = lastOfflineCall.get(playerKey) || 0;
    
    if (now - lastCall < 10000) { // 10 seconds instead of 30 seconds
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
      if (onlinePlayers.has(member)) {
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
      'SELECT whitelist_enabled, cooldown_minutes FROM home_teleport_configs WHERE server_id = ?',
      [serverId]
    );

    let config = {
      whitelist_enabled: false,
      cooldown_minutes: 5
    };

    if (configResult.length > 0) {
      config = {
        whitelist_enabled: configResult[0].whitelist_enabled !== 0,
        cooldown_minutes: configResult[0].cooldown_minutes || 5
      };
    }

    // Check whitelist if enabled
    if (config.whitelist_enabled) {
      const [whitelistResult] = await pool.query(
        'SELECT * FROM player_whitelists WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND player_name = ? AND whitelist_type = ?',
        [guildId, serverId, player, 'home_teleport']
      );

      if (whitelistResult.length === 0) {
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you are not whitelisted for home teleport</color>`);
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

    // Set state to waiting for confirmation
    const stateKey = `${serverId}_${player}`;
    homeTeleportState.set(stateKey, {
      player: player,
      step: 'waiting_for_confirmation',
      timestamp: now
    });

    // Send confirmation message
    sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>are you stood in your base?</color><br><color=#00ff00>Yes</color> <color=white>or</color> <color=#ff0000>No</color>`);

    Logger.info(`Set home confirmation sent to ${player}`);

  } catch (error) {
    Logger.error('Error handling set home:', error);
  }
}

async function handleHomeChoice(client, guildId, serverName, parsed, ip, port, password) {
  try {
    const player = extractPlayerName(parsed.Message);
    if (!player) return;

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
    const stateKey = `${serverId}_${player}`;
    const playerState = homeTeleportState.get(stateKey);

    if (!playerState || playerState.step !== 'waiting_for_confirmation') {
      return; // Not in set home flow
    }

    // Determine choice
    let choice = null;
    if (parsed.Message.includes(HOME_CHOICES.yes)) {
      choice = 'yes';
    } else if (parsed.Message.includes(HOME_CHOICES.no)) {
      choice = 'no';
    }

    if (!choice) return;

    if (choice === 'no') {
      // Cancel the operation
      homeTeleportState.delete(stateKey);
      sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>home setting cancelled</color>`);
      Logger.info(`Set home cancelled by ${player}`);
      return;
    }

    if (choice === 'yes') {
      // Update state to waiting for position
      playerState.step = 'waiting_for_position';
      homeTeleportState.set(stateKey, playerState);
      console.log(`[HOME TELEPORT DEBUG] Set state to waiting_for_position for key: ${stateKey}, state:`, playerState);

      // Get player position
      sendRconCommand(ip, port, password, `printpos ${player}`);
      Logger.info(`Position request sent for ${player}`);
    }

  } catch (error) {
    Logger.error('Error handling home choice:', error);
  }
}

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
      'SELECT whitelist_enabled, cooldown_minutes FROM home_teleport_configs WHERE server_id = ?',
      [serverId]
    );

    let config = {
      whitelist_enabled: false,
      cooldown_minutes: 5
    };

    if (configResult.length > 0) {
      config = {
        whitelist_enabled: configResult[0].whitelist_enabled !== 0,
        cooldown_minutes: configResult[0].cooldown_minutes || 5
      };
    }

    // Check whitelist if enabled
    if (config.whitelist_enabled) {
      const [whitelistResult] = await pool.query(
        'SELECT * FROM player_whitelists WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND player_name = ? AND whitelist_type = ?',
        [guildId, serverId, player, 'home_teleport']
      );

      if (whitelistResult.length === 0) {
        sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you are not whitelisted for home teleport</color>`);
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