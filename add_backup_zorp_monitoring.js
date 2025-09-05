const pool = require('./src/db');

// Backup ZORP monitoring system
// This runs every 5 minutes as a backup to the main 2-minute monitoring

let backupMonitoringActive = false;
let backupMonitoringInterval = null;

async function startBackupZorpMonitoring() {
  if (backupMonitoringActive) {
    console.log('⚠️  Backup ZORP monitoring is already running');
    return;
  }

  console.log('🚀 Starting Backup ZORP Monitoring System...');
  console.log('📋 This runs every 5 minutes as a REDUNDANT SAFETY NET');
  console.log('📋 It will ALWAYS run regardless of 2-minute check status');
  console.log('📋 Purpose: 100% reliability through dual verification');
  
  backupMonitoringActive = true;
  
  // Start the backup monitoring interval
  backupMonitoringInterval = setInterval(async () => {
    try {
      await performBackupZorpCheck();
    } catch (error) {
      console.error('❌ Error in backup ZORP monitoring:', error);
    }
  }, 300000); // 5 minutes = 300,000ms
  
  console.log('✅ Backup ZORP monitoring started (5-minute intervals)');
  console.log('🛡️  This provides redundant verification for maximum reliability');
  
  // Perform immediate check
  await performBackupZorpCheck();
}

async function stopBackupZorpMonitoring() {
  if (!backupMonitoringActive) {
    console.log('⚠️  Backup ZORP monitoring is not running');
    return;
  }

  console.log('🛑 Stopping Backup ZORP Monitoring System...');
  
  if (backupMonitoringInterval) {
    clearInterval(backupMonitoringInterval);
    backupMonitoringInterval = null;
  }
  
  backupMonitoringActive = false;
  console.log('✅ Backup ZORP monitoring stopped');
}

async function performBackupZorpCheck() {
  try {
    console.log('[ZORP BACKUP] Starting backup monitoring check (redundant safety net)...');
    console.log('[ZORP BACKUP] This runs every 5 minutes regardless of 2-minute check status');
    
    // Get all active zones
    const [activeZones] = await pool.query(`
      SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname, g.discord_id as guild_id
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `);

    console.log(`[ZORP BACKUP] Found ${activeZones.length} active zones to verify`);

    let zonesChecked = 0;
    let zonesCorrected = 0;

    for (const zone of activeZones) {
      try {
        const wasCorrected = await checkZoneInBackupMode(zone);
        zonesChecked++;
        if (wasCorrected) {
          zonesCorrected++;
        }
      } catch (error) {
        console.error(`[ZORP BACKUP] Error checking zone ${zone.name}:`, error);
      }
    }

    console.log(`[ZORP BACKUP] Backup verification completed:`);
    console.log(`[ZORP BACKUP]   - Zones checked: ${zonesChecked}`);
    console.log(`[ZORP BACKUP]   - Zones corrected: ${zonesCorrected}`);
    console.log(`[ZORP BACKUP]   - System status: ${zonesCorrected > 0 ? 'CORRECTIONS MADE' : 'ALL ZONES CORRECT'}`);
    
  } catch (error) {
    console.error('[ZORP BACKUP] Error in backup ZORP check:', error);
  }
}

async function checkZoneInBackupMode(zone) {
  try {
    console.log(`[ZORP BACKUP] Verifying zone: ${zone.name} (owner: ${zone.owner}, current state: ${zone.current_state})`);
    
    // Get online players for this server
    const onlinePlayers = await getOnlinePlayersBackup(zone.ip, zone.port, zone.password);
    if (!onlinePlayers) {
      console.log(`[ZORP BACKUP] ⚠️  Could not get online players for ${zone.nickname} - skipping zone verification`);
      console.log(`[ZORP BACKUP] This may indicate server connectivity issues or RCON problems`);
      return false;
    }

    console.log(`[ZORP BACKUP] Online players count: ${onlinePlayers.size}`);
    
    // Check if zone owner is online
    const isOwnerOnline = Array.from(onlinePlayers).some(player => 
      player.toLowerCase() === zone.owner.toLowerCase()
    );

    console.log(`[ZORP BACKUP] Owner ${zone.owner} is ${isOwnerOnline ? 'ONLINE' : 'OFFLINE'}`);

    let zoneWasCorrected = false;

    // Handle zone state based on online status
    if (isOwnerOnline) {
      // Player is online - ensure zone is green
      if (zone.current_state !== 'green') {
        console.log(`[ZORP BACKUP] ⚠️  CORRECTION: Setting zone ${zone.name} to GREEN (owner online but zone was ${zone.current_state})`);
        await setZoneToGreenBackup(zone.ip, zone.port, zone.password, zone.owner);
        
        // Update database
        await pool.query(
          'UPDATE zorp_zones SET current_state = "green" WHERE name = ?',
          [zone.name]
        );
        zoneWasCorrected = true;
      } else {
        console.log(`[ZORP BACKUP] ✅ Zone ${zone.name} is correctly GREEN (owner online)`);
      }
    } else {
      // Player is offline - check if zone should be red
      if (zone.current_state === 'green') {
        console.log(`[ZORP BACKUP] ⚠️  CORRECTION: Setting zone ${zone.name} to YELLOW (owner offline but zone was green)`);
        await setZoneToYellowBackup(zone.ip, zone.port, zone.password, zone.owner);
        
        // Update database
        await pool.query(
          'UPDATE zorp_zones SET current_state = "yellow" WHERE name = ?',
          [zone.name]
        );
        zoneWasCorrected = true;
      } else if (zone.current_state === 'yellow') {
        // Check if enough time has passed to turn red
        const [zoneData] = await pool.query(
          'SELECT created_at, delay FROM zorp_zones WHERE name = ?',
          [zone.name]
        );
        
        if (zoneData.length > 0) {
          const delayMs = zoneData[0].delay * 1000;
          const timeSinceYellow = Date.now() - new Date(zoneData[0].created_at).getTime();
          
          if (timeSinceYellow >= delayMs) {
            console.log(`[ZORP BACKUP] ⚠️  CORRECTION: Setting zone ${zone.name} to RED (delay expired)`);
            await setZoneToRedBackup(zone.ip, zone.port, zone.password, zone.owner);
            
            // Update database
            await pool.query(
              'UPDATE zorp_zones SET current_state = "red" WHERE name = ?',
              [zone.name]
            );
            zoneWasCorrected = true;
          } else {
            console.log(`[ZORP BACKUP] ✅ Zone ${zone.name} is correctly YELLOW (delay still active)`);
          }
        }
      } else if (zone.current_state === 'red') {
        console.log(`[ZORP BACKUP] ✅ Zone ${zone.name} is correctly RED (owner offline)`);
      }
    }
    
    return zoneWasCorrected;
    
  } catch (error) {
    console.error(`[ZORP BACKUP] Error checking zone ${zone.name}:`, error);
    return false;
  }
}

