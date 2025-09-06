const mysql = require('mysql2/promise');
const pool = require('../db');

// Configuration from the new system
const UPDATE_INTERVAL_MS = 60 * 1000; // 1 minute
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const EXPIRE_HOURS = 24;
const CHECK_RADIUS = 50;
const LASTSEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PENDING_TIMEOUT_MS = 30 * 1000; // 30 seconds

// In-memory zone tracking (adapted from new system)
const zonesByServer = new Map();
const pendingRequests = new Map();

/**
 * Get server zones map
 */
function getServerZones(serverId) {
  if (!zonesByServer.has(serverId)) zonesByServer.set(serverId, new Map());
  return zonesByServer.get(serverId);
}

/**
 * Get the desired zone state configuration (from new system)
 */
function desiredZoneState(status) {
  switch (status) {
    case "active":
      return {
        enabled: 1,
        color: "(0,255,0)",
        allowpvpdamage: 1,
        allownpcdamage: 1,
        allowbuildingdamage: 1,
        allowbuilding: 1,
      };
    case "offline":
      return {
        enabled: 0,
        color: "(255,0,0)",
        allowpvpdamage: 0,
        allownpcdamage: 0,
        allowbuildingdamage: 0,
        allowbuilding: 0,
      };
    case "expired":
      return {
        enabled: 0,
        color: "(128,128,128)",
        allowpvpdamage: 0,
        allownpcdamage: 0,
        allowbuildingdamage: 0,
        allowbuilding: 0,
      };
    default:
      return {
        enabled: 0,
        color: "(255,255,255)",
        allowpvpdamage: 0,
        allownpcdamage: 0,
        allowbuildingdamage: 0,
        allowbuilding: 0,
      };
  }
}

/**
 * RCON command with retry logic (from new system)
 */
