const pool = require('../db');
const { sendRconCommand } = require('../rcon');

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
  async teleportToPrison(ip, port, password, playerName, cellNumber) {
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
      const teleportCommand = `global.teleportposrot "${coords.x},${coords.y},${coords.z}" "${playerName}" "1"`;
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
  async addPrisoner(serverId, playerName, discordId, cellNumber, sentenceType, sentenceMinutes, sentencedBy) {
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
             server.password
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
  async startPrisonerMonitoring(serverId, playerName, cellNumber, ip, port, password) {
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
          await this.teleportToPrison(ip, port, password, playerName, cellNumber);
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
   * Initialize prison monitoring for all active prisoners
   */
  async initializePrisonMonitoring() {
    try {
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
          prisoner.password
        );
      }
      
      console.log(`[PRISON] Initialized monitoring for ${result.length} active prisoners`);
    } catch (error) {
      console.error('Error initializing prison monitoring:', error);
    }
  }
}

module.exports = new PrisonSystem();
