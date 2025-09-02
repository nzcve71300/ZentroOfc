const pool = require('../db');

class PlaytimeTracker {
  constructor() {
    this.activeSessions = new Map(); // playerId -> sessionStartTime
  }

  /**
   * Start tracking playtime for a player when they join
   */
  async startSession(playerId, serverId) {
    try {
      const sessionStart = new Date();
      this.activeSessions.set(playerId, sessionStart);

      // Update session_start in database
      await pool.query(
        'UPDATE player_playtime SET session_start = ?, last_online = ? WHERE player_id = ?',
        [sessionStart, sessionStart, playerId]
      );

      console.log(`[PLAYTIME] Started session for player ${playerId}`);
    } catch (error) {
      console.error('Error starting playtime session:', error);
    }
  }

  /**
   * End tracking playtime for a player when they leave
   */
  async endSession(playerId, serverId) {
    try {
      const sessionStart = this.activeSessions.get(playerId);
      if (!sessionStart) {
        console.log(`[PLAYTIME] No active session found for player ${playerId}`);
        return;
      }

      const sessionEnd = new Date();
      const sessionDuration = Math.floor((sessionEnd - sessionStart) / (1000 * 60)); // Convert to minutes

      // Update total playtime in database
      await pool.query(
        'UPDATE player_playtime SET total_minutes = total_minutes + ?, session_start = NULL, last_online = ? WHERE player_id = ?',
        [sessionDuration, sessionEnd, playerId]
      );

      // Remove from active sessions
      this.activeSessions.delete(playerId);

      console.log(`[PLAYTIME] Ended session for player ${playerId}, duration: ${sessionDuration} minutes`);
    } catch (error) {
      console.error('Error ending playtime session:', error);
    }
  }

  /**
   * Get current playtime for a player
   */
  async getPlaytime(playerId) {
    try {
      const [result] = await pool.query(
        'SELECT total_minutes, session_start FROM player_playtime WHERE player_id = ?',
        [playerId]
      );

      if (result.length === 0) {
        return { totalMinutes: 0, currentSession: 0 };
      }

      const playtime = result[0];
      let currentSession = 0;

      // Calculate current session time if player is online
      if (playtime.session_start) {
        const sessionStart = new Date(playtime.session_start);
        const now = new Date();
        currentSession = Math.floor((now - sessionStart) / (1000 * 60));
      }

      return {
        totalMinutes: playtime.total_minutes || 0,
        currentSession: currentSession
      };
    } catch (error) {
      console.error('Error getting playtime:', error);
      return { totalMinutes: 0, currentSession: 0 };
    }
  }

  /**
   * Format playtime for display
   */
  formatPlaytime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  }

  /**
   * Create playtime record for a player if it doesn't exist
   */
  async ensurePlaytimeRecord(playerId) {
    try {
      const [result] = await pool.query(
        'SELECT id FROM player_playtime WHERE player_id = ?',
        [playerId]
      );

      if (result.length === 0) {
        await pool.query(
          'INSERT INTO player_playtime (player_id, total_minutes) VALUES (?, 0)',
          [playerId]
        );
        console.log(`[PLAYTIME] Created playtime record for player ${playerId}`);
      }
    } catch (error) {
      console.error('Error ensuring playtime record:', error);
    }
  }

  /**
   * Get all active sessions (for debugging)
   */
  getActiveSessions() {
    return this.activeSessions;
  }
}

module.exports = PlaytimeTracker;