async function rceCommandWithRetry(ip, port, password, cmd, retries = 3, delay = 1000) {
  const { sendRconCommand } = require('../rcon/index.js');
  
  for (let i = 0; i < retries; i++) {
    try {
      return await sendRconCommand(ip, port, password, cmd);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
}

/**
 * Apply zone state to the game (adapted from new system)
 */
async function applyZoneState(ip, port, password, zoneName, state) {
  try {
    for (const [setting, value] of Object.entries(state)) {
      console.log(`[ZorpManager] Applying state: ${zoneName} -> ${setting}=${value}`);
      await rceCommandWithRetry(ip, port, password, `zones.editcustomzone "${zoneName}" "${setting}" ${value}`);
    }
  } catch (error) {
    console.error(`[ZorpManager] Error applying zone state for ${zoneName}:`, error);
  }
}

/**
 * Save zone to database (adapted to use existing zorp_zones table)
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
 * Expire zone in database (from new system)
 */
async function expireZoneInDb(serverId, zoneName) {
  try {
    await pool.query(
      `UPDATE zorp_zones SET current_state='expired' WHERE name=? AND server_id=?`, 
      [zoneName, serverId]
    );
    console.log(`[ZorpManager] DB mark expired: ${zoneName}@${serverId}`);
  } catch (error) {
    console.error(`[ZorpManager] Error expiring zone in DB:`, error);
  }
}

/**
 * Parse users response from RCON (from new system)
 */
function parseUsersResponse(output) {
  return output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("<slot:") && !l.endsWith("users"))
    .map((l) => l.replace(/"/g, "").trim());
}

/**
 * Calculate distance between two points (from new system)
 */
function distance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
}

/**
 * Load zones from database on startup (adapted from new system)
 */
async function loadZonesFromDb(serverId, serverName) {
  try {
    console.log(`[ZorpManager] Loading zones from DB for server ${serverName}`);
    
    const [rows] = await pool.query(
      `SELECT name, position, current_state, owner, created_at, last_online_at
       FROM zorp_zones
       WHERE server_id = ? AND current_state != 'expired' AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP`,
      [serverId]
    );

    const zones = getServerZones(serverId);
    
    for (const row of rows) {
      try {
        const position = JSON.parse(row.position || '{"x":0,"y":0,"z":0}');
        const zone = { 
          zoneName: row.name, 
          coords: position, 
          members: [row.owner], 
          status: row.current_state || "offline",
          owner: row.owner
        };
        
        zones.set(zone.zoneName, zone);
        console.log(`[ZorpManager] Restored zone from DB: ${row.name} status=${zone.status}`);
      } catch (err) {
        console.error(`[ZorpManager] Failed to restore zone ${row.name}:`, err);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error loading zones from DB:`, error);
  }
}

/**
 * Refresh zones for a server (from new system)
 */
async function refreshZonesForServer(ip, port, password, serverId, serverName) {
  try {
    const usersOutput = await rceCommandWithRetry(ip, port, password, "users");
    const players = parseUsersResponse(usersOutput);
    const zones = getServerZones(serverId);

    for (const [zoneName, zone] of zones.entries()) {
      const anyOnline = zone.members.some((m) => players.includes(m));
      const newStatus = anyOnline ? "active" : "offline";

      if (zone.status !== newStatus) {
        zone.status = newStatus;
        await applyZoneState(ip, port, password, zone.zoneName, desiredZoneState(newStatus));
        await saveZoneToDb(zone, serverId, true);
        console.log(`[ZorpManager] Zone ${zoneName} status changed: ${zone.status} -> ${newStatus}`);
      } else if (anyOnline) {
        if (!zone.lastSeenUpdate || Date.now() - zone.lastSeenUpdate > LASTSEEN_UPDATE_INTERVAL_MS) {
          await saveZoneToDb(zone, serverId, true);
          zone.lastSeenUpdate = Date.now();
        }
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error refreshing zones for ${serverName}:`, error);
  }
}

/**
 * Get team leader and members (from new system)
 */
async function getTeamLeaderAndMembers(ip, port, password, teamId) {
  try {
    const resp = await rceCommandWithRetry(ip, port, password, `relationshipmanager.teaminfo "${teamId}"`);
    const lines = resp.split("\n").filter((l) => l.includes("["));
    const members = [];
    let leader = null;
    
    for (const line of lines) {
      const name = line.split(" ")[0].trim();
      members.push(name);
      if (line.includes("(LEADER)")) leader = name;
    }
    
    return { leader, members };
  } catch (error) {
    console.error(`[ZorpManager] Error getting team info:`, error);
    return { leader: null, members: [] };
  }
}

/**
 * Create zone for player (from new system)
 */
async function createZoneForPlayer(ip, port, password, serverId, serverName, ign) {
  try {
    const zones = getServerZones(serverId);

    // Check if player already has a zone
    if ([...zones.values()].some((z) => z.members.includes(ign))) {
      console.log(`[ZorpManager] Player ${ign} already has a zone`);
      return;
    }

    // Check for team
    const teamResp = await rceCommandWithRetry(ip, port, password, `relationshipmanager.findplayerteam "${ign}"`);
    const teamIdMatch = teamResp.match(/Team\s+(\d+)/i);
    let zoneName, members;

    if (teamIdMatch) {
      const { leader, members: teamMembers } = await getTeamLeaderAndMembers(ip, port, password, teamIdMatch[1]);
      if (ign !== leader) {
        console.log(`[ZorpManager] Player ${ign} is not team leader, only leader can create zones`);
        return;
      }
      if ([...zones.values()].some((z) => z.members.some((m) => teamMembers.includes(m)))) {
        console.log(`[ZorpManager] Team already has a zone`);
        return;
      }
      zoneName = leader;
      members = teamMembers;
    } else {
      zoneName = ign;
      members = [ign];
    }

    // Get player position
    const response = await rceCommandWithRetry(ip, port, password, `printpos "${ign}"`);
    const match = response.match(/-?\d+(\.\d+)?/g);
    if (!match) {
      console.log(`[ZorpManager] Could not get position for ${ign}`);
      return;
    }

    const [x, y, z] = match.map((n) => Math.round(parseFloat(n)));

    // Check for nearby zones
    for (const z of zones.values()) {
      if (distance({ x, y, z }, z.coords) < CHECK_RADIUS) {
        console.log(`[ZorpManager] Zone too close to existing zone`);
        return;
      }
    }

    // Create zone in game
    await rceCommandWithRetry(
      ip, port, password,
      `zones.createcustomzone "${zoneName}" (${x},${y},${z}) 0 Sphere 45 0 0 0 0 0`
    );

    const zone = { 
      zoneName, 
      coords: { x, y, z }, 
      members, 
      status: "pending", 
      owner: ign,
      lastSeenUpdate: Date.now() 
    };
    
    zones.set(zoneName, zone);
    await saveZoneToDb(zone, serverId, true);
    await applyZoneState(ip, port, password, zoneName, desiredZoneState("pending"));
    
    console.log(`[ZorpManager] Created zone for ${ign}: ${zoneName}`);
    return zoneName;
  } catch (error) {
    console.error(`[ZorpManager] Error creating zone for player:`, error);
    return null;
  }
}

/**
 * Handle Zorp emote creation (direct creation without confirmation)
 */
async function handleZorpEmote(ip, port, password, serverId, serverName, playerName) {
  try {
    console.log(`[ZORP] Player ${playerName} used Zorp emote on ${serverName}`);
    
    // Check if player already has a zone
    const zones = getServerZones(serverId);
    if ([...zones.values()].some((z) => z.members.includes(playerName))) {
      await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#FFD700>${playerName}</color> <color=white>you already have a Zorp zone!</color>`);
      return;
    }

    // Check for team
    const teamResp = await rceCommandWithRetry(ip, port, password, `relationshipmanager.findplayerteam "${playerName}"`);
    const teamIdMatch = teamResp.match(/Team\s+(\d+)/i);
    
    if (!teamIdMatch) {
      await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#FFD700>${playerName}</color> <color=white>you must be in a team to create a Zorp!</color>`);
      return;
    }

    const { leader, members: teamMembers } = await getTeamLeaderAndMembers(ip, port, password, teamIdMatch[1]);
    if (playerName !== leader) {
      await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#FFD700>${playerName}</color> <color=white>only the team leader can create a Zorp!</color>`);
      return;
    }

    // Check if team already has a zone
    if ([...zones.values()].some((z) => z.members.some((m) => teamMembers.includes(m)))) {
      await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#FFD700>${playerName}</color> <color=white>your team already has a Zorp zone!</color>`);
      return;
    }

    // Get player position
    const response = await rceCommandWithRetry(ip, port, password, `printpos "${playerName}"`);
    const match = response.match(/-?\d+(\.\d+)?/g);
    if (!match) {
      await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#FFD700>${playerName}</color> <color=white>could not get your position!</color>`);
      return;
    }

    const [x, y, z] = match.map((n) => Math.round(parseFloat(n)));

    // Check for nearby zones
    for (const z of zones.values()) {
      if (distance({ x, y, z }, z.coords) < CHECK_RADIUS) {
        await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#FFD700>${playerName}</color> <color=white>too close to another Zorp zone!</color>`);
        return;
      }
    }

    // Create zone in game
    await rceCommandWithRetry(
      ip, port, password,
      `zones.createcustomzone "${leader}" (${x},${y},${z}) 0 Sphere 45 0 0 0 0 0`
    );

    const zone = { 
      zoneName: leader, 
      coords: { x, y, z }, 
      members: teamMembers, 
      status: "pending", 
      owner: leader,
      lastSeenUpdate: Date.now() 
    };
    
    zones.set(leader, zone);
    await saveZoneToDb(zone, serverId, true);
    await applyZoneState(ip, port, password, leader, desiredZoneState("pending"));
    
    await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#00FF00>Zorp successfully created!</color> <color=white>for team ${leader}</color>`);
    console.log(`[ZORP] Zorp successfully created for ${playerName} (team leader: ${leader})`);
  } catch (error) {
    console.error(`[ZorpManager] Error handling Zorp emote:`, error);
    await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#FF0000>Error creating Zorp zone!</color>`);
  }
}

/**
 * Handle Zorp delete emote
 */
async function handleZorpDeleteEmote(ip, port, password, serverId, serverName, playerName) {
  try {
    console.log(`[ZORP] Player ${playerName} used Zorp delete emote on ${serverName}`);
    
    const zones = getServerZones(serverId);
    
    // Find the zone owned by this player or their team
    let zoneToDelete = null;
    let zoneOwner = null;
    
    // First check if player owns a zone directly
    for (const [zoneName, zone] of zones.entries()) {
      if (zone.owner === playerName) {
        zoneToDelete = zone;
        zoneOwner = playerName;
        break;
      }
    }
    
    // If not found, check if player is team leader of a zone
    if (!zoneToDelete) {
      const teamResp = await rceCommandWithRetry(ip, port, password, `relationshipmanager.findplayerteam "${playerName}"`);
      const teamIdMatch = teamResp.match(/Team\s+(\d+)/i);
      
      if (teamIdMatch) {
        const { leader } = await getTeamLeaderAndMembers(ip, port, password, teamIdMatch[1]);
        if (leader === playerName) {
          for (const [zoneName, zone] of zones.entries()) {
            if (zone.owner === leader) {
              zoneToDelete = zone;
              zoneOwner = leader;
              break;
            }
          }
        }
      }
    }
    
    if (!zoneToDelete) {
      await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#FFD700>${playerName}</color> <color=white>you don't have a Zorp zone to delete!</color>`);
      return;
    }
    
    // Delete zone from game
    await rceCommandWithRetry(ip, port, password, `zones.deletecustomzone "${zoneToDelete.zoneName}"`);
    
    // Delete from database
    await pool.query(
      'DELETE FROM zorp_zones WHERE name = ? AND server_id = ?', 
      [zoneToDelete.zoneName, serverId]
    );
    
    // Remove from memory
    zones.delete(zoneToDelete.zoneName);
    
    await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#00FF00>Zorp successfully deleted!</color> <color=white>for ${zoneOwner}</color>`);
    console.log(`[ZORP] Zorp successfully deleted for ${playerName} (zone owner: ${zoneOwner})`);
  } catch (error) {
    console.error(`[ZorpManager] Error handling Zorp delete emote:`, error);
    await rceCommandWithRetry(ip, port, password, `say <color=#FF6B35>[ZORP]</color> <color=#FF0000>Error deleting Zorp zone!</color>`);
  }
}

/**
 * Run scheduled zone validation and cleanup (adapted from new system)
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
        await refreshZonesForServer(server.ip, server.port, server.password, server.id, server.nickname);
      } catch (err) {
        console.error(`[ZorpManager] Failed zone check for ${server.nickname}:`, err);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error in scheduled check:`, error);
  }
}

/**
 * Run zone cleanup (expire old zones) (adapted from new system)
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
        const [rows] = await pool.query(
          `SELECT name
           FROM zorp_zones
           WHERE server_id = ? AND current_state != 'expired' AND last_online_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, last_online_at, NOW()) >= ?`,
          [server.id, EXPIRE_HOURS]
        );
        
        for (const row of rows) {
          console.log(`[ZorpManager] Expiring zone ${row.name} (inactive for ${EXPIRE_HOURS}h)`);
          
          // Delete from game
          await rceCommandWithRetry(server.ip, server.port, server.password, `zones.deletecustomzone "${row.name}"`);
          
          // Mark as expired in database
          await expireZoneInDb(server.id, row.name);
          
          // Remove from memory
          getServerZones(server.id).delete(row.name);
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
 * Initialize the Zorp Manager (adapted from new system)
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

// Legacy functions for backward compatibility
const playerZones = new Map(); // Keep for backward compatibility

/**
 * Create a new Zorp zone (legacy function)
 */
async function createZorpZone(ip, port, password, playerName, coords, serverId, serverName) {
  return await createZoneForPlayer(ip, port, password, serverId, serverName, playerName);
}

/**
 * Handle player online/offline status changes (legacy function)
 */
async function handlePlayerStatusChange(ip, port, password, playerName, isOnline, serverId, serverName) {
  try {
    console.log(`[ZorpManager] Player ${playerName} is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    const zones = getServerZones(serverId);
    const playerZonesList = Array.from(zones.values()).filter(zone => 
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

module.exports = {
  initializeZorpManager,
  createZorpZone,
  handlePlayerStatusChange,
  handleZorpEmote,
  handleZorpDeleteEmote,
  playerZones,
  zonesByServer,
  pendingRequests,
  getServerZones,
  desiredZoneState,
  applyZoneState,
  createZoneForPlayer,
  refreshZonesForServer,
  runScheduledCheck,
  runZoneCleanup
};