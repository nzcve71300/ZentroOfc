const mysql = require('mysql2/promise');
const pool = require('../db');

// Configuration
const AUTO_RECREATE_ZONES = true;
const UPDATE_INTERVAL_MS = 60 * 1000; // 1 minute
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const EXPIRE_HOURS = 24;

// In-memory zone tracking
const playerZones = new Map();

/**
 * Get the desired zone state configuration
 */
function desiredZoneState(status) {
  switch (status) {
    case "active":
      return {
        enabled: 1,
        color: "(0,255,0)", // Green
        allowpvpdamage: 1,
        allownpcdamage: 1,
        allowbuildingdamage: 1,
        allowbuilding: 1,
      };
    case "offline":
      return {
        enabled: 0,
        color: "(255,0,0)", // Red
        allowpvpdamage: 0,
        allownpcdamage: 0,
        allowbuildingdamage: 0,
        allowbuilding: 0,
      };
    case "pending":
    default:
      return {
        enabled: 0,
        color: "(255,255,255)", // White
        allowpvpdamage: 0,
        allownpcdamage: 0,
        allowbuildingdamage: 0,
        allowbuilding: 0,
      };
  }
}

/**
 * Apply zone state to the game
 */
async function applyZoneState(ip, port, password, zoneName, state) {
  try {
    const { sendRconCommand } = require('../rcon/index.js');
    
    for (const [setting, value] of Object.entries(state)) {
      console.log(`[ZorpManager] Applying state: ${zoneName} -> ${setting}=${value}`);
      await sendRconCommand(ip, port, password, `zones.editcustomzone "${zoneName}" ${setting} ${value}`);
    }
  } catch (error) {
    console.error(`[ZorpManager] Error applying zone state for ${zoneName}:`, error);
  }
}

/**
 * Save zone to database
 */
async function saveZoneToDb(zone, serverId, updateLastSeen = false) {
  try {
    const { zoneName, coords, members, status, owner } = zone;
    
    const [result] = await pool.query(
      `INSERT INTO zorp_zones (name, server_id, owner, position, current_state, size, color_online, color_offline, created_at, last_online_at, expire, delay)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ${updateLastSeen ? 'NOW()' : 'NULL'}, ?, ?)
       ON DUPLICATE KEY UPDATE
         position=VALUES(position),
         current_state=VALUES(current_state),
         last_online_at=${updateLastSeen ? 'VALUES(last_online_at)' : 'last_online_at'}`,
      [
        zoneName, 
        serverId, 
        owner || members[0], 
        JSON.stringify(coords), 
        status, 
        45, // Default size
        '0,255,0', // Green
        '255,0,0', // Red
        86400, // 24 hours expire
        5 // 5 minutes delay
      ]
    );
    
    console.log(`[ZorpManager] DB save: ${zoneName} status=${status}, affectedRows=${result?.affectedRows ?? "?"}`);
  } catch (error) {
    console.error(`[ZorpManager] Error saving zone to DB:`, error);
  }
}

/**
 * Delete zone from database
 */
async function deleteZoneFromDb(zoneName, serverId) {
  try {
    const [result] = await pool.query(
      'DELETE FROM zorp_zones WHERE name = ? AND server_id = ?', 
      [zoneName, serverId]
    );
    console.log(`[ZorpManager] DB delete: ${zoneName}, affectedRows=${result?.affectedRows ?? "?"}`);
  } catch (error) {
    console.error(`[ZorpManager] Error deleting zone from DB:`, error);
  }
}

/**
 * Parse users response from RCON
 */
