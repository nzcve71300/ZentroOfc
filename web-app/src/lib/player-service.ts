// Player Management Service
// Handles player data tracking and server-specific statistics

import { db } from './database';

interface Player {
  id: number;
  steam_id: string;
  ign: string;
  first_seen_at: string;
  last_seen_at: string;
}

interface PlayerStats {
  id: number;
  server_id: number;
  player_id: number;
  kills: number;
  deaths: number;
  playtime_minutes: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

interface PlayerBalance {
  id: number;
  server_id: number;
  player_id: number;
  balance: number;
  total_earned: number;
  total_spent: number;
  last_transaction_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PlayerServerData {
  playerId: number;
  steamId: string;
  ign: string;
  serverId: number;
  serverName: string;
  kills: number;
  deaths: number;
  kdRatio: number;
  playtimeMinutes: number;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastActivityAt: string;
}

/**
 * Player Service Class
 * Manages player data and server-specific statistics
 */
export class PlayerService {
  private static instance: PlayerService;

  private constructor() {}

  public static getInstance(): PlayerService {
    if (!PlayerService.instance) {
      PlayerService.instance = new PlayerService();
    }
    return PlayerService.instance;
  }

  /**
   * Get or create a player
   */
  public async getOrCreatePlayer(steamId: string, ign: string): Promise<number> {
    try {
      const result = await db.queryOne<{ player_id: number }>(
        'CALL GetOrCreatePlayer(?, ?)',
        [steamId, ign]
      );
      
      return result?.player_id || 0;
    } catch (error) {
      console.error('Error getting or creating player:', error);
      throw new Error('Failed to get or create player');
    }
  }

  /**
   * Get player by Steam ID
   */
  public async getPlayerBySteamId(steamId: string): Promise<Player | null> {
    try {
      return await db.queryOne<Player>(
        'SELECT * FROM players WHERE steam_id = ?',
        [steamId]
      );
    } catch (error) {
      console.error('Error getting player by Steam ID:', error);
      throw new Error('Failed to retrieve player');
    }
  }

  /**
   * Get player by IGN
   */
  public async getPlayerByIgn(ign: string): Promise<Player | null> {
    try {
      return await db.queryOne<Player>(
        'SELECT * FROM players WHERE ign = ?',
        [ign]
      );
    } catch (error) {
      console.error('Error getting player by IGN:', error);
      throw new Error('Failed to retrieve player');
    }
  }

  /**
   * Update player IGN
   */
  public async updatePlayerIgn(steamId: string, newIgn: string): Promise<void> {
    try {
      await db.query(
        'UPDATE players SET ign = ?, last_seen_at = NOW() WHERE steam_id = ?',
        [newIgn, steamId]
      );
    } catch (error) {
      console.error('Error updating player IGN:', error);
      throw new Error('Failed to update player IGN');
    }
  }

  /**
   * Get player stats for a specific server
   */
  public async getPlayerStats(serverId: number, playerId: number): Promise<PlayerStats | null> {
    try {
      return await db.queryOne<PlayerStats>(
        'SELECT * FROM player_stats WHERE server_id = ? AND player_id = ?',
        [serverId, playerId]
      );
    } catch (error) {
      console.error('Error getting player stats:', error);
      throw new Error('Failed to retrieve player stats');
    }
  }

  /**
   * Update player stats
   */
  public async updatePlayerStats(
    serverId: number,
    playerId: number,
    kills: number,
    deaths: number,
    playtimeMinutes: number
  ): Promise<void> {
    try {
      await db.query(
        'CALL UpdatePlayerStats(?, ?, ?, ?, ?)',
        [serverId, playerId, kills, deaths, playtimeMinutes]
      );
    } catch (error) {
      console.error('Error updating player stats:', error);
      throw new Error('Failed to update player stats');
    }
  }

  /**
   * Increment player kills
   */
  public async incrementKills(serverId: number, playerId: number): Promise<void> {
    try {
      await db.query(
        'UPDATE player_stats SET kills = kills + 1, last_activity_at = NOW() WHERE server_id = ? AND player_id = ?',
        [serverId, playerId]
      );
    } catch (error) {
      console.error('Error incrementing kills:', error);
      throw new Error('Failed to increment kills');
    }
  }

