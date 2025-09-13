const mysql = require('mysql2/promise');
const pool = require('../db');
const { sendRconCommand } = require('../rcon');

// Configuration
const KOTH_UPDATE_INTERVAL_MS = 5 * 1000; // Update every 5 seconds during active events
const KOTH_CHECK_INTERVAL_MS = 30 * 1000; // Check for events every 30 seconds
const KOTH_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Cleanup every hour

// In-memory tracking
const activeEvents = new Map(); // serverId -> event data
const eventTimers = new Map(); // serverId -> timer reference

/**
 * Initialize KOTH Manager
 */
async function initializeKothManager() {
  try {
    console.log('[KothManager] Initializing KOTH Manager...');
    
    // Create KOTH tables if they don't exist
    await createKothTables();
    
    // Load active events from database
    await loadActiveEvents();
    
    // Start schedulers
    setInterval(checkForEvents, KOTH_CHECK_INTERVAL_MS);
    setInterval(cleanupExpiredEvents, KOTH_CLEANUP_INTERVAL_MS);
    
    console.log('[KothManager] KOTH Manager initialized successfully');
  } catch (error) {
    console.error('[KothManager] Error initializing KOTH Manager:', error);
  }
}

/**
 * Create KOTH database tables
 */
async function createKothTables() {
  try {
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, '../../sql/koth_schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement) {
          try {
            await pool.query(statement);
          } catch (error) {
            // Ignore errors for existing tables
            if (!error.message.includes('already exists')) {
              console.error('[KothManager] Error creating table:', error.message);
            }
          }
        }
      }
      
      console.log('[KothManager] KOTH tables created/verified');
    }
  } catch (error) {
    console.error('[KothManager] Error creating KOTH tables:', error);
  }
}

/**
 * Load active events from database
 */
async function loadActiveEvents() {
  try {
    const [events] = await pool.query(`
      SELECT ke.*, kg.gate_name, kg.x_pos, kg.y_pos, kg.z_pos, kg.zone_size
      FROM koth_events ke
      JOIN koth_gates kg ON ke.gate_id = kg.id
      WHERE ke.status IN ('countdown', 'active')
    `);
    
    for (const event of events) {
      activeEvents.set(event.server_id, event);
      console.log(`[KothManager] Loaded active event: ${event.event_name} on server ${event.server_id}`);
    }
  } catch (error) {
    console.error('[KothManager] Error loading active events:', error);
  }
}

/**
 * Create a new KOTH event
 */
