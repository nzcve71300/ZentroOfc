const mysql = require('mysql2/promise');
require('dotenv').config();

// Import RCON functions
let sendRconCommand;
try {
  const rconModule = require('./src/rcon/index.js');
  sendRconCommand = rconModule.sendRconCommand;
} catch (error) {
  console.log('⚠️  RCON module not available, using mock function');
  sendRconCommand = async () => 'mock response';
}

class ImprovedZorpSystem {
  constructor() {
    this.zoneCache = new Map(); // Cache zone states to avoid unnecessary updates
    this.lastRefresh = new Map(); // Track last refresh time per server
    this.refreshInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.isRunning = false;
    
    // Configuration options
    this.config = {
      skipProblematicServers: true, // Skip servers with RCON issues
      maxRconRetries: 2, // Maximum RCON retry attempts
      rconTimeout: 10000, // RCON timeout in milliseconds
      skipServers: [] // List of server nicknames to skip
    };
  }

  /**
   * Start the improved Zorp system
   */
  async start() {
    if (this.isRunning) {
      console.log('🔄 Zorp system already running');
      return;
    }

    console.log('🚀 Starting Improved Zorp System...');
    this.isRunning = true;

    // Initial refresh
    await this.refreshAllZones();

    // Set up periodic refresh
    setInterval(async () => {
      if (this.isRunning) {
        await this.refreshAllZones();
      }
    }, this.refreshInterval);

    console.log(`✅ Zorp system started - refreshing every ${this.refreshInterval / 60000} minutes`);
  }

  /**
   * Stop the Zorp system
   */
  stop() {
    console.log('🛑 Stopping Zorp system...');
    this.isRunning = false;
  }