  /**
   * Increment player deaths
   */
  public async incrementDeaths(serverId: number, playerId: number): Promise<void> {
    try {
      await db.query(
        'UPDATE player_stats SET deaths = deaths + 1, last_activity_at = NOW() WHERE server_id = ? AND player_id = ?',
        [serverId, playerId]
      );
    } catch (error) {
      console.error('Error incrementing deaths:', error);
      throw new Error('Failed to increment deaths');
    }
  }

  /**
   * Get player balance for a specific server
   */
  public async getPlayerBalance(serverId: number, playerId: number): Promise<PlayerBalance | null> {
    try {
      return await db.queryOne<PlayerBalance>(
        'SELECT * FROM player_balances WHERE server_id = ? AND player_id = ?',
        [serverId, playerId]
      );
    } catch (error) {
      console.error('Error getting player balance:', error);
      throw new Error('Failed to retrieve player balance');
    }
  }

  /**
   * Update player balance
   */
  public async updatePlayerBalance(
    serverId: number,
    playerId: number,
    balance: number,
    earned: number = 0,
    spent: number = 0
  ): Promise<void> {
    try {
      await db.query(
        'CALL UpdatePlayerBalance(?, ?, ?, ?, ?)',
        [serverId, playerId, balance, earned, spent]
      );
    } catch (error) {
      console.error('Error updating player balance:', error);
      throw new Error('Failed to update player balance');
    }
  }

  /**
   * Add to player balance
   */
  public async addToBalance(serverId: number, playerId: number, amount: number): Promise<void> {
    try {
      await db.query(
        'UPDATE player_balances SET balance = balance + ?, total_earned = total_earned + ?, last_transaction_at = NOW() WHERE server_id = ? AND player_id = ?',
        [amount, amount, serverId, playerId]
      );
    } catch (error) {
      console.error('Error adding to balance:', error);
      throw new Error('Failed to add to balance');
    }
  }

  /**
   * Subtract from player balance
   */
  public async subtractFromBalance(serverId: number, playerId: number, amount: number): Promise<void> {
    try {
      await db.query(
        'UPDATE player_balances SET balance = balance - ?, total_spent = total_spent + ?, last_transaction_at = NOW() WHERE server_id = ? AND player_id = ?',
        [amount, amount, serverId, playerId]
      );
    } catch (error) {
      console.error('Error subtracting from balance:', error);
      throw new Error('Failed to subtract from balance');
    }
  }

  /**
   * Get all players for a server with their stats and balances
   */
  public async getServerPlayers(serverId: number): Promise<PlayerServerData[]> {
    try {
      const players = await db.query<PlayerServerData>(
        'SELECT * FROM player_server_stats WHERE server_id = ? ORDER BY last_activity_at DESC',
        [serverId]
      );
      
      return players;
    } catch (error) {
      console.error('Error getting server players:', error);
      throw new Error('Failed to retrieve server players');
    }
  }

  /**
   * Get top players by kills for a server
   */
  public async getTopPlayersByKills(serverId: number, limit: number = 10): Promise<PlayerServerData[]> {
    try {
      const players = await db.query<PlayerServerData>(
        'SELECT * FROM player_server_stats WHERE server_id = ? ORDER BY kills DESC LIMIT ?',
        [serverId, limit]
      );
      
      return players;
    } catch (error) {
      console.error('Error getting top players by kills:', error);
      throw new Error('Failed to retrieve top players');
    }
  }

  /**
   * Get top players by balance for a server
   */
  public async getTopPlayersByBalance(serverId: number, limit: number = 10): Promise<PlayerServerData[]> {
    try {
      const players = await db.query<PlayerServerData>(
        'SELECT * FROM player_server_stats WHERE server_id = ? ORDER BY balance DESC LIMIT ?',
        [serverId, limit]
      );
      
      return players;
    } catch (error) {
      console.error('Error getting top players by balance:', error);
      throw new Error('Failed to retrieve top players by balance');
    }
  }

