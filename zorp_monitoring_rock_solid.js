const pool = require('./src/db');

// Enhanced concurrency protection with TTL
const processingLocks = new Map();
const WORKER_ID = `worker_${process.pid}_${Date.now()}`;

/**
 * Enhanced lock acquisition with TTL and watchdog
 */
async function acquireZorpLock(serverId) {
  const lockKey = `zorp_${serverId}`;
  
  try {
    // Clean up expired locks first
    await pool.query('DELETE FROM zorp_processing_locks WHERE expires_at < CURRENT_TIMESTAMP');
    
    // Try to acquire lock with TTL
    const [result] = await pool.query(`
      INSERT INTO zorp_processing_locks (server_id, owner_id, locked_at, expires_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL 90 SECOND)
      ON DUPLICATE KEY UPDATE 
        owner_id = VALUES(owner_id),
        locked_at = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + INTERVAL 90 SECOND
    `, [serverId, WORKER_ID]);
    
    if (result.affectedRows > 0) {
      processingLocks.set(lockKey, { timestamp: Date.now(), workerId: WORKER_ID });
      console.log(`[ZORP LOCK] Acquired lock for ${serverId} (worker: ${WORKER_ID})`);
      return true;
    }
    
    // Check if existing lock is stale
    const [existingLock] = await pool.query(`
      SELECT owner_id, locked_at, expires_at 
      FROM zorp_processing_locks 
      WHERE server_id = ? AND expires_at > CURRENT_TIMESTAMP
    `, [serverId]);
    
    if (existingLock.length > 0) {
      const lock = existingLock[0];
      const lockAge = Date.now() - new Date(lock.locked_at).getTime();
      
      if (lockAge > 90000) { // 90 seconds
        console.log(`[ZORP LOCK] Force releasing stale lock for ${serverId} (age: ${lockAge}ms)`);
        await releaseZorpLock(serverId);
        return await acquireZorpLock(serverId); // Retry
      }
    }
    
    console.log(`[ZORP LOCK] Could not acquire lock for ${serverId} - already locked`);
    return false;
    
  } catch (error) {
    console.error(`[ZORP LOCK] Error acquiring lock for ${serverId}:`, error);
    return false;
  }
}

/**
 * Enhanced lock release with owner validation
 */
async function releaseZorpLock(serverId) {
  const lockKey = `zorp_${serverId}`;
  
  try {
    await pool.query(`
      DELETE FROM zorp_processing_locks 
      WHERE server_id = ? AND owner_id = ?
    `, [serverId, WORKER_ID]);
    
    processingLocks.delete(lockKey);
    console.log(`[ZORP LOCK] Released lock for ${serverId} (worker: ${WORKER_ID})`);
  } catch (error) {
    console.error(`[ZORP LOCK] Error releasing lock for ${serverId}:`, error);
  }
}

/**
 * Enhanced player name normalization with platform suffix removal
 */
function normalizePlayerName(playerName) {
  if (!playerName) return '';
  
  let normalized = playerName.toLowerCase().trim();
  
  // Remove platform suffixes
  normalized = normalized.replace(/\s*\(xbox\)$/i, '');
  normalized = normalized.replace(/\s*\(psn\)$/i, '');
  normalized = normalized.replace(/\s*\(steam\)$/i, '');
  normalized = normalized.replace(/\s*\(epic\)$/i, '');
  
  // Remove zero-width characters and invisible unicode
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Collapse multiple spaces into single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized;
}

/**
 * Enhanced online players detection with robust parsing
 */
