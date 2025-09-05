const pool = require('./src/db');

// Concurrency protection - prevent multiple processes from running simultaneously
const processingLocks = new Map();

/**
 * Acquire a processing lock for a server to prevent race conditions
 */
async function acquireProcessingLock(serverId) {
  const lockKey = `zorp_${serverId}`;
  
  // Check if already locked
  if (processingLocks.has(lockKey)) {
    const lock = processingLocks.get(lockKey);
    if (Date.now() - lock.timestamp < 300000) { // 5 minutes
      return false; // Lock still valid
    }
    // Lock expired, remove it
    processingLocks.delete(lockKey);
  }
  
  // Try to acquire lock in database
  try {
    await pool.query(`
      INSERT INTO zorp_processing_locks (server_id, locked_at, expires_at) 
      VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL 5 MINUTE)
      ON DUPLICATE KEY UPDATE 
        locked_at = CURRENT_TIMESTAMP,
        expires_at = CURRENT_TIMESTAMP + INTERVAL 5 MINUTE
    `, [serverId]);
    
    // Set in-memory lock
    processingLocks.set(lockKey, { timestamp: Date.now() });
    return true;
  } catch (error) {
    return false; // Could not acquire lock
  }
}

/**
 * Release a processing lock
 */
async function releaseProcessingLock(serverId) {
  const lockKey = `zorp_${serverId}`;
  
  try {
    await pool.query('DELETE FROM zorp_processing_locks WHERE server_id = ?', [serverId]);
    processingLocks.delete(lockKey);
  } catch (error) {
    console.error('Error releasing processing lock:', error);
  }
}

/**
 * Normalize player name for consistent comparison
 */
function normalizePlayerName(playerName) {
  if (!playerName) return '';
  
  let normalized = playerName.toLowerCase().trim();
  
  // Remove zero-width characters and invisible unicode
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Collapse multiple spaces into single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized;
}

/**
 * Get online players with robust parsing
 */