  /**
   * Get player leaderboard for a server
   */
  public async getPlayerLeaderboard(serverId: number, sortBy: 'kills' | 'balance' | 'kd_ratio' = 'kills', limit: number = 10): Promise<PlayerServerData[]> {
    try {
      let orderBy: string;
      switch (sortBy) {
        case 'kills':
          orderBy = 'kills DESC';
          break;
        case 'balance':
          orderBy = 'balance DESC';
          break;
        case 'kd_ratio':
          orderBy = 'kd_ratio DESC';
          break;
        default:
          orderBy = 'kills DESC';
      }

      const players = await db.query<PlayerServerData>(
        `SELECT * FROM player_server_stats WHERE server_id = ? ORDER BY ${orderBy} LIMIT ?`,
        [serverId, limit]
      );
      
      return players;
    } catch (error) {
      console.error('Error getting player leaderboard:', error);
      throw new Error('Failed to retrieve player leaderboard');
    }
  }

  /**
   * Get player activity summary
   */
  public async getPlayerActivitySummary(serverId: number, hours: number = 24): Promise<{
    totalPlayers: number;
    activePlayers: number;
    newPlayers: number;
    averageKills: number;
    averageDeaths: number;
    totalPlaytime: number;
  }> {
    try {
      const summary = await db.queryOne<{
        total_players: number;
        active_players: number;
        new_players: number;
        avg_kills: number;
        avg_deaths: number;
        total_playtime: number;
      }>(
        `SELECT 
          COUNT(DISTINCT ps.player_id) as total_players,
          COUNT(DISTINCT CASE WHEN ps.last_activity_at > DATE_SUB(NOW(), INTERVAL ? HOUR) THEN ps.player_id END) as active_players,
          COUNT(DISTINCT CASE WHEN ps.created_at > DATE_SUB(NOW(), INTERVAL ? HOUR) THEN ps.player_id END) as new_players,
          AVG(ps.kills) as avg_kills,
          AVG(ps.deaths) as avg_deaths,
          SUM(ps.playtime_minutes) as total_playtime
        FROM player_stats ps 
        WHERE ps.server_id = ?`,
        [hours, hours, serverId]
      );

      return {
        totalPlayers: summary?.total_players || 0,
        activePlayers: summary?.active_players || 0,
        newPlayers: summary?.new_players || 0,
        averageKills: Math.round(summary?.avg_kills || 0),
        averageDeaths: Math.round(summary?.avg_deaths || 0),
        totalPlaytime: summary?.total_playtime || 0
      };
    } catch (error) {
      console.error('Error getting player activity summary:', error);
      throw new Error('Failed to retrieve player activity summary');
    }
  }

  /**
   * Search players by name
   */
  public async searchPlayers(query: string, serverId?: number): Promise<PlayerServerData[]> {
    try {
      let sql = 'SELECT * FROM player_server_stats WHERE ign LIKE ?';
      const params: any[] = [`%${query}%`];

      if (serverId) {
        sql += ' AND server_id = ?';
        params.push(serverId);
      }

      sql += ' ORDER BY last_activity_at DESC LIMIT 20';

      const players = await db.query<PlayerServerData>(sql, params);
      return players;
    } catch (error) {
      console.error('Error searching players:', error);
      throw new Error('Failed to search players');
    }
  }

  /**
   * Get player history (recent events)
   */
  public async getPlayerHistory(serverId: number, playerId: number, limit: number = 50): Promise<any[]> {
    try {
      const events = await db.query(
        `SELECT event_type, event_data, created_at 
         FROM server_events 
         WHERE server_id = ? AND player_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [serverId, playerId, limit]
      );

      return events;
    } catch (error) {
      console.error('Error getting player history:', error);
      throw new Error('Failed to retrieve player history');
    }
  }

  /**
   * Initialize player data for a new server connection
   */
  public async initializePlayerForServer(serverId: number, playerId: number): Promise<void> {
    try {
      // Initialize player stats if not exists
      await db.query(
        'INSERT IGNORE INTO player_stats (server_id, player_id, kills, deaths, playtime_minutes) VALUES (?, ?, 0, 0, 0)',
        [serverId, playerId]
      );

      // Initialize player balance if not exists
      await db.query(
        'INSERT IGNORE INTO player_balances (server_id, player_id, balance, total_earned, total_spent) VALUES (?, ?, 1000.00, 0, 0)',
        [serverId, playerId]
      );
    } catch (error) {
      console.error('Error initializing player for server:', error);
      throw new Error('Failed to initialize player for server');
    }
  }
}

// Export singleton instance
export const playerService = PlayerService.getInstance();