async function getOnlinePlayersBackup(ip, port, password) {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const { sendRconCommand } = require('./src/rcon');
      const response = await sendRconCommand(ip, port, password, 'users');
      
      if (!response) {
        console.log(`[ZORP BACKUP] No response from 'users' command (attempt ${retryCount + 1}/${maxRetries})`);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          continue;
        }
        return null;
      }
      
      const players = new Set();
      const lines = response.split('\n');
      
      // Handle different response formats
      let foundPlayers = false;
      
      for (const line of lines) {
        // Check for standard format: "1. "PlayerName" ..."
        const standardMatch = line.match(/^\s*\d+\.\s+"([^"]+)"\s+/);
        if (standardMatch) {
          players.add(standardMatch[1]);
          foundPlayers = true;
          continue;
        }
        
        // Check for slot format: <slot:"name"> followed by "PlayerName"
        const slotMatch = line.match(/^<slot:"name">\s*$/);
        if (slotMatch) {
          // Next line should contain the player name
          continue;
        }
        
        // Check for quoted player names (from slot format)
        const quotedMatch = line.match(/^"([^"]+)"$/);
        if (quotedMatch) {
          players.add(quotedMatch[1]);
          foundPlayers = true;
          continue;
        }
      }
      
      // If we found players, return them regardless of format
      if (foundPlayers) {
        console.log(`[ZORP BACKUP] Successfully parsed ${players.size} online players via 'users' command`);
        return players;
      }
      
      // If no players found and no "players connected" text, it might be an empty server
      if (!response.includes('players connected') && !response.includes('No players')) {
        console.log(`[ZORP BACKUP] Unexpected response format from 'users' command (attempt ${retryCount + 1}/${maxRetries}): ${response.substring(0, 200)}...`);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          continue;
        }
        return null;
      }
      
      // Empty server response
      console.log(`[ZORP BACKUP] No players online (server empty)`);
      return players;
      
    } catch (error) {
      console.error(`[ZORP BACKUP] Error getting online players with "users" command (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
      retryCount++;
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }
  }
  
  console.error(`[ZORP BACKUP] Failed to get online players after ${maxRetries} attempts`);
  return null;
}

async function setZoneToGreenBackup(ip, port, password, playerName) {
  try {
    const { sendRconCommand } = require('./src/rcon');
    await sendRconCommand(ip, port, password, `zorp.zone "${playerName}" green`);
  } catch (error) {
    console.error('[ZORP BACKUP] Error setting zone to green:', error);
  }
}

async function setZoneToYellowBackup(ip, port, password, playerName) {
  try {
    const { sendRconCommand } = require('./src/rcon');
    await sendRconCommand(ip, port, password, `zorp.zone "${playerName}" yellow`);
  } catch (error) {
    console.error('[ZORP BACKUP] Error setting zone to yellow:', error);
  }
}

async function setZoneToRedBackup(ip, port, password, playerName) {
  try {
    const { sendRconCommand } = require('./src/rcon');
    await sendRconCommand(ip, port, password, `zorp.zone "${playerName}" red`);
  } catch (error) {
    console.error('[ZORP BACKUP] Error setting zone to red:', error);
  }
}

// Export functions for use in main bot
module.exports = {
  startBackupZorpMonitoring,
  stopBackupZorpMonitoring,
  performBackupZorpCheck
};

// Run if called directly
if (require.main === module) {
  console.log('🚀 Starting Backup ZORP Monitoring...');
  startBackupZorpMonitoring()
    .then(() => {
      console.log('✅ Backup ZORP monitoring started successfully');
      console.log('📝 This will run every 5 minutes as a backup to the main monitoring');
      console.log('🛑 Press Ctrl+C to stop');
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping backup monitoring...');
        await stopBackupZorpMonitoring();
        process.exit(0);
      });
    })
    .catch((error) => {
      console.error('❌ Failed to start backup monitoring:', error);
      process.exit(1);
    });
}