async function getOnlinePlayersRobust(ip, port, password) {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const { sendRconCommand } = require('./src/rcon');
      const response = await sendRconCommand(ip, port, password, 'users');
      
      if (!response || response.trim() === '') {
        console.log(`[ZORP ROBUST] Empty response from 'users' command (attempt ${retryCount + 1}/${maxRetries})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      const players = new Set();
      const lines = response.split('\n');
      let foundPlayers = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines
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
        
        // Handle slot format: <slot:"name">
        if (trimmedLine.includes('<slot:"name">')) {
          // Look for player names in subsequent lines
          continue;
        }
      }
      
      if (foundPlayers) {
        console.log(`[ZORP ROBUST] Successfully parsed ${players.size} online players via 'users' command`);
        return players;
      }
      
      // If no players found but response exists, might be empty server
      if (response.includes('No players') || response.includes('0 players')) {
        console.log(`[ZORP ROBUST] Server is empty - no players online`);
        return new Set();
      }
      
      console.log(`[ZORP ROBUST] Unexpected response format (attempt ${retryCount + 1}/${maxRetries}): ${response.substring(0, 100)}...`);
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`[ZORP ROBUST] Error getting online players (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`[ZORP ROBUST] Failed to get online players after ${maxRetries} attempts`);
  return new Set();
}

/**
 * Log RCON command for tracking
 */
async function logRconCommand(serverId, zoneName, command, success, response = null) {
  try {
    await pool.query(`
      INSERT INTO zorp_rcon_log (server_id, zone_name, command, success, response)
      VALUES (?, ?, ?, ?, ?)
    `, [serverId, zoneName, command, success, response]);
  } catch (error) {
    console.error('Error logging RCON command:', error);
  }
}

/**
 * Apply zone state with tracking
 */
async function applyZoneState(ip, port, password, serverId, zoneName, state, playerName) {
  try {
    const zone = await getZoneByName(zoneName);
    if (!zone) {
      console.log(`[ZORP APPLY] Zone ${zoneName} not found`);
      return false;
    }
    
    let commands = [];
    let color = '';
    
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
    
    // Execute all commands
    let allSuccess = true;
    for (const command of commands) {
      try {
        const { sendRconCommand } = require('./src/rcon');
        const response = await sendRconCommand(ip, port, password, command);
        await logRconCommand(serverId, zoneName, command, true, response);
      } catch (error) {
        await logRconCommand(serverId, zoneName, command, false, error.message);
        allSuccess = false;
        console.error(`[ZORP APPLY] Failed to execute command: ${command}`, error.message);
      }
    }
    
    if (allSuccess) {
      // Update applied_state only after successful RCON commands
      await pool.query(`
        UPDATE zorp_zones 
        SET applied_state = ?, current_state = ?
        WHERE name = ?
      `, [state, state, zoneName]);
      
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
 * Get zone by name
 */
async function getZoneByName(zoneName) {
  try {
    const [result] = await pool.query(`
      SELECT * FROM zorp_zones 
      WHERE name = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
    `, [zoneName]);
    return result[0] || null;
  } catch (error) {
    console.error('Error getting zone by name:', error);
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
 * Main ZORP monitoring function with all fixes
 */
async function monitorZorpZonesRobust(client, guildId, serverName, ip, port, password) {
  const serverId = `${guildId}_${serverName}`;
  
  // Acquire processing lock
  const lockAcquired = await acquireProcessingLock(serverId);
  if (!lockAcquired) {
    console.log(`[ZORP ROBUST] Skipping ${serverName} - already being processed`);
    return;
  }
  
  try {
    console.log(`[ZORP ROBUST] Starting robust monitoring for ${serverName}`);
    
    // Get online players with robust parsing
    const onlinePlayers = await getOnlinePlayersRobust(ip, port, password);
    console.log(`[ZORP ROBUST] Online players: ${Array.from(onlinePlayers).join(', ')}`);
    
    // Get all active zones for this server
    const [zones] = await pool.query(`
      SELECT z.*, rs.id as server_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE rs.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
      AND rs.nickname = ?
      AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [guildId, serverName]);
    
    console.log(`[ZORP ROBUST] Found ${zones.length} active zones to check`);
    
    for (const zone of zones) {
      try {
        const normalizedOwner = normalizePlayerName(zone.owner);
        const isOnline = Array.from(onlinePlayers).some(player => 
          normalizePlayerName(player) === normalizedOwner
        );
        
        console.log(`[ZORP ROBUST] Zone ${zone.name} (owner: ${zone.owner}, normalized: ${normalizedOwner}) - Online: ${isOnline}`);
        
        if (isOnline) {
          // Player is online - should be green
          if (zone.desired_state !== 'green') {
            console.log(`[ZORP ROBUST] Setting zone ${zone.name} to green (player online)`);
            
            // Update timestamps
            await pool.query(`
              UPDATE zorp_zones 
              SET desired_state = 'green', last_online_at = CURRENT_TIMESTAMP, last_offline_at = NULL
              WHERE id = ?
            `, [zone.id]);
            
            // Apply green state
            await applyZoneState(ip, port, password, zone.server_id, zone.name, 'green', zone.owner);
          }
        } else {
          // Player is offline - check if we need to transition
          if (zone.desired_state === 'green') {
            // Just went offline - set to yellow
            console.log(`[ZORP ROBUST] Player ${zone.owner} went offline, setting zone ${zone.name} to yellow`);
            
            await pool.query(`
              UPDATE zorp_zones 
              SET desired_state = 'yellow', last_offline_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [zone.id]);
            
            await applyZoneState(ip, port, password, zone.server_id, zone.name, 'yellow', zone.owner);
            
          } else if (zone.desired_state === 'yellow') {
            // Check if should transition to red
            const shouldTransition = await shouldTransitionToRed(zone.id);
            if (shouldTransition) {
              console.log(`[ZORP ROBUST] Zone ${zone.name} should transition to red (offline for ${zone.delay} minutes)`);
              
              await pool.query(`
                UPDATE zorp_zones 
                SET desired_state = 'red'
                WHERE id = ?
              `, [zone.id]);
              
              await applyZoneState(ip, port, password, zone.server_id, zone.name, 'red', zone.owner);
            }
          }
        }
        
        // Check if applied_state matches desired_state
        if (zone.applied_state !== zone.desired_state) {
          console.log(`[ZORP ROBUST] Zone ${zone.name} state mismatch - desired: ${zone.desired_state}, applied: ${zone.applied_state}`);
          await applyZoneState(ip, port, password, zone.server_id, zone.name, zone.desired_state, zone.owner);
        }
        
      } catch (error) {
        console.error(`[ZORP ROBUST] Error processing zone ${zone.name}:`, error);
      }
    }
    
    console.log(`[ZORP ROBUST] Completed robust monitoring for ${serverName}`);
    
  } catch (error) {
    console.error(`[ZORP ROBUST] Error in robust monitoring:`, error);
  } finally {
    // Always release the lock
    await releaseProcessingLock(serverId);
  }
}

module.exports = {
  monitorZorpZonesRobust,
  getOnlinePlayersRobust,
  normalizePlayerName,
  applyZoneState,
  shouldTransitionToRed
};