  /**
   * Main function: Refresh all zones across all servers
   */
  async refreshAllZones() {
    try {
      console.log('\n🔄 [ZORP REFRESH] Starting full zone refresh...');
      const startTime = Date.now();

      // Get all active zones from database
      const zones = await this.getAllActiveZones();
      console.log(`[ZORP REFRESH] Found ${zones.length} active zones to refresh`);

      // Group zones by server for efficient processing
      const zonesByServer = this.groupZonesByServer(zones);

      // Process each server
      for (const [serverId, serverZones] of zonesByServer) {
        await this.refreshZonesOnServer(serverId, serverZones);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [ZORP REFRESH] Full refresh completed in ${duration}ms`);
      
    } catch (error) {
      console.error('❌ [ZORP REFRESH] Error during refresh:', error);
    }
  }

  /**
   * Get all active zones from database
   */
  async getAllActiveZones() {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(`
        SELECT 
          z.id,
          z.name,
          z.owner,
          z.current_state,
          z.created_at,
          z.expire,
          z.server_id,
          rs.ip,
          rs.port,
          rs.password,
          rs.nickname,
          g.discord_id as guild_id
        FROM zorp_zones z
        JOIN rust_servers rs ON z.server_id = rs.id
        JOIN guilds g ON rs.guild_id = g.id
        WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
        ORDER BY z.server_id, z.created_at
      `);
      return result;
    } finally {
      await connection.end();
    }
  }

  /**
   * Group zones by server for efficient processing
   */
  groupZonesByServer(zones) {
    const grouped = new Map();
    for (const zone of zones) {
      if (!grouped.has(zone.server_id)) {
        grouped.set(zone.server_id, []);
      }
      grouped.get(zone.server_id).push(zone);
    }
    return grouped;
  }

  /**
   * Refresh all zones on a specific server
   */
  async refreshZonesOnServer(serverId, zones) {
    if (zones.length === 0) return;

    const server = zones[0]; // Use first zone to get server info
    
    // Check if server should be skipped
    if (this.shouldSkipServer(server)) {
      console.log(`⏭️  [ZORP REFRESH] Skipping problematic server: ${server.nickname}`);
      return;
    }
    
    console.log(`\n🖥️  [ZORP REFRESH] Processing server: ${server.nickname} (${zones.length} zones)`);

    try {
      // Get online players for this server (single RCON call)
      const onlinePlayers = await this.getOnlinePlayers(server.ip, server.port, server.password);
      console.log(`[ZORP REFRESH] Found ${onlinePlayers.size} online players on ${server.nickname}`);

      // Process each zone
      for (const zone of zones) {
        await this.processZone(zone, onlinePlayers, server);
      }

    } catch (error) {
      console.error(`❌ [ZORP REFRESH] Error processing server ${server.nickname}:`, error);
      
      // Mark server as problematic for future skips
      if (this.config.skipProblematicServers) {
        this.config.skipServers.push(server.nickname);
        console.log(`⚠️  Added ${server.nickname} to skip list due to errors`);
      }
    }
  }

  /**
   * Check if a server should be skipped
   */
  shouldSkipServer(server) {
    // Skip if server is in the skip list
    if (this.config.skipServers.includes(server.nickname)) {
      return true;
    }
    
    // Skip if server has had multiple RCON failures
    const failureKey = `failures_${server.nickname}`;
    const failures = this.zoneCache.get(failureKey) || 0;
    
    if (failures >= 3) {
      console.log(`⚠️  Server ${server.nickname} has had ${failures} failures, skipping`);
      return true;
    }
    
    return false;
  }

  /**
   * Process a single zone
   */
  async processZone(zone, onlinePlayers, server) {
    try {
      const cacheKey = `${zone.id}_${zone.current_state}`;
      const lastState = this.zoneCache.get(cacheKey);

      // Skip if zone state hasn't changed and we've processed it recently
      if (lastState && Date.now() - lastState < this.refreshInterval) {
        return;
      }

      console.log(`🏠 [ZORP REFRESH] Processing zone: ${zone.name} (${zone.owner}) - State: ${zone.current_state}`);

      // Check if zone owner is online
      const isOwnerOnline = Array.from(onlinePlayers).some(player => 
        player.toLowerCase() === zone.owner.toLowerCase()
      );

      // Check team status if owner is offline
      let shouldTransition = false;
      if (!isOwnerOnline) {
        const allTeamOffline = await this.checkIfAllTeamMembersOffline(server.ip, server.port, server.password, zone.owner);
        shouldTransition = allTeamOffline;
      }

      // Update zone state based on online status
      if (zone.current_state === 'green' && shouldTransition) {
        await this.transitionZoneToYellow(zone, server);
      } else if (zone.current_state === 'yellow' && shouldTransition) {
        await this.transitionZoneToRed(zone, server);
      } else if (zone.current_state === 'red' && shouldTransition) {
        await this.deleteExpiredZone(zone, server);
      } else if (zone.current_state === 'yellow' && !shouldTransition) {
        // Team came back online, revert to green
        await this.revertZoneToGreen(zone, server);
      }

      // Update cache
      this.zoneCache.set(cacheKey, Date.now());

    } catch (error) {
      console.error(`❌ [ZORP REFRESH] Error processing zone ${zone.name}:`, error);
    }
  }

  /**
   * Get online players from server (optimized)
   */
  async getOnlinePlayers(ip, port, password) {
    try {
      // Try 'players' command first (faster)
      let result = await sendRconCommand(ip, port, password, 'players');
      const players = new Set();

      if (result) {
        const lines = result.split('\n');
        for (const line of lines) {
          if (line.trim() && line.includes('(') && line.includes(')')) {
            const playerName = line.split('(')[0].trim();
            if (playerName && !playerName.includes('died') && !playerName.includes('Generic')) {
              players.add(playerName);
            }
          }
        }
      }

      // Fallback to 'users' command if needed
      if (players.size === 0) {
        result = await sendRconCommand(ip, port, password, 'users');
        if (result) {
          const lines = result.split('\n');
          for (const line of lines) {
            if (line.trim() && line.startsWith('"') && line.endsWith('"')) {
              const playerName = line.trim().replace(/^"|"$/g, '');
              if (playerName && !playerName.includes('died') && !playerName.includes('Generic')) {
                players.add(playerName);
              }
            }
          }
        }
      }

      return players;
    } catch (error) {
      console.error('Error getting online players:', error);
      return new Set();
    }
  }

  /**
   * Check if all team members are offline
   */
  async checkIfAllTeamMembersOffline(ip, port, password, playerName) {
    try {
      // Get player's team info
      const teamInfo = await this.getPlayerTeam(ip, port, password, playerName);
      
      if (!teamInfo || teamInfo.members.length === 0) {
        return true; // No team = consider as "all offline"
      }

      // Get online players
      const onlinePlayers = await this.getOnlinePlayers(ip, port, password);
      
      // Check if any team member is online
      for (const member of teamInfo.members) {
        if (Array.from(onlinePlayers).some(player => 
          player.toLowerCase() === member.toLowerCase()
        )) {
          return false; // At least one team member is online
        }
      }

      return true; // All team members are offline
    } catch (error) {
      console.error('Error checking team offline status:', error);
      return false; // Assume someone is online on error
    }
  }

  /**
   * Get player team information
   */
  async getPlayerTeam(ip, port, password, playerName) {
    try {
      // Try to get team info with a shorter timeout
      const result = await sendRconCommand(ip, port, password, 'oxide.call OxideTeam', 'GetTeam', playerName);
      if (result && result !== 'null') {
        // Parse team data (this will depend on your team plugin)
        // For now, return a simple structure
        return {
          owner: playerName,
          members: [playerName] // Simplified - you'll need to parse the actual response
        };
      }
      return null;
    } catch (error) {
      // If team command fails, assume no team (solo player)
      console.log(`⚠️  Team command failed for ${playerName}, assuming solo player: ${error.message}`);
      return {
        owner: playerName,
        members: [playerName] // Solo player
      };
    }
  }

  /**
   * Transition zone to yellow
   */
  async transitionZoneToYellow(zone, server) {
    try {
      console.log(`🟡 [ZORP REFRESH] Transitioning ${zone.name} to yellow`);
      
      // Try to set zone color to yellow in game
      try {
        await sendRconCommand(server.ip, server.port, server.password, 
          `zones.editcustomzone "${zone.name}" color 255 255 0`
        );
        console.log(`✅ Zone ${zone.name} color set to yellow in game`);
      } catch (rconError) {
        console.log(`⚠️  Could not set zone ${zone.name} color in game (RCON timeout): ${rconError.message}`);
        // Continue with database update even if game update fails
      }

      // Always update database
      const connection = await this.getConnection();
      try {
        await connection.execute(
          'UPDATE zorp_zones SET current_state = ?, last_state_change = CURRENT_TIMESTAMP WHERE id = ?',
          ['yellow', zone.id]
        );
        console.log(`✅ Zone ${zone.name} state updated to yellow in database`);
      } finally {
        await connection.end();
      }

      // Set timer to transition to red
      setTimeout(async () => {
        await this.transitionZoneToRed(zone, server);
      }, 5 * 60 * 1000); // 5 minutes

    } catch (error) {
      console.error(`❌ Error transitioning zone ${zone.name} to yellow:`, error);
    }
  }

  /**
   * Transition zone to red
   */
  async transitionZoneToRed(zone, server) {
    try {
      console.log(`🔴 [ZORP REFRESH] Transitioning ${zone.name} to red`);
      
      // Set zone color to red in game
      await sendRconCommand(server.ip, server.port, server.password, 
        `zones.editcustomzone "${zone.name}" color 255 0 0`
      );

      // Update database
      const connection = await this.getConnection();
      try {
        await connection.execute(
          'UPDATE zorp_zones SET current_state = ?, last_state_change = CURRENT_TIMESTAMP WHERE id = ?',
          ['red', zone.id]
        );
      } finally {
        await connection.end();
      }

      // Set timer to delete zone
      setTimeout(async () => {
        await this.deleteExpiredZone(zone, server);
      }, 5 * 60 * 1000); // 5 minutes

    } catch (error) {
      console.error(`❌ Error transitioning zone ${zone.name} to red:`, error);
    }
  }

  /**
   * Delete expired zone
   */
  async deleteExpiredZone(zone, server) {
    try {
      console.log(`🗑️  [ZORP REFRESH] Deleting expired zone: ${zone.name}`);
      
      // Try to delete zone in game
      try {
        await sendRconCommand(server.ip, server.port, server.password, 
          `zones.delcustomzone "${zone.name}"`
        );
        console.log(`✅ Zone ${zone.name} deleted in game successfully`);
      } catch (rconError) {
        console.log(`⚠️  Could not delete zone ${zone.name} in game (RCON timeout): ${rconError.message}`);
        // Continue with database cleanup even if game deletion fails
      }

      // Always update database to mark zone as deleted
      const connection = await this.getConnection();
      try {
        await connection.execute(
          'UPDATE zorp_zones SET current_state = ?, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['deleted', zone.id]
        );
        console.log(`✅ Zone ${zone.name} marked as deleted in database`);
      } finally {
        await connection.end();
      }

    } catch (error) {
      console.error(`❌ Error deleting zone ${zone.name}:`, error);
    }
  }

  /**
   * Revert zone to green (team came back online)
   */
  async revertZoneToGreen(zone, server) {
    try {
      console.log(`🟢 [ZORP REFRESH] Reverting ${zone.name} to green (team online)`);
      
      // Set zone color to green in game
      await sendRconCommand(server.ip, server.port, server.password, 
        `zones.editcustomzone "${zone.name}" color 0 255 0`
      );

      // Update database
      const connection = await this.getConnection();
      try {
        await connection.execute(
          'UPDATE zorp_zones SET current_state = ?, last_state_change = CURRENT_TIMESTAMP WHERE id = ?',
          ['green', zone.id]
        );
      } finally {
        await connection.end();
      }

    } catch (error) {
      console.error(`❌ Error reverting zone ${zone.name} to green:`, error);
    }
  }

  /**
   * Get database connection
   */
  async getConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });
  }

  /**
   * Manual refresh trigger (for testing)
   */
  async manualRefresh() {
    console.log('🔄 Manual refresh triggered');
    await this.refreshAllZones();
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRefresh: this.lastRefresh,
      zoneCacheSize: this.zoneCache.size,
      refreshInterval: this.refreshInterval,
      skippedServers: this.config.skipServers,
      config: this.config
    };
  }

  /**
   * Reset server failures and skip list
   */
  resetServerFailures() {
    this.config.skipServers = [];
    // Clear failure counts
    for (const [key, value] of this.zoneCache.entries()) {
      if (key.startsWith('failures_')) {
        this.zoneCache.delete(key);
      }
    }
    console.log('✅ Server failures reset, all servers will be processed again');
  }

  /**
   * Add server to skip list
   */
  addServerToSkipList(serverNickname) {
    if (!this.config.skipServers.includes(serverNickname)) {
      this.config.skipServers.push(serverNickname);
      console.log(`⚠️  Added ${serverNickname} to skip list`);
    }
  }

  /**
   * Remove server from skip list
   */
  removeServerFromSkipList(serverNickname) {
    const index = this.config.skipServers.indexOf(serverNickname);
    if (index > -1) {
      this.config.skipServers.splice(index, 1);
      console.log(`✅ Removed ${serverNickname} from skip list`);
    }
  }
}

// Export the class
module.exports = ImprovedZorpSystem;

// If running directly, start the system
if (require.main === module) {
  const zorpSystem = new ImprovedZorpSystem();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Zorp system...');
    zorpSystem.stop();
    process.exit(0);
  });

  // Start the system
  zorpSystem.start().catch(console.error);
}