async function createKothEvent(serverId, gateId, options = {}) {
  try {
    const {
      eventName = 'KOTH Event',
      captureTime = 300,
      countdownTime = 60,
      maxParticipants = 50,
      rewardAmount = 1000.00,
      rewardCurrency = 'scrap',
      createdBy = 'System'
    } = options;

    // Check if there's already an active event
    const [existingEvent] = await pool.query(
      'SELECT id FROM koth_events WHERE server_id = ? AND status IN ("countdown", "active")',
      [serverId]
    );

    if (existingEvent.length > 0) {
      throw new Error('There is already an active KOTH event on this server');
    }

    // Get gate information
    const [gateInfo] = await pool.query(
      'SELECT * FROM koth_gates WHERE id = ? AND server_id = ?',
      [gateId, serverId]
    );

    if (gateInfo.length === 0) {
      throw new Error('Invalid gate ID');
    }

    // Create the event
    const [result] = await pool.query(`
      INSERT INTO koth_events (
        server_id, event_name, gate_id, capture_time_seconds, countdown_seconds,
        max_participants, reward_amount, reward_currency, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [serverId, eventName, gateId, captureTime, countdownTime, maxParticipants, rewardAmount, rewardCurrency, createdBy]);

    const eventId = result.insertId;

    // Get the complete event data
    const [eventData] = await pool.query(`
      SELECT ke.*, kg.gate_name, kg.x_pos, kg.y_pos, kg.z_pos, kg.zone_size
      FROM koth_events ke
      JOIN koth_gates kg ON ke.gate_id = kg.id
      WHERE ke.id = ?
    `, [eventId]);

    const event = eventData[0];
    activeEvents.set(serverId, event);

    console.log(`[KothManager] Created KOTH event: ${eventName} on server ${serverId}`);
    return event;
  } catch (error) {
    console.error('[KothManager] Error creating KOTH event:', error);
    throw error;
  }
}

/**
 * Start KOTH event countdown
 */
async function startKothEvent(serverId) {
  try {
    const event = activeEvents.get(serverId);
    if (!event) {
      throw new Error('No active KOTH event found');
    }

    if (event.status !== 'inactive') {
      throw new Error('Event is already started or in progress');
    }

    // Update event status to countdown
    await pool.query(
      'UPDATE koth_events SET status = "countdown", event_start_time = NOW() WHERE id = ?',
      [event.id]
    );

    event.status = 'countdown';
    event.event_start_time = new Date();

    // Start countdown timer
    const countdownTimer = setTimeout(async () => {
      await activateKothEvent(serverId);
    }, event.countdown_seconds * 1000);

    eventTimers.set(serverId, countdownTimer);

    console.log(`[KothManager] Started countdown for KOTH event on server ${serverId}`);
    return event;
  } catch (error) {
    console.error('[KothManager] Error starting KOTH event:', error);
    throw error;
  }
}

/**
 * Activate KOTH event (after countdown)
 */
async function activateKothEvent(serverId) {
  try {
    const event = activeEvents.get(serverId);
    if (!event) {
      return;
    }

    // Update event status to active
    await pool.query(
      'UPDATE koth_events SET status = "active" WHERE id = ?',
      [event.id]
    );

    event.status = 'active';

    // Create zone for the KOTH area
    await createKothZone(serverId, event);

    // Start event monitoring
    startEventMonitoring(serverId);

    console.log(`[KothManager] Activated KOTH event on server ${serverId}`);
  } catch (error) {
    console.error('[KothManager] Error activating KOTH event:', error);
  }
}

/**
 * Create KOTH zone
 */
async function createKothZone(serverId, event) {
  try {
    const [serverInfo] = await pool.query(`
      SELECT rs.ip, rs.port, rs.password
      FROM rust_servers rs
      WHERE rs.id = ?
    `, [serverId]);

    if (serverInfo.length === 0) {
      throw new Error('Server not found');
    }

    const server = serverInfo[0];
    const zoneName = `KOTH_${event.id}`;

    // Create the zone
    await sendRconCommand(server.ip, server.port, server.password, 
      `zones.addcustomzone "${zoneName}" ${event.x_pos} ${event.y_pos} ${event.z_pos} ${event.zone_size}`);

    // Configure zone settings
    await sendRconCommand(server.ip, server.port, server.password, 
      `zones.editcustomzone "${zoneName}" "enabled" 1`);
    await sendRconCommand(server.ip, server.port, server.password, 
      `zones.editcustomzone "${zoneName}" "color" "(255,0,255)"`);
    await sendRconCommand(server.ip, server.port, server.password, 
      `zones.editcustomzone "${zoneName}" "allowpvpdamage" 1`);
    await sendRconCommand(server.ip, server.port, server.password, 
      `zones.editcustomzone "${zoneName}" "allownpcdamage" 1`);
    await sendRconCommand(server.ip, server.port, server.password, 
      `zones.editcustomzone "${zoneName}" "allowbuildingdamage" 0`);
    await sendRconCommand(server.ip, server.port, server.password, 
      `zones.editcustomzone "${zoneName}" "allowbuilding" 0`);

    console.log(`[KothManager] Created KOTH zone: ${zoneName}`);
  } catch (error) {
    console.error('[KothManager] Error creating KOTH zone:', error);
  }
}

/**
 * Start event monitoring
 */
function startEventMonitoring(serverId) {
  const event = activeEvents.get(serverId);
  if (!event) return;

  const monitoringInterval = setInterval(async () => {
    try {
      await checkEventStatus(serverId);
    } catch (error) {
      console.error('[KothManager] Error monitoring event:', error);
    }
  }, KOTH_UPDATE_INTERVAL_MS);

  // Store the interval reference
  if (!event.monitoringInterval) {
    event.monitoringInterval = monitoringInterval;
  }
}

/**
 * Check event status and handle completion
 */
async function checkEventStatus(serverId) {
  try {
    const event = activeEvents.get(serverId);
    if (!event || event.status !== 'active') {
      return;
    }

    // Check if someone is in the zone and for how long
    const currentKing = await checkZoneOccupancy(serverId, event);
    
    if (currentKing && currentKing !== event.current_king) {
      // New king
      event.current_king = currentKing;
      event.king_start_time = new Date();
      
      await pool.query(
        'UPDATE koth_events SET current_king = ?, king_start_time = NOW() WHERE id = ?',
        [currentKing, event.id]
      );
      
      console.log(`[KothManager] New KOTH king: ${currentKing} on server ${serverId}`);
    } else if (currentKing && event.king_start_time) {
      // Check if king has held the zone long enough
      const holdTime = (new Date() - new Date(event.king_start_time)) / 1000;
      
      if (holdTime >= event.capture_time_seconds) {
        await completeKothEvent(serverId, currentKing);
      }
    } else if (!currentKing && event.current_king) {
      // King left the zone
      event.current_king = null;
      event.king_start_time = null;
      
      await pool.query(
        'UPDATE koth_events SET current_king = NULL, king_start_time = NULL WHERE id = ?',
        [event.id]
      );
    }
  } catch (error) {
    console.error('[KothManager] Error checking event status:', error);
  }
}

/**
 * Check zone occupancy
 */
async function checkZoneOccupancy(serverId, event) {
  try {
    const [serverInfo] = await pool.query(`
      SELECT rs.ip, rs.port, rs.password
      FROM rust_servers rs
      WHERE rs.id = ?
    `, [serverId]);

    if (serverInfo.length === 0) {
      return null;
    }

    const server = serverInfo[0];
    const zoneName = `KOTH_${event.id}`;

    // Get players in the zone
    const response = await sendRconCommand(server.ip, server.port, server.password, 
      `zones.customzoneinfo "${zoneName}"`);

    // Parse the response to find players in the zone
    // This is a simplified implementation - you may need to adjust based on your RCON response format
    if (response && response.includes('Players in zone:')) {
      const lines = response.split('\n');
      for (const line of lines) {
        if (line.includes('Players in zone:') && !line.includes('0')) {
          // Extract player name from the line
          const match = line.match(/Players in zone:\s*(\d+)\s*\[([^\]]+)\]/);
          if (match && match[2]) {
            return match[2].trim();
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[KothManager] Error checking zone occupancy:', error);
    return null;
  }
}

/**
 * Complete KOTH event
 */
async function completeKothEvent(serverId, winner) {
  try {
    const event = activeEvents.get(serverId);
    if (!event) {
      return;
    }

    // Update event status
    await pool.query(
      'UPDATE koth_events SET status = "completed", event_end_time = NOW() WHERE id = ?',
      [event.id]
    );

    // Add to history
    await pool.query(`
      INSERT INTO koth_event_history (
        event_id, server_id, event_name, gate_id, winner_name, 
        total_participants, event_duration_seconds, reward_amount, reward_currency,
        event_start_time, event_end_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      event.id, event.server_id, event.event_name, event.gate_id, winner,
      event.max_participants, event.capture_time_seconds, event.reward_amount, event.reward_currency,
      event.event_start_time
    ]);

    // Clean up
    await cleanupKothEvent(serverId);

    console.log(`[KothManager] KOTH event completed. Winner: ${winner} on server ${serverId}`);
  } catch (error) {
    console.error('[KothManager] Error completing KOTH event:', error);
  }
}