async function getOnlinePlayersRobust(ip, port, password) {
  const maxRetries = 3;
  let retryCount = 0;
  let backoffMs = 500; // Start with 500ms backoff
  
  while (retryCount < maxRetries) {
    try {
      const { sendRconCommand } = require('./src/rcon');
      const response = await sendRconCommand(ip, port, password, 'users');
      
      if (!response || response.trim() === '') {
        console.log(`[ZORP ROBUST] Empty response from 'users' command (attempt ${retryCount + 1}/${maxRetries})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        backoffMs *= 2; // Exponential backoff
        continue;
      }
      
      const players = new Set();
      const lines = response.split('\n');
      let foundPlayers = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Handle standard format: "1. "PlayerName" ..."
        const standardMatch = trimmedLine.match(/^\s*\d+\.\s+"([^"]+)"\s+/);
        if (standardMatch) {
          const playerName = normalizePlayerName(standardMatch[1]);
          if (playerName) {
            players.add(playerName);
            foundPlayers = true;
          }
          continue;
        }
        
        // Handle quoted format: "PlayerName"
        const quotedMatch = trimmedLine.match(/^"([^"]+)"$/);
        if (quotedMatch) {
          const playerName = normalizePlayerName(quotedMatch[1]);
          if (playerName) {
            players.add(playerName);
            foundPlayers = true;
          }
          continue;
        }
      }
      
      if (foundPlayers) {
        console.log(`[ZORP ROBUST] Successfully parsed ${players.size} online players via 'users' command`);
        return players;
      }
      
      // Check for empty server indicators
      if (response.includes('No players') || response.includes('0 players')) {
        console.log(`[ZORP ROBUST] Server is empty - no players online`);
        return new Set();
      }
      
      console.log(`[ZORP ROBUST] Unexpected response format (attempt ${retryCount + 1}/${maxRetries}): ${response.substring(0, 100)}...`);
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      backoffMs *= 2;
      
    } catch (error) {
      console.error(`[ZORP ROBUST] Error getting online players (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      backoffMs *= 2;
    }
  }
  
  console.log(`[ZORP ROBUST] Failed to get online players after ${maxRetries} attempts`);
  return new Set();
}

/**
 * Enhanced RCON command logging
 */
async function logRconCommand(serverId, zoneId, zoneName, command, success, response = null, attempt = 1) {
  try {
    await pool.query(`
      INSERT INTO zorp_rcon_log (server_id, zone_id, zone_name, command, success, response, attempt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [serverId, zoneId, zoneName, command, success, response, attempt]);
  } catch (error) {
    console.error('Error logging RCON command:', error);
  }
}

/**
 * Idempotent zone state application with retry logic
 */
async function applyZoneStateIdempotent(ip, port, password, serverId, zoneId, zoneName, state, playerName) {
  try {
    const zone = await getZoneById(zoneId);
    if (!zone) {
      console.log(`[ZORP APPLY] Zone ${zoneName} not found`);
      return false;
    }
    
    // Define all commands for the state (idempotent - send all flags every time)
    let commands = [];
    
    switch (state) {
      case 'green':
        commands = [
          `zones.editcustomzone "${zoneName}" allowbuilding 1`,
          `zones.editcustomzone "${zoneName}" allowbuildingdamage 1`,
          `zones.editcustomzone "${zoneName}" allowpvpdamage 1`,
          `zones.editcustomzone "${zoneName}" color (${zone.color_online})`
        ];
        break;
      case 'yellow':
        commands = [
          `zones.editcustomzone "${zoneName}" allowbuilding 1`,
          `zones.editcustomzone "${zoneName}" allowbuildingdamage 0`,
          `zones.editcustomzone "${zoneName}" allowpvpdamage 0`,
          `zones.editcustomzone "${zoneName}" color (${zone.color_yellow})`
        ];
        break;
      case 'red':
        commands = [
          `zones.editcustomzone "${zoneName}" allowbuilding 1`,
          `zones.editcustomzone "${zoneName}" allowbuildingdamage 0`,
          `zones.editcustomzone "${zoneName}" allowpvpdamage 1`,
          `zones.editcustomzone "${zoneName}" color (${zone.color_offline})`
        ];
        break;
    }
    
    // Execute all commands with retry logic
    let allSuccess = true;
    let attempt = 1;
    const maxAttempts = 3;
    
    for (const command of commands) {
      let commandSuccess = false;
      let commandAttempt = 1;
      
      while (commandAttempt <= maxAttempts && !commandSuccess) {
        try {
          const { sendRconCommand } = require('./src/rcon');
          const response = await sendRconCommand(ip, port, password, command);
          
          await logRconCommand(serverId, zoneId, zoneName, command, true, response, commandAttempt);
          commandSuccess = true;
          
        } catch (error) {
          await logRconCommand(serverId, zoneId, zoneName, command, false, error.message, commandAttempt);
          
          if (commandAttempt < maxAttempts) {
            const backoffMs = Math.min(1000 * Math.pow(2, commandAttempt - 1), 5000); // Max 5 seconds
            console.log(`[ZORP APPLY] Command failed, retrying in ${backoffMs}ms: ${command}`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
          
          commandAttempt++;
        }
      }
      
      if (!commandSuccess) {
        allSuccess = false;
        console.error(`[ZORP APPLY] Failed to execute command after ${maxAttempts} attempts: ${command}`);
      }
    }
    
    if (allSuccess) {
      // Update applied_state only after ALL commands succeed
      await pool.query(`
        UPDATE zorp_zones 
        SET applied_state = ?, current_state = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [state, state, zoneId]);
      
      console.log(`[ZORP APPLY] Successfully applied ${state} state to zone ${zoneName}`);
      return true;
    } else {
      console.log(`[ZORP APPLY] Some commands failed for zone ${zoneName}, will retry next cycle`);
      return false;
    }
    
  } catch (error) {
    console.error(`[ZORP APPLY] Error applying zone state:`, error);
    return false;
  }
}

/**
 * Get zone by ID
 */
async function getZoneById(zoneId) {
  try {
    const [result] = await pool.query(`
      SELECT * FROM zorp_zones 
      WHERE id = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
    `, [zoneId]);
    return result[0] || null;
  } catch (error) {
    console.error('Error getting zone by ID:', error);
    return null;
  }
}

/**
 * Check if zone should transition based on offline time
 */
async function shouldTransitionToRed(zoneId) {
  try {
    const [result] = await pool.query(`
      SELECT 
        TIMESTAMPDIFF(MINUTE, last_offline_at, CURRENT_TIMESTAMP) as offline_duration,
        delay
      FROM zorp_zones 
      WHERE id = ? AND last_offline_at IS NOT NULL
    `, [zoneId]);
    
    if (result.length === 0) return false;
    
    const { offline_duration, delay } = result[0];
    return offline_duration >= delay;
  } catch (error) {
    console.error('Error checking transition to red:', error);
    return false;
  }
}

/**
 * Update server primary status
 */
async function updateServerPrimaryStatus(serverId, success) {
  try {
    await pool.query(`
      INSERT INTO zorp_server_status (server_id, last_primary_ok_at, primary_healthy)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        last_primary_ok_at = VALUES(last_primary_ok_at),
        primary_healthy = VALUES(primary_healthy),
        updated_at = CURRENT_TIMESTAMP
    `, [serverId, success ? new Date() : null, success]);
  } catch (error) {
    console.error('Error updating server primary status:', error);
  }
}

/**
 * Check if primary is stale (for backup gating)
 */
async function isPrimaryStale(serverId) {
  try {
    const [result] = await pool.query(`
      SELECT last_primary_ok_at, primary_healthy
      FROM zorp_server_status
      WHERE server_id = ?
    `, [serverId]);
    
    if (result.length === 0) return true; // No primary status = stale
    
    const { last_primary_ok_at, primary_healthy } = result[0];
    if (!primary_healthy) return true;
    
    const staleMs = Date.now() - new Date(last_primary_ok_at).getTime();
    return staleMs > 7 * 60 * 1000; // 7 minutes
  } catch (error) {
    console.error('Error checking primary staleness:', error);
    return true; // Assume stale on error
  }
}

/**
 * Rock-solid ZORP monitoring with all safeguards
 */
async function monitorZorpZonesRockSolid(client, guildId, serverName, ip, port, password, isBackup = false) {
  const serverId = `${guildId}_${serverName}`;
  
  // For backup monitoring, check if primary is stale
  if (isBackup) {
    const primaryStale = await isPrimaryStale(serverId);
    if (!primaryStale) {
      console.log(`[ZORP BACKUP] Skipping ${serverName} - primary is healthy (last ok: ${await getLastPrimaryOk(serverId)})`);
      return;
    }
    console.log(`[ZORP BACKUP] Primary is stale, taking over monitoring for ${serverName}`);
  }
  
  // Acquire processing lock with TTL
  const lockAcquired = await acquireZorpLock(serverId);
  if (!lockAcquired) {
    console.log(`[ZORP ROCK SOLID] Skipping ${serverName} - could not acquire lock`);
    return;
  }
  
  try {
    console.log(`[ZORP ROCK SOLID] Starting rock-solid monitoring for ${serverName} (${isBackup ? 'BACKUP' : 'PRIMARY'})`);
    
    // Get online players with robust parsing
    const onlinePlayers = await getOnlinePlayersRobust(ip, port, password);
    console.log(`[ZORP ROCK SOLID] Online players: ${Array.from(onlinePlayers).join(', ')}`);
    
    // Get all active zones for this server
    const [zones] = await pool.query(`
      SELECT z.*, rs.id as server_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
      AND rs.nickname = ?
      AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [guildId, serverName]);
    
    console.log(`[ZORP ROCK SOLID] Found ${zones.length} active zones to check`);
    
    for (const zone of zones) {
      try {
        const normalizedOwner = normalizePlayerName(zone.owner);
        const isOnline = Array.from(onlinePlayers).some(player => 
          normalizePlayerName(player) === normalizedOwner
        );
        
        console.log(`[ZORP ROCK SOLID] Zone ${zone.name} (owner: ${zone.owner}, normalized: ${normalizedOwner}) - Online: ${isOnline}`);
        
        if (isOnline) {
          // Player is online - should be green
          if (zone.desired_state !== 'green') {
            console.log(`[ZORP ROCK SOLID] Setting zone ${zone.name} to green (player online)`);
            
            // Update timestamps - clear last_offline_at, set last_online_at
            await pool.query(`
              UPDATE zorp_zones 
              SET desired_state = 'green', 
                  last_online_at = CURRENT_TIMESTAMP, 
                  last_offline_at = NULL,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [zone.id]);
            
            // Apply green state
            await applyZoneStateIdempotent(ip, port, password, zone.server_id, zone.id, zone.name, 'green', zone.owner);
          }
        } else {
          // Player is offline - check if we need to transition
          if (zone.desired_state === 'green') {
            // Just went offline - set to yellow (ONLY set last_offline_at once)
            console.log(`[ZORP ROCK SOLID] Player ${zone.owner} went offline, setting zone ${zone.name} to yellow`);
            
            await pool.query(`
              UPDATE zorp_zones 
              SET desired_state = 'yellow', 
                  last_offline_at = COALESCE(last_offline_at, CURRENT_TIMESTAMP),
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [zone.id]);
            
            await applyZoneStateIdempotent(ip, port, password, zone.server_id, zone.id, zone.name, 'yellow', zone.owner);
            
          } else if (zone.desired_state === 'yellow') {
            // Check if should transition to red based on offline time
            const shouldTransition = await shouldTransitionToRed(zone.id);
            if (shouldTransition) {
              console.log(`[ZORP ROCK SOLID] Zone ${zone.name} should transition to red (offline for ${zone.delay} minutes)`);
              
              await pool.query(`
                UPDATE zorp_zones 
                SET desired_state = 'red',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [zone.id]);
              
              await applyZoneStateIdempotent(ip, port, password, zone.server_id, zone.id, zone.name, 'red', zone.owner);
            }
          }
        }
        
        // Check if applied_state matches desired_state (retry loop)
        if (zone.applied_state !== zone.desired_state) {
          console.log(`[ZORP ROCK SOLID] Zone ${zone.name} state mismatch - desired: ${zone.desired_state}, applied: ${zone.applied_state}`);
          await applyZoneStateIdempotent(ip, port, password, zone.server_id, zone.id, zone.name, zone.desired_state, zone.owner);
        }
        
      } catch (error) {
        console.error(`[ZORP ROCK SOLID] Error processing zone ${zone.name}:`, error);
      }
    }
    
    // Update server primary status
    await updateServerPrimaryStatus(serverId, true);
    
    console.log(`[ZORP ROCK SOLID] Completed rock-solid monitoring for ${serverName}`);
    
  } catch (error) {
    console.error(`[ZORP ROCK SOLID] Error in rock-solid monitoring:`, error);
    await updateServerPrimaryStatus(serverId, false);
  } finally {
    // Always release the lock
    await releaseZorpLock(serverId);
  }
}

