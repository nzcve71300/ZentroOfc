// RCON Bot Implementation for Rust Server Management
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { db, encryption } from './database';

// RCON message interfaces
interface RconCommand {
  Identifier: number;
  Message: string;
  Name: string;
}

interface RconResponse {
  Identifier: number;
  Message: string;
  Name: string;
}

interface ServerConnection {
  id: number;
  name: string;
  ip: string;
  port: number;
  password: string;
  ws: WebSocket | null;
  isConnected: boolean;
  lastPing: number;
  commandId: number;
  pendingCommands: Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>;
}

interface PlayerInfo {
  steamId: string;
  name: string;
  connected: boolean;
  ping: number;
  address: string;
}

interface ServerInfo {
  hostname: string;
  version: string;
  map: string;
  maxplayers: number;
  players: number;
  queued: number;
  joining: number;
  entitycount: number;
  fps: number;
  memory: number;
  collections: number;
  networkin: number;
  networkout: number;
  uptime: number;
  frametime: number;
  memory_managed: number;
  gc_memory: number;
  memory_total_system: number;
  memory_total_physical: number;
  fps_avg: number;
  fps_min: number;
  fps_max: number;
  entities: number;
  clients: number;
  steamid: string;
  ownerid: string;
  os: string;
  protocol: string;
}

/**
 * RCON Bot Class
 * Manages WebSocket connections to multiple Rust servers
 */
export class RconBot extends EventEmitter {
  private connections: Map<number, ServerConnection> = new Map();
  private reconnectIntervals: Map<number, NodeJS.Timeout> = new Map();
  private pingIntervals: Map<number, NodeJS.Timeout> = new Map();
  private isShuttingDown = false;

  constructor() {
    super();
    this.setupGracefulShutdown();
  }

