const pool = require('./src/db');
const { sendRconCommand } = require('./src/rcon');

class ZoneRefreshSystem {
  constructor() {
    this.isRunning = false;
    this.refreshInterval = null;
    this.lastRefreshTime = null;
    this.refreshStats = {
      totalZones: 0,
      fixedZones: 0,
      errors: 0,
      lastRun: null
    };
  }

  /**
   * Start the zone refresh system
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Zone refresh system already running');
      return;
    }

    console.log('🚀 Starting Zone Refresh System...');
    console.log('💡 Will run every 5 minutes to keep zones in sync');
    
    this.isRunning = true;
    
    // Run immediately on start
    this.runFullRefresh();
    
    // Then run every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.runFullRefresh();
    }, 5 * 60 * 1000); // 5 minutes
    
    console.log('✅ Zone refresh system started successfully');
  }

  /**
   * Stop the zone refresh system
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Zone refresh system not running');
      return;
    }

    console.log('🛑 Stopping Zone Refresh System...');
    
    this.isRunning = false;
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    console.log('✅ Zone refresh system stopped');
  }

  /**
   * Run a full refresh of all zones
   */
  async runFullRefresh() {
    if (!this.isRunning) return;

    const startTime = Date.now();
    console.log(`\n🔄 [ZONE REFRESH] Starting full zone refresh at ${new Date().toISOString()}`);
    
    try {
      // Get all active zones
      const [zones] = await pool.query(`
        SELECT 
          z.id,
          z.name,
          z.owner,
          z.current_state,
          z.last_online_at,
          z.delay,
          z.expire,
          rs.nickname as server_name,
          rs.ip,
          rs.port,
          rs.password
        FROM zorp_zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
        ORDER BY rs.nickname, z.owner
      `);

      if (zones.length === 0) {
        console.log('📋 No active zones to refresh');
        return;
      }

      console.log(`📋 Found ${zones.length} active zones to refresh`);
      
      // Group zones by server for efficient RCON calls
      const zonesByServer = this.groupZonesByServer(zones);
      
      let totalFixed = 0;
      let totalErrors = 0;

      // Process each server
      for (const [serverKey, serverZones] of Object.entries(zonesByServer)) {
        const server = serverZones[0];
        console.log(`\n🖥️  Processing server: ${server.server_name} (${serverZones.length} zones)`);
        
        try {
          // Get current online players for this server
          const onlinePlayers = await this.getOnlinePlayersForServer(server.ip, server.port, server.password);
          console.log(`   📊 Found ${onlinePlayers.size} online players`);
          
          // Process each zone on this server
          for (const zone of serverZones) {
            try {
              const result = await this.refreshZone(zone, onlinePlayers);
              if (result.fixed) totalFixed++;
            } catch (error) {
              console.error(`   ❌ Error refreshing zone ${zone.name}:`, error.message);
              totalErrors++;
            }
          }
        } catch (error) {
          console.error(`   ❌ Error processing server ${server.server_name}:`, error.message);
          totalErrors++;
        }
      }

      // Update stats
      this.refreshStats = {
        totalZones: zones.length,
        fixedZones: totalFixed,
        errors: totalErrors,
        lastRun: new Date()
      };

      const duration = Date.now() - startTime;
      console.log(`\n✅ [ZONE REFRESH] Completed in ${duration}ms`);
      console.log(`📊 Results: ${totalFixed} zones fixed, ${totalErrors} errors`);
      console.log(`⏰ Next refresh in 5 minutes`);

    } catch (error) {
      console.error('❌ [ZONE REFRESH] Critical error:', error);
      this.refreshStats.errors++;
    }
  }

  /**
   * Group zones by server for efficient processing
   */
  groupZonesByServer(zones) {
    const grouped = {};
    
    zones.forEach(zone => {
      const serverKey = `${zone.server_name}_${zone.ip}_${zone.port}`;
      if (!grouped[serverKey]) {
        grouped[serverKey] = [];
      }
      grouped[serverKey].push(zone);
    });
    
    return grouped;
  }