/**
 * Get last primary OK time
 */
async function getLastPrimaryOk(serverId) {
  try {
    const [result] = await pool.query(`
      SELECT last_primary_ok_at
      FROM zorp_server_status
      WHERE server_id = ?
    `, [serverId]);
    
    return result.length > 0 ? result[0].last_primary_ok_at : 'never';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Health check and stuck zone detector
 */
async function runZorpHealthCheck() {
  try {
    console.log('[ZORP HEALTH] Running health check...');
    
    // Detect stuck zones
    const [stuckZones] = await pool.query(`
      SELECT z.id, z.name, z.desired_state, z.applied_state, z.updated_at
      FROM zorp_zones z
      WHERE z.desired_state != z.applied_state
      AND z.updated_at < CURRENT_TIMESTAMP - INTERVAL 5 MINUTE
    `);
    
    for (const zone of stuckZones) {
      console.log(`[ZORP HEALTH] WARNING: Zone ${zone.name} stuck - desired: ${zone.desired_state}, applied: ${zone.applied_state}`);
      
      // Log health check
      await pool.query(`
        INSERT INTO zorp_health_checks (zone_id, check_type, message, severity)
        VALUES (?, 'stuck_state', ?, 'warning')
        ON DUPLICATE KEY UPDATE
          created_at = CURRENT_TIMESTAMP,
          resolved_at = NULL
      `, [zone.id, `Zone ${zone.name} stuck in desired=${zone.desired_state} applied=${zone.applied_state} for > 5 minutes`]);
    }
    
    // Clean up old health checks
    await pool.query(`
      UPDATE zorp_health_checks 
      SET resolved_at = CURRENT_TIMESTAMP
      WHERE resolved_at IS NULL
      AND created_at < CURRENT_TIMESTAMP - INTERVAL 1 HOUR
    `);
    
    console.log(`[ZORP HEALTH] Health check completed - found ${stuckZones.length} stuck zones`);
    
  } catch (error) {
    console.error('[ZORP HEALTH] Error in health check:', error);
  }
}

module.exports = {
  monitorZorpZonesRockSolid,
  getOnlinePlayersRobust,
  normalizePlayerName,
  applyZoneStateIdempotent,
  shouldTransitionToRed,
  runZorpHealthCheck,
  acquireZorpLock,
  releaseZorpLock
};