/**
 * Clean up KOTH event
 */
async function cleanupKothEvent(serverId) {
  try {
    const event = activeEvents.get(serverId);
    if (!event) {
      return;
    }

    // Clear timers
    if (event.monitoringInterval) {
      clearInterval(event.monitoringInterval);
    }
    
    const timer = eventTimers.get(serverId);
    if (timer) {
      clearTimeout(timer);
      eventTimers.delete(serverId);
    }

    // Remove zone
    const [serverInfo] = await pool.query(`
      SELECT rs.ip, rs.port, rs.password
      FROM rust_servers rs
      WHERE rs.id = ?
    `, [serverId]);

    if (serverInfo.length > 0) {
      const server = serverInfo[0];
      const zoneName = `KOTH_${event.id}`;
      
      try {
        await sendRconCommand(server.ip, server.port, server.password, 
          `zones.deletecustomzone "${zoneName}"`);
      } catch (error) {
        console.error('[KothManager] Error deleting zone:', error);
      }
    }

    // Remove from active events
    activeEvents.delete(serverId);

    console.log(`[KothManager] Cleaned up KOTH event on server ${serverId}`);
  } catch (error) {
    console.error('[KothManager] Error cleaning up KOTH event:', error);
  }
}

/**
 * Join KOTH event
 */
