const pool = require('../db');

class PrisonSystem {
  constructor() {
    this.activePrisoners = new Map(); // serverKey -> Set of player names
    this.teleportTimers = new Map(); // playerKey -> timer ID
  }

  /**
   * Check if prison system is enabled for a server
   */
  async isPrisonEnabled(serverId) {
    try {
      const [result] = await pool.query(
        'SELECT enabled FROM prison_configs WHERE server_id = ?',
        [serverId]
      );
      return result.length > 0 && result[0].enabled;
    } catch (error) {
      console.error('Error checking prison system status:', error);
      return false;
    }
  }

  /**
   * Get prison cell coordinates
   */
  async getPrisonCellCoordinates(serverId, cellNumber) {
    try {
      const [result] = await pool.query(
        'SELECT x_pos, y_pos, z_pos FROM prison_positions WHERE server_id = ? AND cell_number = ?',
        [serverId, cellNumber]
      );
      
      if (result.length === 0) {
        return null;
      }
      
      return {
        x: result[0].x_pos,
        y: result[0].y_pos,
        z: result[0].z_pos
      };
    } catch (error) {
      console.error('Error getting prison cell coordinates:', error);
      return null;
    }
  }

  /**
   * Teleport player to prison cell
   */
  async teleportToPrison(ip, port, password, playerName, cellNumber, sendRconCommand) {
    try {
      console.log(`[PRISON DEBUG] Starting teleport for ${playerName} to cell ${cellNumber}`);
      console.log(`[PRISON DEBUG] Server details: ${ip}:${port}`);
      
      // Get server ID from IP/port
      const [serverResult] = await pool.query(
        'SELECT id FROM rust_servers WHERE ip = ? AND port = ?',
        [ip, port]
      );
      
      if (serverResult.length === 0) {
        console.error('[PRISON DEBUG] Server not found for prison teleport');
        return false;
      }
      
      const serverId = serverResult[0].id;
      console.log(`[PRISON DEBUG] Found server ID: ${serverId}`);
      
      // Check if prison system is enabled
      if (!(await this.isPrisonEnabled(serverId))) {
        console.log('[PRISON DEBUG] Prison system is disabled for this server');
        return false;
      }
      
      // Get cell coordinates
      const coords = await this.getPrisonCellCoordinates(serverId, cellNumber);
      if (!coords) {
        console.error(`[PRISON DEBUG] Prison cell ${cellNumber} not found for server ${serverId}`);
        return false;
      }
      
      console.log(`[PRISON DEBUG] Found coordinates for cell ${cellNumber}: x=${coords.x}, y=${coords.y}, z=${coords.z}`);
      
             // Teleport player
       const teleportCommand = `global.teleportposrot "${coords.x},${coords.y},${coords.z}" "${playerName}" "0"`;
      console.log(`[PRISON DEBUG] Sending teleport command: ${teleportCommand}`);
      
      const result = await sendRconCommand(ip, port, password, teleportCommand);
      console.log(`[PRISON DEBUG] Teleport command result:`, result);
      
      console.log(`[PRISON] Successfully teleported ${playerName} to cell ${cellNumber}`);
      return true;
    } catch (error) {
      console.error('[PRISON DEBUG] Error teleporting player to prison:', error);
      console.error('[PRISON DEBUG] Error stack:', error.stack);
      return false;
    }
  }

