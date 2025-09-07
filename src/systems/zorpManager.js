const mysql = require('mysql2/promise');
const pool = require('../db');

// Configuration
const UPDATE_INTERVAL_MS = 30 * 1000; // unified updater every 30s
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const EXPIRE_HOURS = 24;
const CHECK_RADIUS = 50;
const LASTSEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory tracking
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
 * Desired zone states
 */
function desiredZoneState(status) {
  switch (status) {
    case "active":
      return { enabled: 1, color: "(0,255,0)", allowpvpdamage: 1, allownpcdamage: 1, allowbuildingdamage: 1, allowbuilding: 1 };
    case "offline":
      return { enabled: 0, color: "(255,0,0)", allowpvpdamage: 0, allownpcdamage: 0, allowbuildingdamage: 0, allowbuilding: 0 };
    case "expired":
      return { enabled: 0, color: "(128,128,128)", allowpvpdamage: 0, allownpcdamage: 0, allowbuildingdamage: 0, allowbuilding: 0 };
    case "pending":
      return { enabled: 1, color: "(255,255,0)", allowpvpdamage: 0, allownpcdamage: 0, allowbuildingdamage: 0, allowbuilding: 0 };
    default:
      return { enabled: 0, color: "(255,255,255)", allowpvpdamage: 0, allownpcdamage: 0, allowbuildingdamage: 0, allowbuilding: 0 };
  }
}

/**
 * RCON command with retry
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
 * Apply zone state
 */
async function applyZoneState(ip, port, password, zoneName, state) {
  try {
    for (const [setting, value] of Object.entries(state)) {
      await rceCommandWithRetry(ip, port, password, `zones.editcustomzone "${zoneName}" "${setting}" ${value}`);
    }
  } catch (error) {
    console.error(`[ZorpManager] Error applying zone state for ${zoneName}:`, error);
  }
}

/**
 * Save zone to DB
 */
async function saveZoneToDb(zone, serverId, updateLastSeen = false) {
  try {
    const { zoneName, coords, members, status, owner } = zone;
    await pool.query(
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
        45,
        '0,255,0',
        '255,0,0',
        86400,
        5
      ]
    );
  } catch (error) {
    console.error(`[ZorpManager] Error saving zone to DB:`, error);
  }
}

/**
 * Expire zone in DB
 */
async function expireZoneInDb(serverId, zoneName) {
  try {
    await pool.query(`UPDATE zorp_zones SET current_state='expired' WHERE name=? AND server_id=?`, [zoneName, serverId]);
  } catch (error) {
    console.error(`[ZorpManager] Error expiring zone in DB:`, error);
  }
}

/**
 * Parse "users" response
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
 * Distance
 */
function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Load zones from DB
 */
async function loadZonesFromDb(serverId, serverName) {
  try {
    const [rows] = await pool.query(
      `SELECT name, position, current_state, owner
       FROM zorp_zones
       WHERE server_id = ? AND current_state != 'expired' AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP`,
      [serverId]
    );
    const zones = getServerZones(serverId);
    for (const row of rows) {
      try {
        const position = JSON.parse(row.position || '{"x":0,"y":0,"z":0}');
        zones.set(row.name, {
          zoneName: row.name,
          coords: position,
          members: [row.owner],
          status: row.current_state || "offline",
          owner: row.owner
        });
      } catch (err) {
        console.error(`[ZorpManager] Failed to restore zone ${row.name}:`, err);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error loading zones from DB:`, error);
  }
}

/**
 * Refresh zones (core updater)
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
        console.log(`[ZorpManager] Zone ${zoneName} updated -> ${newStatus}`);
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
 * Unified zone updater (scheduled check + updater)
 */
async function runZoneUpdater() {
  try {
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
    `);
    for (const server of servers) {
      await refreshZonesForServer(server.ip, server.port, server.password, server.id, server.nickname);
    }
  } catch (error) {
    console.error("[ZorpManager] Zone updater error:", error);
  }
}

/**
 * Cleanup expired zones
 */
async function runZoneCleanup() {
  try {
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
    `);
    for (const server of servers) {
      const [rows] = await pool.query(
        `SELECT name FROM zorp_zones
         WHERE server_id = ? AND current_state != 'expired' AND last_online_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, last_online_at, NOW()) >= ?`,
        [server.id, EXPIRE_HOURS]
      );
      for (const row of rows) {
        await rceCommandWithRetry(server.ip, server.port, server.password, `zones.deletecustomzone "${row.name}"`);
        await expireZoneInDb(server.id, row.name);
        getServerZones(server.id).delete(row.name);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error in zone cleanup:`, error);
  }
}

