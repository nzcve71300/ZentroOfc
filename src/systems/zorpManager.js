const mysql = require('mysql2/promise');
const pool = require('../db');

// Configuration
const UPDATE_INTERVAL_MS = 30 * 1000; // unified updater every 30s
const VERIFY_INTERVAL_MS = 60 * 1000; // verify zone state every 1 minute
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
    console.log(`[ZorpManager] Applying desired state to zone ${zoneName}:`, state);
    for (const [setting, value] of Object.entries(state)) {
      await rceCommandWithRetry(ip, port, password, `zones.editcustomzone "${zoneName}" "${setting}" ${value}`);
    }
  } catch (error) {
    console.error(`[ZorpManager] Error applying zone state for ${zoneName}:`, error);
  }
}

/**
 * ✅ Verify zone state and correct drift
 */
async function verifyZoneState(ip, port, password, zoneName, expectedState) {
  try {
    console.log(`[ZorpManager] Verifying zone state for ${zoneName}`);
    const info = await rceCommandWithRetry(ip, port, password, `zones.customzoneinfo "${zoneName}"`);
    if (typeof info !== 'string' || !info.includes('Name')) {
      console.warn(`[ZorpManager] Zone ${zoneName} info not found or invalid output`);
      return;
    }

    // Extract key/value pairs like "Enabled [1] Player Damage [0] Color [(0,255,0)]"
    const pairs = {};
    const regex = /([A-Za-z ]+)\s*\[([^\]]*)\]/g;
    let m;
    while ((m = regex.exec(info)) !== null) {
      pairs[m[1].trim().toLowerCase()] = m[2].trim();
    }

    const actual = {
      enabled: Number(pairs["enabled"] ?? 0),
      allowpvpdamage: Number(pairs["player damage"] ?? 0),
      allownpcdamage: Number(pairs["npc damage"] ?? 0),
      allowbuildingdamage: Number(pairs["player building damage"] ?? 0),
      allowbuilding: Number(pairs["allow building"] ?? 0),
      color: (pairs["color"] || "").replace(/\s+/g, ""),
    };

    // Compare and fix
    for (const [key, expected] of Object.entries(expectedState)) {
      const expVal = key === 'color' ? expected.replace(/\s+/g, '') : Number(expected);
      const actVal = key === 'color' ? actual.color : Number(actual[key]);
      if (actVal !== expVal) {
        console.log(`[ZorpManager] Correcting ${zoneName} setting ${key}: expected ${expVal}, actual ${actVal}`);
        await rceCommandWithRetry(ip, port, password, `zones.editcustomzone "${zoneName}" "${key}" ${expected}`);
      }
    }
    console.log(`[ZorpManager] Verification complete for ${zoneName}`);
  } catch (err) {
    console.error(`[ZorpManager] Error verifying zone ${zoneName}:`, err);
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
    console.log(`[ZorpManager] Zone ${zoneName} saved to DB (status: ${status})`);
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
    console.log(`[ZorpManager] Zone ${zoneName} marked as expired in DB`);
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
    console.log(`[ZorpManager] Loading zones from DB for ${serverName}`);
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
    console.log(`[ZorpManager] Refreshing zones for server ${serverName}`);
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
          console.log(`[ZorpManager] Zone ${zoneName} lastSeen updated`);
        }
      }

      // (Verification moved to a dedicated scheduler to run every 1 minute)
    }
  } catch (error) {
    console.error(`[ZorpManager] Error refreshing zones for ${serverName}:`, error);
  }
}

/**
 * Unified zone updater (scheduled task)
 */
async function runZoneUpdater() {
  try {
    console.log("[ZorpManager] Running zone updater...");
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
 * Verify all zones for all servers (scheduled task)
 */
async function runZoneVerification() {
  try {
    console.log("[ZorpManager] Running scheduled zone verification...");
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
    `);
    for (const server of servers) {
      const zones = getServerZones(server.id);
      for (const zone of zones.values()) {
        await verifyZoneState(server.ip, server.port, server.password, zone.zoneName, desiredZoneState(zone.status));
      }
    }
  } catch (error) {
    console.error("[ZorpManager] Zone verification error:", error);
  }
}

/**
 * Cleanup expired zones
 */
async function runZoneCleanup() {
  try {
    console.log("[ZorpManager] Running zone cleanup...");
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
        console.log(`[ZorpManager] Cleaned up expired zone ${row.name}`);
      }
    }
  } catch (error) {
    console.error(`[ZorpManager] Error in zone cleanup:`, error);
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
    // Load from DB
    for (const server of servers) {
      await loadZonesFromDb(server.id, server.nickname);
    }
    // ✅ Run verification ON BOOT for all zones
    console.log("[ZorpManager] Running initial zone verification on boot...");
    for (const server of servers) {
      const zones = getServerZones(server.id);
      for (const zone of zones.values()) {
        await verifyZoneState(server.ip, server.port, server.password, zone.zoneName, desiredZoneState(zone.status));
      }
    }
    // Start schedulers
    setInterval(runZoneUpdater, UPDATE_INTERVAL_MS);
    setInterval(runZoneCleanup, CLEANUP_INTERVAL_MS);
    setInterval(runZoneVerification, VERIFY_INTERVAL_MS); // ✅ verify every 1 minute
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
  verifyZoneState,
  refreshZonesForServer,
  runZoneUpdater,
  runZoneCleanup,
  runZoneVerification,
  zonesByServer,
  pendingRequests
};