  /**
   * Add player to prison
   */
  async addPrisoner(serverId, playerName, discordId, cellNumber, sentenceType, sentenceMinutes, sentencedBy, sendRconCommand) {
    try {
      console.log(`[PRISON DEBUG] Adding ${playerName} to prison on server ${serverId}`);
      
      // Calculate release time for temporary sentences
      let releaseTime = null;
      if (sentenceType === 'temporary' && sentenceMinutes) {
        releaseTime = new Date(Date.now() + (sentenceMinutes * 60 * 1000));
      }
      
      // Check if player is already in prison
      const [existingPrisoner] = await pool.query(
        'SELECT * FROM prisoners WHERE server_id = ? AND player_name = ? AND is_active = TRUE',
        [serverId, playerName]
      );
      
      if (existingPrisoner.length > 0) {
        console.log(`[PRISON DEBUG] Player ${playerName} is already in prison, updating record`);
        
        // Update existing prisoner record
        await pool.query(
          `UPDATE prisoners 
           SET cell_number = ?, sentence_type = ?, sentence_minutes = ?, release_time = ?, sentenced_by = ?, sentenced_at = NOW()
           WHERE server_id = ? AND player_name = ? AND is_active = TRUE`,
          [cellNumber, sentenceType, sentenceMinutes, releaseTime, sentencedBy, serverId, playerName]
        );
      } else {
        console.log(`[PRISON DEBUG] Creating new prisoner record for ${playerName}`);
        
        // Insert new prisoner record
        await pool.query(
          `INSERT INTO prisoners (server_id, player_name, discord_id, cell_number, sentence_type, sentence_minutes, release_time, sentenced_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [serverId, playerName, discordId, cellNumber, sentenceType, sentenceMinutes, releaseTime, sentencedBy]
        );
      }
      
             // Add to active prisoners map
       const serverKey = serverId;
       if (!this.activePrisoners.has(serverKey)) {
         this.activePrisoners.set(serverKey, new Set());
       }
       this.activePrisoners.get(serverKey).add(playerName);
       
       // Start monitoring for this prisoner if it's a temporary sentence
       if (sentenceType === 'temporary') {
         // Get server connection details for monitoring
         const [serverResult] = await pool.query(
           'SELECT ip, port, password FROM rust_servers WHERE id = ?',
           [serverId]
         );
         
         if (serverResult.length > 0) {
           const server = serverResult[0];
                       await this.startPrisonerMonitoring(
              serverId,
              playerName,
              cellNumber,
              server.ip,
              server.port,
              server.password,
              sendRconCommand
            );
           console.log(`[PRISON] Started auto-release monitoring for ${playerName} (${sentenceMinutes} minutes)`);
         }
       }
       
       console.log(`[PRISON] Successfully added ${playerName} to prison (${sentenceType})`);
       return true;
    } catch (error) {
      console.error('[PRISON DEBUG] Error adding prisoner:', error);
      return false;
    }
  }

  /**
   * Release player from prison
   */
  async releasePrisoner(serverId, playerName, releasedBy) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      console.log(`[PRISON DEBUG] Releasing ${playerName} from prison on server ${serverId}`);
      
      // First check if the prisoner exists and is active
      const [existingPrisoner] = await connection.query(
        'SELECT * FROM prisoners WHERE server_id = ? AND player_name = ? AND is_active = TRUE',
        [serverId, playerName]
      );
      
      console.log(`[PRISON DEBUG] Found ${existingPrisoner.length} active prisoners for ${playerName}`);
      
      if (existingPrisoner.length === 0) {
        console.log(`[PRISON DEBUG] No active prisoner found for ${playerName} on server ${serverId}`);
        await connection.rollback();
        return false;
      }
      
      console.log(`[PRISON DEBUG] Prisoner record:`, existingPrisoner[0]);
      
      // First, delete any existing inactive records for this player to avoid unique constraint conflicts
      await connection.query(
        `DELETE FROM prisoners 
         WHERE server_id = ? AND player_name = ? AND is_active = FALSE`,
        [serverId, playerName]
      );
      
      // Now update the current record to set it as inactive
      const [updateResult] = await connection.query(
        `UPDATE prisoners 
         SET is_active = FALSE, released_at = NOW() 
         WHERE id = ?`,
        [existingPrisoner[0].id]
      );
      
      console.log(`[PRISON DEBUG] Update result: ${updateResult.affectedRows} rows affected`);
      
      if (updateResult.affectedRows === 0) {
        console.log(`[PRISON DEBUG] No rows were updated - prisoner may have been released already`);
        await connection.rollback();
        return false;
      }
      
      await connection.commit();
      
      // Remove from active prisoners map
      const serverKey = serverId;
      if (this.activePrisoners.has(serverKey)) {
        this.activePrisoners.get(serverKey).delete(playerName);
      }
      
      // Clear any active teleport timers for this player
      const playerKey = `${serverId}_${playerName}`;
      if (this.teleportTimers.has(playerKey)) {
        clearInterval(this.teleportTimers.get(playerKey));
        this.teleportTimers.delete(playerKey);
      }
      
      console.log(`[PRISON] Successfully released ${playerName} from prison`);
      return true;
    } catch (error) {
      console.error('[PRISON DEBUG] Error releasing prisoner:', error);
      console.error('[PRISON DEBUG] Error details:', error.message);
      console.error('[PRISON DEBUG] Error stack:', error.stack);
      
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[PRISON DEBUG] Error rolling back transaction:', rollbackError);
      }
      
      return false;
    } finally {
      connection.release();
    }
  }

  /**
   * Check if player is in prison
   */
  async isPlayerInPrison(serverId, playerName) {
    try {
      const [result] = await pool.query(
        'SELECT * FROM prisoners WHERE server_id = ? AND player_name = ? AND is_active = TRUE',
        [serverId, playerName]
      );
      return result.length > 0;
    } catch (error) {
      console.error('Error checking if player is in prison:', error);
      return false;
    }
  }

  /**
   * Get prisoner information
   */
  async getPrisonerInfo(serverId, playerName) {
    try {
      const [result] = await pool.query(
        'SELECT * FROM prisoners WHERE server_id = ? AND player_name = ? AND is_active = TRUE',
        [serverId, playerName]
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error getting prisoner info:', error);
      return null;
    }
  }

  /**
   * Get all active prisoners for a server
   */
  async getActivePrisoners(serverId) {
    try {
      const [result] = await pool.query(
        'SELECT * FROM prisoners WHERE server_id = ? AND is_active = TRUE ORDER BY sentenced_at DESC',
        [serverId]
      );
      return result;
    } catch (error) {
      console.error('Error getting active prisoners:', error);
      return [];
    }
  }

  /**
   * Start teleport monitoring for a prisoner
   */
  async startPrisonerMonitoring(serverId, playerName, cellNumber, ip, port, password, sendRconCommand) {
    try {
      const playerKey = `${serverId}_${playerName}`;
      
      // Clear any existing timer
      if (this.teleportTimers.has(playerKey)) {
        clearInterval(this.teleportTimers.get(playerKey));
      }
      
      // Set up periodic teleport (every 30 seconds)
      const timerId = setInterval(async () => {
        try {
          // Check if player is still in prison
          const isStillInPrison = await this.isPlayerInPrison(serverId, playerName);
          if (!isStillInPrison) {
            // Player was released, clear timer
            clearInterval(timerId);
            this.teleportTimers.delete(playerKey);
            return;
          }
          
          // Check if temporary sentence has expired
          const prisonerInfo = await this.getPrisonerInfo(serverId, playerName);
          if (prisonerInfo && prisonerInfo.sentence_type === 'temporary' && prisonerInfo.release_time) {
            if (new Date() >= new Date(prisonerInfo.release_time)) {
              // Sentence expired, release player
              await this.releasePrisoner(serverId, playerName, 'System (Time Expired)');
              clearInterval(timerId);
              this.teleportTimers.delete(playerKey);
              
              // Send release message to game
              await sendRconCommand(ip, port, password, `say <color=#FF69B4>[Prison]</color> <color=white>${playerName} has been released from prison!</color>`);
              return;
            }
          }
          
                     // Teleport player to cell
           await this.teleportToPrison(ip, port, password, playerName, cellNumber, sendRconCommand);
        } catch (error) {
          console.error('Error in prisoner monitoring:', error);
        }
      }, 30000); // 30 seconds
      
      this.teleportTimers.set(playerKey, timerId);
      console.log(`[PRISON] Started monitoring for ${playerName}`);
    } catch (error) {
      console.error('Error starting prisoner monitoring:', error);
    }
  }

  /**
   * Stop teleport monitoring for a prisoner
   */
  async stopPrisonerMonitoring(serverId, playerName) {
    try {
      const playerKey = `${serverId}_${playerName}`;
      if (this.teleportTimers.has(playerKey)) {
        clearInterval(this.teleportTimers.get(playerKey));
        this.teleportTimers.delete(playerKey);
        console.log(`[PRISON] Stopped monitoring for ${playerName}`);
      }
    } catch (error) {
      console.error('Error stopping prisoner monitoring:', error);
    }
  }

  /**
   * Create prison zone
   */
  async createPrisonZone(serverId, ip, port, password, sendRconCommand) {
    try {
      // Get prison configuration
      const [configResult] = await pool.query(
        'SELECT zone_position, zone_size, zone_color FROM prison_configs WHERE server_id = ?',
        [serverId]
      );

      if (configResult.length === 0 || !configResult[0].zone_position) {
        console.log('[PRISON ZONE] No zone position configured for server');
        return false;
      }

             const config = configResult[0];
       const [x, y, z] = config.zone_position.split(',').map(coord => parseFloat(coord.trim()));
       const zoneName = `PRISON ZONE`;

       // Create the zone with protective settings:
      // [5] PvP: 1 (enabled - players can fight prisoners)
      // [6] NPC Damage: 1 (enabled - NPCs can damage players)
      // [7] Radiation: 0 (disabled - no radiation damage)
      // [8] Building Damage: 0 (disabled - no raiding prisoners out)
      // [9] Building: 0 (disabled - no building in prison)
      const createZoneCommand = `zones.createcustomzone "${zoneName}" (${x},${y},${z}) 0 Sphere ${config.zone_size} 1 1 0 0 0`;
      console.log(`[PRISON ZONE] Creating zone: ${createZoneCommand}`);
      
      const createResult = await sendRconCommand(ip, port, password, createZoneCommand);
      console.log(`[PRISON ZONE] Create result:`, createResult);

      // Set zone color
      const colorCommand = `zones.editcustomzone "${zoneName}" color ${config.zone_color}`;
      console.log(`[PRISON ZONE] Setting color: ${colorCommand}`);
      
      const colorResult = await sendRconCommand(ip, port, password, colorCommand);
      console.log(`[PRISON ZONE] Color result:`, colorResult);

      // Show zone area
      const showAreaCommand = `zones.editcustomzone "${zoneName}" showarea 1`;
      await sendRconCommand(ip, port, password, showAreaCommand);

      // Enable chat messages
      const showChatMessageCommand = `zones.editcustomzone "${zoneName}" showchatmessage 1`;
      await sendRconCommand(ip, port, password, showChatMessageCommand);

      // Set custom enter message
      const enterMessageCommand = `zones.editcustomzone "${zoneName}" entermessage "{PlayerName} entered the prison."`;
      console.log(`[PRISON ZONE] Setting enter message: ${enterMessageCommand}`);
      const enterMessageResult = await sendRconCommand(ip, port, password, enterMessageCommand);
      console.log(`[PRISON ZONE] Enter message result:`, enterMessageResult);

      // Set custom leave message
      const leaveMessageCommand = `zones.editcustomzone "${zoneName}" leavemessage "{PlayerName} left the prison."`;
      console.log(`[PRISON ZONE] Setting leave message: ${leaveMessageCommand}`);
      const leaveMessageResult = await sendRconCommand(ip, port, password, leaveMessageCommand);
      console.log(`[PRISON ZONE] Leave message result:`, leaveMessageResult);

      // Try alternative message format if the first doesn't work
      if (!enterMessageResult || enterMessageResult.includes('error') || enterMessageResult.includes('failed')) {
        console.log(`[PRISON ZONE] Trying alternative enter message format`);
        const altEnterMessageCommand = `zones.editcustomzone "${zoneName}" entermessage "{PlayerName} entered the prison"`;
        const altEnterResult = await sendRconCommand(ip, port, password, altEnterMessageCommand);
        console.log(`[PRISON ZONE] Alternative enter message result:`, altEnterResult);
      }

      if (!leaveMessageResult || leaveMessageResult.includes('error') || leaveMessageResult.includes('failed')) {
        console.log(`[PRISON ZONE] Trying alternative leave message format`);
        const altLeaveMessageCommand = `zones.editcustomzone "${zoneName}" leavemessage "{PlayerName} left the prison"`;
        const altLeaveResult = await sendRconCommand(ip, port, password, altLeaveMessageCommand);
        console.log(`[PRISON ZONE] Alternative leave message result:`, altLeaveResult);
      }

      // Track the zone in database
      await pool.query(
        'INSERT INTO prison_zones (server_id, zone_name, zone_position, zone_size, zone_color) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE zone_position = VALUES(zone_position), zone_size = VALUES(zone_size), zone_color = VALUES(zone_color)',
        [serverId, zoneName, config.zone_position, config.zone_size, config.zone_color]
      );

      console.log(`[PRISON ZONE] Successfully created prison zone: ${zoneName}`);
      return true;
    } catch (error) {
      console.error('[PRISON ZONE] Error creating prison zone:', error);
      return false;
    }
  }

  /**
   * Delete prison zone
   */
     async deletePrisonZone(serverId, ip, port, password, sendRconCommand) {
     try {
       const zoneName = `PRISON ZONE`;
       
       // Delete the zone from the server
      const deleteCommand = `zones.deletecustomzone "${zoneName}"`;
      console.log(`[PRISON ZONE] Deleting zone: ${deleteCommand}`);
      
      const deleteResult = await sendRconCommand(ip, port, password, deleteCommand);
      console.log(`[PRISON ZONE] Delete result:`, deleteResult);

      // Remove from database
      await pool.query(
        'DELETE FROM prison_zones WHERE server_id = ?',
        [serverId]
      );

      console.log(`[PRISON ZONE] Successfully deleted prison zone: ${zoneName}`);
      return true;
    } catch (error) {
      console.error('[PRISON ZONE] Error deleting prison zone:', error);
      return false;
    }
  }

  /**
   * Initialize prison monitoring for all active prisoners
   */
  async initializePrisonMonitoring(sendRconCommand) {
    try {
      // Restore prison zones for enabled servers
      const [enabledServers] = await pool.query(
        `SELECT pc.server_id, pc.zone_position, pc.zone_size, pc.zone_color, rs.ip, rs.port, rs.password 
         FROM prison_configs pc 
         JOIN rust_servers rs ON pc.server_id = rs.id 
         WHERE pc.enabled = TRUE AND pc.zone_position IS NOT NULL`
      );
      
      for (const server of enabledServers) {
        console.log(`[PRISON ZONE] Restoring zone for server ${server.server_id}`);
        await this.createPrisonZone(server.server_id, server.ip, server.port, server.password, sendRconCommand);
      }
      
      console.log(`[PRISON ZONE] Restored zones for ${enabledServers.length} servers`);
      
      // Initialize prisoner monitoring
      const [result] = await pool.query(
        `SELECT p.*, rs.ip, rs.port, rs.password 
         FROM prisoners p 
         JOIN rust_servers rs ON p.server_id = rs.id 
         WHERE p.is_active = TRUE`
      );
      
      for (const prisoner of result) {
        await this.startPrisonerMonitoring(
          prisoner.server_id,
          prisoner.player_name,
          prisoner.cell_number,
          prisoner.ip,
          prisoner.port,
          prisoner.password,
          sendRconCommand
        );
      }
      
      console.log(`[PRISON] Initialized monitoring for ${result.length} active prisoners`);
    } catch (error) {
      console.error('Error initializing prison monitoring:', error);
    }
  }
}

module.exports = new PrisonSystem();