/**
 * Get team leader and members
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
 * Update zone configuration (for /edit-zorp command)
 */
async function updateZoneConfiguration(serverId, updates) {
  try {
    const zones = getServerZones(serverId);
    
    // Update all zones in memory
    for (const [zoneName, zone] of zones.entries()) {
      // Update zone properties if they exist in updates
      if (updates.size !== undefined) {
        // Size updates require zone recreation, handled by the command
      }
      if (updates.color_online !== undefined) {
        zone.color_online = updates.color_online;
      }
      if (updates.color_offline !== undefined) {
        zone.color_offline = updates.color_offline;
      }
      if (updates.delay !== undefined) {
        zone.delay = updates.delay;
      }
      if (updates.expire !== undefined) {
        zone.expire = updates.expire;
      }
    }
    
    console.log(`[ZorpManager] Updated zone configuration for server ${serverId}`);
  } catch (error) {
    console.error(`[ZorpManager] Error updating zone configuration:`, error);
  }
}

/**
 * Apply zone state with custom colors (for /edit-zorp command)
 */
async function applyZoneStateWithColors(ip, port, password, zoneName, state, customColors = {}) {
  try {
    const zoneState = { ...state };
    
    // Override colors if custom colors are provided
    if (customColors.color_online && state.color === "(0,255,0)") {
      zoneState.color = `(${customColors.color_online})`;
    }
    if (customColors.color_offline && state.color === "(255,0,0)") {
      zoneState.color = `(${customColors.color_offline})`;
    }
    
    // Apply each setting using proper zones.editcustomzone command
    for (const [setting, value] of Object.entries(zoneState)) {
      if (setting === 'color') {
        // Color needs to be in (R,G,B) format
        await rceCommandWithRetry(ip, port, password, `zones.editcustomzone "${zoneName}" color ${value}`);
      } else {
        await rceCommandWithRetry(ip, port, password, `zones.editcustomzone "${zoneName}" ${setting} ${value}`);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error applying zone state with colors for ${zoneName}:`, error);
  }
}

/**
 * Update zone size by recreating the zone (for /edit-zorp command)
 */
async function updateZoneSize(ip, port, password, zoneName, newSize, position) {
  try {
    // Delete the old zone
    await rceCommandWithRetry(ip, port, password, `zones.deletecustomzone "${zoneName}"`);
    
    // Create new zone with updated size
    const createCommand = `zones.createcustomzone "${zoneName}" (${position.x},${position.y},${position.z}) 0 Sphere ${newSize} 0 0 0 0 0`;
    await rceCommandWithRetry(ip, port, password, createCommand);
    
    console.log(`[ZorpManager] Updated zone ${zoneName} size to ${newSize}`);
  } catch (error) {
    console.error(`[ZorpManager] Error updating zone size for ${zoneName}:`, error);
  }
}

/**
 * Handle player status change (legacy compatibility)
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

/**
 * Init
 */
async function initializeZorpManager() {
  try {
    console.log("[ZorpManager] Initializing Zorp Manager...");
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
    `);
    for (const server of servers) {
      await loadZonesFromDb(server.id, server.nickname);
    }
    setInterval(runZoneUpdater, UPDATE_INTERVAL_MS);
    setInterval(runZoneCleanup, CLEANUP_INTERVAL_MS);
    console.log("[ZorpManager] Zorp Manager initialized successfully");
  } catch (error) {
    console.error("[ZorpManager] Error initializing Zorp Manager:", error);
  }
}

module.exports = {
  initializeZorpManager,
  getServerZones,
  desiredZoneState,
  applyZoneState,
  applyZoneStateWithColors,
  updateZoneSize,
  updateZoneConfiguration,
  refreshZonesForServer,
  runZoneUpdater,
  runZoneCleanup,
  handleZorpEmote,
  handleZorpDeleteEmote,
  handlePlayerStatusChange,
  zonesByServer,
  pendingRequests
};