function parseUsersResponse(output) {
  const lines = output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const users = [];
  for (const line of lines) {
    if (line.startsWith("<slot:")) continue;
    if (line.endsWith("users")) continue;
    if (line.includes("id ;name")) continue;
    if (line.includes("NA ;")) continue;
    users.push(line.replace(/"/g, "").trim());
  }
  return users;
}

/**
 * Load zones from database on startup
 */
async function loadZonesFromDb(serverId, serverName) {
  try {
    console.log(`[ZorpManager] Loading zones from DB for server ${serverName}`);
    
    const [rows] = await pool.query(
      `SELECT name, position, current_state, owner, created_at, last_online_at
       FROM zorp_zones
       WHERE server_id = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP`,
      [serverId]
    );

    for (const row of rows) {
      try {
        const position = JSON.parse(row.position || '{"x":0,"y":0,"z":0}');
        const zone = {
          zoneName: row.name,
          coords: position,
          members: [row.owner],
          status: row.current_state || "offline",
          owner: row.owner,
        };
        
        if (!playerZones.has(row.name)) {
          playerZones.set(row.name, zone);
          console.log(`[ZorpManager] Restored zone from DB: ${row.name} status=${zone.status}`);
        }
      } catch (err) {
        console.error(`[ZorpManager] Failed to restore zone ${row.name}:`, err);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error loading zones from DB:`, error);
  }
}

/**
 * Get player team information
 */
async function getPlayerTeam(ip, port, password, playerName) {
  try {
    const { sendRconCommand } = require('../rcon/index.js');
    
    const result = await sendRconCommand(ip, port, password, `team.info "${playerName}"`);
    
    if (!result || result.includes('No team found') || result.includes('Could not find')) {
      return null;
    }
    
    // Parse team info from RCON response
    const lines = result.split('\n');
    let teamInfo = null;
    
    for (const line of lines) {
      if (line.includes('Team ID:')) {
        const teamId = line.split('Team ID:')[1]?.trim();
        if (teamId) {
          teamInfo = { id: teamId, owner: playerName, members: [playerName] };
        }
      } else if (line.includes('Members:')) {
        const membersStr = line.split('Members:')[1]?.trim();
        if (membersStr && teamInfo) {
          const members = membersStr.split(',').map(m => m.trim().replace(/"/g, ''));
          teamInfo.members = members;
        }
      }
    }
    
    return teamInfo;
  } catch (error) {
    console.error(`[ZorpManager] Error getting team info:`, error);
    return null;
  }
}

/**
 * Create a new Zorp zone
 */
async function createZorpZone(ip, port, password, playerName, coords, serverId, serverName) {
  try {
    const { sendRconCommand } = require('../rcon/index.js');
    
    const zoneName = `ZORP_${Date.now()}`;
    console.log(`[ZorpManager] Creating zone for ${playerName}: ${zoneName}`);
    
    // Create zone in game
    const createCmd = `zones.createcustomzone "${zoneName}" (${coords.x},${coords.y},${coords.z}) 0 Sphere 45 0 0 0 0 0`;
    await sendRconCommand(ip, port, password, createCmd);
    
    // Set initial state to pending (white)
    const zone = { 
      zoneName, 
      coords, 
      members: [playerName], 
      status: "pending",
      owner: playerName
    };
    
    playerZones.set(zoneName, zone);
    await saveZoneToDb(zone, serverId, true);
    await applyZoneState(ip, port, password, zoneName, desiredZoneState("pending"));
    
    // Start timer to transition to active after delay
    setTimeout(async () => {
      if (playerZones.has(zoneName)) {
        const currentZone = playerZones.get(zoneName);
        if (currentZone.status === "pending") {
          currentZone.status = "active";
          await applyZoneState(ip, port, password, zoneName, desiredZoneState("active"));
          await saveZoneToDb(currentZone, serverId, true);
          console.log(`[ZorpManager] Zone ${zoneName} transitioned to active`);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes delay
    
    return zoneName;
  } catch (error) {
    console.error(`[ZorpManager] Error creating zone:`, error);
    return null;
  }
}

/**
 * Handle player online/offline status changes
 */
async function handlePlayerStatusChange(ip, port, password, playerName, isOnline, serverId, serverName) {
  try {
    console.log(`[ZorpManager] Player ${playerName} is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    // Find zones owned by this player
    const playerZonesList = Array.from(playerZones.values()).filter(zone => 
      zone.owner === playerName || zone.members.includes(playerName)
    );
    
    for (const zone of playerZonesList) {
      const newStatus = isOnline ? "active" : "offline";
      
      if (zone.status !== newStatus) {
        console.log(`[ZorpManager] Updating zone ${zone.zoneName} from ${zone.status} to ${newStatus}`);
        
        zone.status = newStatus;
        await applyZoneState(ip, port, password, zone.zoneName, desiredZoneState(newStatus));
        await saveZoneToDb(zone, serverId, isOnline);
        
        console.log(`[ZorpManager] Zone ${zone.zoneName} updated to ${newStatus}`);
      } else if (isOnline) {
        // Update last seen time for online players
        await saveZoneToDb(zone, serverId, true);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error handling player status change:`, error);
  }
}

/**
 * Run scheduled zone validation and cleanup
 */
async function runScheduledCheck() {
  try {
    console.log("[ZorpManager] Running scheduled zone validation");
    
    // Get all active servers
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      WHERE rs.active = 1
    `);
    
    for (const server of servers) {
      try {
        const { sendRconCommand } = require('../rcon/index.js');
        
        // Get online players
        const usersOutput = await sendRconCommand(server.ip, server.port, server.password, "users");
        const players = parseUsersResponse(usersOutput);
        console.log(`[ZorpManager] Online players on ${server.nickname}: ${players.join(", ") || "none"}`);
        
        // Check each zone
        for (const [zoneName, zone] of playerZones.entries()) {
          if (zone.owner && server.id === zone.serverId) {
            const isOnline = players.includes(zone.owner);
            const newStatus = isOnline ? "active" : "offline";
            
            if (zone.status !== newStatus) {
              console.log(`[ZorpManager] Zone ${zoneName} status change: ${zone.status} -> ${newStatus}`);
              await handlePlayerStatusChange(server.ip, server.port, server.password, zone.owner, isOnline, server.id, server.nickname);
            }
          }
        }
      } catch (err) {
        console.error(`[ZorpManager] Failed zone check for ${server.nickname}:`, err);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error in scheduled check:`, error);
  }
}

/**
 * Run zone cleanup (expire old zones)
 */
async function runZoneCleanup() {
  try {
    console.log("[ZorpManager] Running zone cleanup");
    
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      WHERE rs.active = 1
    `);
    
    for (const server of servers) {
      try {
        const { sendRconCommand } = require('../rcon/index.js');
        
        // Find expired zones
        const [rows] = await pool.query(
          `SELECT name
           FROM zorp_zones
           WHERE server_id = ? AND last_online_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, last_online_at, NOW()) >= ?`,
          [server.id, EXPIRE_HOURS]
        );
        
        for (const row of rows) {
          console.log(`[ZorpManager] Expiring zone ${row.name} (inactive for ${EXPIRE_HOURS}h)`);
          
          // Delete from game
          await sendRconCommand(server.ip, server.port, server.password, `zones.deletecustomzone "${row.name}"`);
          
          // Delete from database
          await deleteZoneFromDb(row.name, server.id);
          
          // Remove from memory
          playerZones.delete(row.name);
        }
      } catch (err) {
        console.error(`[ZorpManager] Cleanup failed for server ${server.nickname}:`, err);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error in zone cleanup:`, error);
  }
}

/**
 * Initialize the Zorp Manager
 */
async function initializeZorpManager() {
  try {
    console.log("[ZorpManager] Initializing Zorp Manager...");
    
    // Load existing zones from database
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      WHERE rs.active = 1
    `);
    
    for (const server of servers) {
      await loadZonesFromDb(server.id, server.nickname);
    }
    
    // Start scheduled checks
    setInterval(runScheduledCheck, UPDATE_INTERVAL_MS);
    setInterval(runZoneCleanup, CLEANUP_INTERVAL_MS);
    
    console.log("[ZorpManager] Zorp Manager initialized successfully");
  } catch (error) {
    console.error("[ZorpManager] Error initializing Zorp Manager:", error);
  }
}

module.exports = {
  initializeZorpManager,
  createZorpZone,
  handlePlayerStatusChange,
  playerZones,
  desiredZoneState,
  applyZoneState
};