async function joinKothEvent(serverId, playerName, steamId = null) {
  try {
    const event = activeEvents.get(serverId);
    if (!event) {
      throw new Error('No active KOTH event found');
    }

    if (event.status !== 'countdown' && event.status !== 'active') {
      throw new Error('Event is not accepting participants');
    }

    // Check if player is already in the event
    const [existingParticipant] = await pool.query(
      'SELECT id FROM koth_participants WHERE event_id = ? AND player_name = ? AND left_at IS NULL',
      [event.id, playerName]
    );

    if (existingParticipant.length > 0) {
      throw new Error('You are already participating in this event');
    }

    // Check participant limit
    const [participantCount] = await pool.query(
      'SELECT COUNT(*) as count FROM koth_participants WHERE event_id = ? AND left_at IS NULL',
      [event.id]
    );

    if (participantCount[0].count >= event.max_participants) {
      throw new Error('Event is full');
    }

    // Add participant
    await pool.query(`
      INSERT INTO koth_participants (event_id, player_name, player_steam_id)
      VALUES (?, ?, ?)
    `, [event.id, playerName, steamId]);

    // Teleport player to KOTH gate
    await teleportPlayerToKothGate(serverId, playerName, event);

    console.log(`[KothManager] Player ${playerName} joined KOTH event on server ${serverId}`);
    return true;
  } catch (error) {
    console.error('[KothManager] Error joining KOTH event:', error);
    throw error;
  }
}

/**
 * Get KOTH event status
 */
async function getKothEventStatus(serverId) {
  try {
    const event = activeEvents.get(serverId);
    if (!event) {
      return null;
    }

    // Get participant count
    const [participantCount] = await pool.query(
      'SELECT COUNT(*) as count FROM koth_participants WHERE event_id = ? AND left_at IS NULL',
      [event.id]
    );

    return {
      ...event,
      participantCount: participantCount[0].count
    };
  } catch (error) {
    console.error('[KothManager] Error getting KOTH event status:', error);
    return null;
  }
}

/**
 * Remove KOTH event
 */
async function removeKothEvent(serverId) {
  try {
    const event = activeEvents.get(serverId);
    if (!event) {
      throw new Error('No active KOTH event found');
    }

    // Update event status to cancelled
    await pool.query(
      'UPDATE koth_events SET status = "cancelled", event_end_time = NOW() WHERE id = ?',
      [event.id]
    );

    // Clean up
    await cleanupKothEvent(serverId);

    console.log(`[KothManager] Removed KOTH event on server ${serverId}`);
    return true;
  } catch (error) {
    console.error('[KothManager] Error removing KOTH event:', error);
    throw error;
  }
}