  /**
   * Get online players for a specific server
   */
  async getOnlinePlayersForServer(ip, port, password) {
    try {
      // Try 'status' command first (most reliable)
      let result = await sendRconCommand(ip, port, password, 'status');
      let players = new Set();
      
      if (result) {
        const lines = result.split('\n');
        for (const line of lines) {
          // Look for lines that contain player info (usually have steam ID)
          if (line.trim() && line.includes('(') && line.includes(')') && !line.includes('died')) {
            const match = line.match(/^([^(]+)/);
            if (match) {
              const playerName = match[1].trim();
              if (playerName && !this.isInvalidPlayerName(playerName)) {
                players.add(playerName.toLowerCase());
              }
            }
          }
        }
      }

      // If 'status' failed, try 'players' as fallback
      if (players.size === 0) {
        result = await sendRconCommand(ip, port, password, 'players');
        if (result) {
          const lines = result.split('\n');
          for (const line of lines) {
            if (line.trim() && line.includes(';') && !line.includes('id ;name')) {
              const parts = line.split(';');
              if (parts.length >= 2) {
                const playerName = parts[1].trim();
                if (playerName && !this.isInvalidPlayerName(playerName)) {
                  players.add(playerName.toLowerCase());
                }
              }
            }
          }
        }
      }

      return players;
    } catch (error) {
      console.error(`Error getting online players for server ${ip}:${port}:`, error.message);
      return new Set();
    }
  }

  /**
   * Check if a player name is invalid
   */
  isInvalidPlayerName(name) {
    const invalidPatterns = [
      'died', 'Generic', '<slot:', '1users', 'id ;name', 'NA ;',
      'status', 'players', '0users', 'users', 'slot:', 'name'
    ];
    
    return invalidPatterns.some(pattern => name.includes(pattern));
  }

  /**
   * Refresh a single zone
   */
  async refreshZone(zone, onlinePlayers) {
    const playerNameLower = zone.owner.toLowerCase();
    const isPlayerOnline = onlinePlayers.has(playerNameLower);
    const currentState = zone.current_state;
    let newState = currentState;
    let fixed = false;
    let reason = '';

    // Determine what the zone state should be
    if (isPlayerOnline) {
      // Player is online - zone should be green
      if (currentState !== 'green') {
        newState = 'green';
        fixed = true;
        reason = `Player ${zone.owner} is online (was ${currentState})`;
      }
    } else {
      // Player is offline - check if zone should be yellow or red
      if (currentState === 'green') {
        // Zone was green but player is offline - should go to yellow
        newState = 'yellow';
        fixed = true;
        reason = `Player ${zone.owner} went offline (was ${currentState})`;
      } else if (currentState === 'yellow') {
        // Check if yellow timer should have expired
        const lastOnline = new Date(zone.last_online_at);
        const delayMs = (zone.delay || 5) * 60 * 1000;
        const shouldBeRed = (Date.now() - lastOnline.getTime()) > delayMs;
        
        if (shouldBeRed) {
          newState = 'red';
          fixed = true;
          reason = `Yellow timer expired for ${zone.owner} (was ${currentState})`;
        }
      }
    }

    // Update zone if state changed
    if (fixed) {
      try {
        await pool.query(
          'UPDATE zorp_zones SET current_state = ?, last_online_at = NOW() WHERE id = ?',
          [newState, zone.id]
        );
        
        console.log(`   🔧 Fixed zone ${zone.name}: ${currentState} → ${newState}`);
        console.log(`      Reason: ${reason}`);
        
        // Update zone color on the server if possible
        await this.updateZoneColorOnServer(zone, newState);
        
      } catch (error) {
        console.error(`   ❌ Failed to update zone ${zone.name}:`, error.message);
        throw error;
      }
    }

    return { fixed, oldState: currentState, newState, reason };
  }

  /**
   * Update zone color on the server
   */
  async updateZoneColorOnServer(zone, newState) {
    try {
      let color;
      let allowBuilding = '1';
      let allowBuildingDamage = '1';
      let allowPvpDamage = '1';

      switch (newState) {
        case 'green':
          color = zone.color_online || '0,255,0';
          break;
        case 'yellow':
          color = zone.color_yellow || '255,255,0';
          break;
        case 'red':
          color = zone.color_offline || '255,0,0';
          allowBuildingDamage = '0';
          break;
        default:
          return; // Don't update unknown states
      }

      // Send RCON commands to update zone
      await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" color (${color})`);
      await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" allowbuilding ${allowBuilding}`);
      await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" allowbuildingdamage ${allowBuildingDamage}`);
      await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" allowpvpdamage ${allowPvpDamage}`);

    } catch (error) {
      console.error(`   ⚠️  Failed to update zone color on server:`, error.message);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get current system status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRefreshTime: this.lastRefreshTime,
      stats: this.refreshStats,
      nextRefreshIn: this.refreshInterval ? '5 minutes' : 'Not scheduled'
    };
  }

  /**
   * Force an immediate refresh
   */
  async forceRefresh() {
    console.log('🔄 [FORCE REFRESH] Manual refresh requested');
    await this.runFullRefresh();
  }
}

// Create and export the system
const zoneRefreshSystem = new ZoneRefreshSystem();

// Auto-start if this file is run directly
if (require.main === module) {
  console.log('🚀 Starting Zone Refresh System (standalone mode)...');
  zoneRefreshSystem.start();
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Zone Refresh System...');
    zoneRefreshSystem.stop();
    process.exit(0);
  });
}

module.exports = zoneRefreshSystem;