  /**
   * Connect to a Rust server via RCON
   */
  public async connectToServer(serverId: number, name: string, ip: string, port: number, encryptedPassword: string): Promise<boolean> {
    try {
      // Decrypt the RCON password
      const password = encryption.decrypt(encryptedPassword);
      
      // Create connection object
      const connection: ServerConnection = {
        id: serverId,
        name,
        ip,
        port,
        password,
        ws: null,
        isConnected: false,
        lastPing: Date.now(),
        commandId: 1,
        pendingCommands: new Map()
      };

      this.connections.set(serverId, connection);
      
      // Attempt to connect
      await this.establishConnection(serverId);
      
      // Update database connection status
      await this.updateServerConnectionStatus(serverId, 'connected');
      
      console.log(`✅ Connected to RCON: ${name} (${ip}:${port})`);
      this.emit('serverConnected', { serverId, name, ip, port });
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to ${name} (${ip}:${port}):`, error);
      await this.updateServerConnectionStatus(serverId, 'error');
      this.emit('serverConnectionError', { serverId, name, ip, port, error });
      return false;
    }
  }

  /**
   * Establish WebSocket connection to a server
   */
  private async establishConnection(serverId: number): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server connection ${serverId} not found`);
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://${connection.ip}:${connection.port}/${connection.password}`;
      console.log(`Connecting to RCON: ${connection.name} (${wsUrl})`);

      const ws = new WebSocket(wsUrl, {
        handshakeTimeout: 10000,
        perMessageDeflate: false
      });

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
          reject(new Error('Connection timeout'));
        }
      }, 10000);

      ws.on('open', () => {
        clearTimeout(connectionTimeout);
        connection.ws = ws;
        connection.isConnected = true;
        connection.lastPing = Date.now();
        
        // Start ping interval
        this.startPingInterval(serverId);
        
        resolve();
      });

      ws.on('message', (data: Buffer) => {
        this.handleServerMessage(serverId, data);
      });

      ws.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.error(`[${connection.name}] RCON error:`, error.message);
        connection.isConnected = false;
        reject(error);
      });

      ws.on('close', (code, reason) => {
        clearTimeout(connectionTimeout);
        console.log(`[${connection.name}] RCON connection closed: ${code} ${reason}`);
        connection.isConnected = false;
        connection.ws = null;
        
        // Clear pending commands
        this.clearPendingCommands(serverId);
        
        // Stop ping interval
        this.stopPingInterval(serverId);
        
        // Attempt reconnection if not shutting down
        if (!this.isShuttingDown) {
          this.scheduleReconnection(serverId);
        }
        
        this.emit('serverDisconnected', { serverId, name: connection.name, code, reason });
      });
    });
  }

  /**
   * Send a command to the server
   */
  public async sendCommand(serverId: number, command: string, timeout: number = 10000): Promise<string> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.isConnected || !connection.ws) {
      throw new Error(`No active connection to server ${serverId}`);
    }

    return new Promise((resolve, reject) => {
      const commandId = connection.commandId++;
      const commandData: RconCommand = {
        Identifier: commandId,
        Message: command,
        Name: 'WebRcon'
      };

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        connection.pendingCommands.delete(commandId);
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      // Store pending command
      connection.pendingCommands.set(commandId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      // Send command
      try {
        connection.ws.send(JSON.stringify(commandData));
      } catch (error) {
        connection.pendingCommands.delete(commandId);
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming server messages
   */
  private handleServerMessage(serverId: number, data: Buffer): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    try {
      const response: RconResponse = JSON.parse(data.toString());
      
      // Handle command responses
      if (connection.pendingCommands.has(response.Identifier)) {
        const pendingCommand = connection.pendingCommands.get(response.Identifier);
        if (pendingCommand) {
          clearTimeout(pendingCommand.timeout);
          connection.pendingCommands.delete(response.Identifier);
          pendingCommand.resolve(response.Message);
        }
        return;
      }

      // Handle server events
      this.processServerEvent(serverId, response.Message);
      
    } catch (error) {
      console.error(`[${connection.name}] Error parsing message:`, error);
    }
  }

  /**
   * Process server events and update database
   */
  private async processServerEvent(serverId: number, message: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    try {
      // Player join detection
      const joinMatch = message.match(/(\w+) has entered the game/);
      if (joinMatch) {
        const playerName = joinMatch[1];
        console.log(`[${connection.name}] Player joined: ${playerName}`);
        
        // Get player info and update database
        await this.handlePlayerJoin(serverId, playerName);
        return;
      }

      // Player leave detection
      const leaveMatch = message.match(/(\w+) has left the game/);
      if (leaveMatch) {
        const playerName = leaveMatch[1];
        console.log(`[${connection.name}] Player left: ${playerName}`);
        
        await this.handlePlayerLeave(serverId, playerName);
        return;
      }

      // Kill detection
      const killMatch = message.match(/(\w+) was killed by (\w+)/);
      if (killMatch) {
        const victim = killMatch[1];
        const killer = killMatch[2];
        console.log(`[${connection.name}] Kill: ${killer} killed ${victim}`);
        
        await this.handlePlayerKill(serverId, killer, victim);
        return;
      }

      // Chat messages
      const chatMatch = message.match(/\[CHAT\] (\w+): (.+)/);
      if (chatMatch) {
        const playerName = chatMatch[1];
        const chatMessage = chatMatch[2];
        console.log(`[${connection.name}] Chat: ${playerName}: ${chatMessage}`);
        
        await this.handleChatMessage(serverId, playerName, chatMessage);
        return;
      }

      // Log other events
      await this.logServerEvent(serverId, 'server_command', { message });
      
    } catch (error) {
      console.error(`[${connection.name}] Error processing server event:`, error);
    }
  }

  /**
   * Handle player join event
   */
  private async handlePlayerJoin(serverId: number, playerName: string): Promise<void> {
    try {
      // Get player info from server
      const playersInfo = await this.sendCommand(serverId, 'players');
      const playerData = this.parsePlayersInfo(playersInfo, playerName);
      
      if (playerData) {
        // Get or create player in database
        const playerId = await this.getOrCreatePlayer(playerData.steamId, playerName);
        
        // Update player stats
        await this.updatePlayerStats(serverId, playerId, 0, 0, 0);
        
        // Initialize player balance if not exists
        await this.initializePlayerBalance(serverId, playerId);
        
        // Log event
        await this.logServerEvent(serverId, 'player_join', {
          playerId,
          playerName,
          steamId: playerData.steamId
        });
        
        this.emit('playerJoin', { serverId, playerId, playerName, steamId: playerData.steamId });
      }
    } catch (error) {
      console.error(`Error handling player join for ${playerName}:`, error);
    }
  }

  /**
   * Handle player leave event
   */
  private async handlePlayerLeave(serverId: number, playerName: string): Promise<void> {
    try {
      // Find player in database
      const player = await db.queryOne<{ id: number }>(
        'SELECT id FROM players WHERE ign = ?',
        [playerName]
      );
      
      if (player) {
        // Log event
        await this.logServerEvent(serverId, 'player_leave', {
          playerId: player.id,
          playerName
        });
        
        this.emit('playerLeave', { serverId, playerId: player.id, playerName });
      }
    } catch (error) {
      console.error(`Error handling player leave for ${playerName}:`, error);
    }
  }

  /**
   * Handle player kill event
   */
  private async handlePlayerKill(serverId: number, killerName: string, victimName: string): Promise<void> {
    try {
      // Get both players
      const killer = await db.queryOne<{ id: number }>('SELECT id FROM players WHERE ign = ?', [killerName]);
      const victim = await db.queryOne<{ id: number }>('SELECT id FROM players WHERE ign = ?', [victimName]);
      
      if (killer && victim) {
        // Update killer's kills
        await db.query(
          'UPDATE player_stats SET kills = kills + 1, last_activity_at = NOW() WHERE server_id = ? AND player_id = ?',
          [serverId, killer.id]
        );
        
        // Update victim's deaths
        await db.query(
          'UPDATE player_stats SET deaths = deaths + 1, last_activity_at = NOW() WHERE server_id = ? AND player_id = ?',
          [serverId, victim.id]
        );
        
        // Log event
        await this.logServerEvent(serverId, 'player_kill', {
          killerId: killer.id,
          killerName,
          victimId: victim.id,
          victimName
        });
        
        this.emit('playerKill', { 
          serverId, 
          killerId: killer.id, 
          killerName, 
          victimId: victim.id, 
          victimName 
        });
      }
    } catch (error) {
      console.error(`Error handling player kill: ${killerName} killed ${victimName}:`, error);
    }
  }

  /**
   * Handle chat message event
   */
  private async handleChatMessage(serverId: number, playerName: string, message: string): Promise<void> {
    try {
      const player = await db.queryOne<{ id: number }>('SELECT id FROM players WHERE ign = ?', [playerName]);
      
      if (player) {
        await this.logServerEvent(serverId, 'chat_message', {
          playerId: player.id,
          playerName,
          message
        });
        
        this.emit('chatMessage', { serverId, playerId: player.id, playerName, message });
      }
    } catch (error) {
      console.error(`Error handling chat message from ${playerName}:`, error);
    }
  }

  /**
   * Parse players info from server response
   */
  private parsePlayersInfo(playersInfo: string, targetPlayerName: string): PlayerInfo | null {
    const lines = playersInfo.split('\n');
    
    for (const line of lines) {
      if (line.includes(targetPlayerName)) {
        // Parse player info (format may vary by server)
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          return {
            steamId: parts[0],
            name: parts[1],
            connected: true,
            ping: parseInt(parts[2]) || 0,
            address: parts[3] || ''
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Get or create player in database
   */
  private async getOrCreatePlayer(steamId: string, ign: string): Promise<number> {
    const result = await db.queryOne<{ player_id: number }>(
      'CALL GetOrCreatePlayer(?, ?)',
      [steamId, ign]
    );
    
    return result?.player_id || 0;
  }

  /**
   * Update player stats
   */
  private async updatePlayerStats(serverId: number, playerId: number, kills: number, deaths: number, playtime: number): Promise<void> {
    await db.query(
      'CALL UpdatePlayerStats(?, ?, ?, ?, ?)',
      [serverId, playerId, kills, deaths, playtime]
    );
  }

  /**
   * Initialize player balance
   */
  private async initializePlayerBalance(serverId: number, playerId: number): Promise<void> {
    await db.query(
      'CALL UpdatePlayerBalance(?, ?, ?, ?, ?)',
      [serverId, playerId, 1000.00, 0, 0] // Starting balance of 1000
    );
  }

  /**
   * Log server event
   */
  private async logServerEvent(serverId: number, eventType: string, eventData: any, playerId?: number): Promise<void> {
    await db.query(
      'INSERT INTO server_events (server_id, player_id, event_type, event_data) VALUES (?, ?, ?, ?)',
      [serverId, playerId || null, eventType, JSON.stringify(eventData)]
    );
  }

  /**
   * Update server connection status in database
   */
  private async updateServerConnectionStatus(serverId: number, status: string): Promise<void> {
    await db.query(
      'UPDATE servers SET connection_status = ?, last_connection_at = NOW() WHERE id = ?',
      [status, serverId]
    );
  }

  /**
   * Start ping interval for a server
   */
  private startPingInterval(serverId: number): void {
    const interval = setInterval(async () => {
      const connection = this.connections.get(serverId);
      if (connection && connection.isConnected) {
        try {
          await this.sendCommand(serverId, 'status', 5000);
          connection.lastPing = Date.now();
        } catch (error) {
          console.error(`[${connection.name}] Ping failed:`, error);
        }
      }
    }, 30000); // Ping every 30 seconds

    this.pingIntervals.set(serverId, interval);
  }

  /**
   * Stop ping interval for a server
   */
  private stopPingInterval(serverId: number): void {
    const interval = this.pingIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.pingIntervals.delete(serverId);
    }
  }

  /**
   * Schedule reconnection for a server
   */
  private scheduleReconnection(serverId: number): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    const interval = setTimeout(async () => {
      if (!this.isShuttingDown) {
        console.log(`Attempting to reconnect to ${connection.name}...`);
        try {
          await this.establishConnection(serverId);
          await this.updateServerConnectionStatus(serverId, 'connected');
          console.log(`✅ Reconnected to ${connection.name}`);
        } catch (error) {
          console.error(`❌ Reconnection failed for ${connection.name}:`, error);
          this.scheduleReconnection(serverId); // Try again
        }
      }
    }, 5000); // Retry after 5 seconds

    this.reconnectIntervals.set(serverId, interval);
  }

  /**
   * Clear pending commands for a server
   */
  private clearPendingCommands(serverId: number): void {
    const connection = this.connections.get(serverId);
    if (connection) {
      for (const [commandId, pendingCommand] of connection.pendingCommands) {
        clearTimeout(pendingCommand.timeout);
        pendingCommand.reject(new Error('Connection closed'));
      }
      connection.pendingCommands.clear();
    }
  }

  /**
   * Disconnect from a server
   */
  public async disconnectFromServer(serverId: number): Promise<void> {
    const connection = this.connections.get(serverId);
    if (connection) {
      // Clear intervals
      this.stopPingInterval(serverId);
      const reconnectInterval = this.reconnectIntervals.get(serverId);
      if (reconnectInterval) {
        clearTimeout(reconnectInterval);
        this.reconnectIntervals.delete(serverId);
      }

      // Close WebSocket
      if (connection.ws) {
        connection.ws.close();
      }

      // Clear pending commands
      this.clearPendingCommands(serverId);

      // Remove from connections
      this.connections.delete(serverId);

      // Update database
      await this.updateServerConnectionStatus(serverId, 'disconnected');

      console.log(`Disconnected from server ${serverId}`);
    }
  }

  /**
   * Disconnect from all servers
   */
  public async disconnectAll(): Promise<void> {
    this.isShuttingDown = true;
    
    const serverIds = Array.from(this.connections.keys());
    for (const serverId of serverIds) {
      await this.disconnectFromServer(serverId);
    }
    
    console.log('Disconnected from all servers');
  }

  /**
   * Get server info
   */
  public async getServerInfo(serverId: number): Promise<ServerInfo | null> {
    try {
      const response = await this.sendCommand(serverId, 'serverinfo');
      return JSON.parse(response);
    } catch (error) {
      console.error(`Failed to get server info for ${serverId}:`, error);
      return null;
    }
  }

  /**
   * Get players list
   */
  public async getPlayers(serverId: number): Promise<PlayerInfo[]> {
    try {
      const response = await this.sendCommand(serverId, 'players');
      return this.parsePlayersList(response);
    } catch (error) {
      console.error(`Failed to get players for ${serverId}:`, error);
      return [];
    }
  }

  /**
   * Parse players list from server response
   */
  private parsePlayersList(playersInfo: string): PlayerInfo[] {
    const players: PlayerInfo[] = [];
    const lines = playersInfo.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.includes('Players connected')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
          players.push({
            steamId: parts[0],
            name: parts[1],
            connected: true,
            ping: parseInt(parts[2]) || 0,
            address: parts[3] || ''
          });
        }
      }
    }
    
    return players;
  }

  /**
   * Send chat message
   */
  public async sendChat(serverId: number, message: string): Promise<void> {
    await this.sendCommand(serverId, `say ${message}`);
  }

  /**
   * Get connection status for all servers
   */
  public getConnectionStatus(): Array<{ serverId: number; name: string; isConnected: boolean; lastPing: number }> {
    return Array.from(this.connections.values()).map(conn => ({
      serverId: conn.id,
      name: conn.name,
      isConnected: conn.isConnected,
      lastPing: conn.lastPing
    }));
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await this.disconnectAll();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      await this.disconnectAll();
      process.exit(0);
    });
  }
}

// Export singleton instance
export const rconBot = new RconBot();