/**
 * Check for events (scheduled task)
 */
async function checkForEvents() {
  try {
    // This function can be used for auto-starting events or other scheduled tasks
    // Implementation depends on your specific requirements
  } catch (error) {
    console.error('[KothManager] Error in checkForEvents:', error);
  }
}

/**
 * Cleanup expired events (scheduled task)
 */
async function cleanupExpiredEvents() {
  try {
    // Clean up events that have been running too long
    const [expiredEvents] = await pool.query(`
      SELECT id, server_id FROM koth_events 
      WHERE status = 'active' AND event_start_time < DATE_SUB(NOW(), INTERVAL 2 HOUR)
    `);

    for (const expiredEvent of expiredEvents) {
      await cleanupKothEvent(expiredEvent.server_id);
      await pool.query(
        'UPDATE koth_events SET status = "cancelled", event_end_time = NOW() WHERE id = ?',
        [expiredEvent.id]
      );
    }
  } catch (error) {
    console.error('[KothManager] Error in cleanupExpiredEvents:', error);
  }
}

/**
 * Teleport player to KOTH gate
 */
async function teleportPlayerToKothGate(serverId, playerName, event) {
  try {
    const [serverInfo] = await pool.query(`
      SELECT rs.ip, rs.port, rs.password
      FROM rust_servers rs
      WHERE rs.id = ?
    `, [serverId]);

    if (serverInfo.length === 0) {
      throw new Error('Server not found');
    }

    const server = serverInfo[0];
    
    // Use the same teleport command format as OUTPOST and BANDITCAMP
    const teleportCommand = `global.teleportposrot "${event.x_pos},${event.y_pos},${event.z_pos}" "${playerName}" "1"`;
    
    await sendRconCommand(server.ip, server.port, server.password, teleportCommand);
    
    // Send success message
    await sendRconCommand(server.ip, server.port, server.password, 
      `say <color=#FF69B4>${playerName}</color> <color=white>teleported to</color> <color=#800080>${event.gate_name}</color> <color=white>for KOTH event</color>`);
    
    console.log(`[KothManager] Teleported ${playerName} to ${event.gate_name} at coordinates ${event.x_pos},${event.y_pos},${event.z_pos}`);
  } catch (error) {
    console.error('[KothManager] Error teleporting player to KOTH gate:', error);
    throw error;
  }
}

/**
 * Get KOTH gates for a server
 */
async function getKothGates(serverId) {
  try {
    const [gates] = await pool.query(
      'SELECT * FROM koth_gates WHERE server_id = ? ORDER BY gate_number',
      [serverId]
    );
    return gates;
  } catch (error) {
    console.error('[KothManager] Error getting KOTH gates:', error);
    return [];
  }
}

/**
 * Create KOTH gate
 */
async function createKothGate(serverId, gateNumber, gateName, x, y, z, zoneSize = 50) {
  try {
    await pool.query(`
      INSERT INTO koth_gates (server_id, gate_name, gate_number, x_pos, y_pos, z_pos, zone_size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        gate_name = VALUES(gate_name),
        x_pos = VALUES(x_pos),
        y_pos = VALUES(y_pos),
        z_pos = VALUES(z_pos),
        zone_size = VALUES(zone_size),
        updated_at = CURRENT_TIMESTAMP
    `, [serverId, gateName, gateNumber, x, y, z, zoneSize]);

    console.log(`[KothManager] Created/updated KOTH gate ${gateNumber} for server ${serverId}`);
    return true;
  } catch (error) {
    console.error('[KothManager] Error creating KOTH gate:', error);
    throw error;
  }
}

module.exports = {
  initializeKothManager,
  createKothEvent,
  startKothEvent,
  joinKothEvent,
  getKothEventStatus,
  removeKothEvent,
  getKothGates,
  createKothGate,
  activeEvents,
  eventTimers
};
