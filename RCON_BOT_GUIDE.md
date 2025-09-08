# RCON Bot Connection Guide

## Overview

This guide explains how to create a Rust RCON bot that can connect to multiple servers and handle real-time events. The bot uses WebSocket connections to communicate with Rust servers via the RCON protocol.

## How RCON Works

### Connection Method
RCON (Remote Console) allows remote administration of Rust servers through WebSocket connections. The connection URL format is:
```
ws://[SERVER_IP]:[RCON_PORT]/[RCON_PASSWORD]
```

### Message Protocol
All communication uses JSON format:

**Command Format:**
```json
{
  "Identifier": 1,        // Unique ID for the command
  "Message": "command",   // The actual RCON command
  "Name": "WebRcon"       // Client name
}
```

**Response Format:**
```json
{
  "Identifier": 1,        // Matches the command ID
  "Message": "response",  // Server response
  "Name": "WebRcon"
}
```

## Complete Implementation

### Basic RCON Bot Class

```javascript
const WebSocket = require('ws');

class RconBot {
  constructor() {
    this.connections = new Map();
    this.commandId = 1;
  }

  // Connect to a Rust server via RCON
  connect(serverName, ip, port, password) {
    const connectionKey = `${ip}:${port}`;
    
    if (this.connections.has(connectionKey)) {
      console.log(`Already connected to ${serverName}`);
      return this.connections.get(connectionKey);
    }

    console.log(`Connecting to RCON: ${serverName} (${ip}:${port})`);
    
    const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
    
    ws.on('open', () => {
      console.log(`✅ Connected to RCON: ${serverName}`);
      this.connections.set(connectionKey, ws);
    });

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        console.log(`[${serverName}] Response:`, response.Message);
        
        // Handle different types of messages
        this.handleServerMessage(serverName, response.Message);
      } catch (error) {
        console.error(`[${serverName}] Error parsing message:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`[${serverName}] RCON error:`, error.message);
    });

    ws.on('close', () => {
      console.log(`[${serverName}] RCON connection closed`);
      this.connections.delete(connectionKey);
    });

    return ws;
  }

  // Send a command to the server
  async sendCommand(ip, port, command) {
    return new Promise((resolve, reject) => {
      const connectionKey = `${ip}:${port}`;
      const ws = this.connections.get(connectionKey);
      
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('No active connection to server'));
        return;
      }

      const commandId = this.commandId++;
      const commandData = {
        Identifier: commandId,
        Message: command,
        Name: 'WebRcon'
      };

      let responseReceived = false;
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          reject(new Error('Command timeout'));
        }
      }, 10000); // 10 second timeout

      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.Identifier === commandId) {
            responseReceived = true;
            clearTimeout(timeout);
            ws.removeListener('message', messageHandler);
            resolve(response.Message);
          }
        } catch (error) {
          // Ignore parsing errors for other messages
        }
      };

      ws.on('message', messageHandler);
      ws.send(JSON.stringify(commandData));
    });
  }

  // Handle incoming server messages
  handleServerMessage(serverName, message) {
    // Player join/leave detection
    if (message.includes('has entered the game')) {
      const playerMatch = message.match(/(\w+) has entered the game/);
      if (playerMatch) {
        console.log(`[${serverName}] Player joined: ${playerMatch[1]}`);
        // Handle player join logic here
      }
    }

    if (message.includes('has left the game')) {
      const playerMatch = message.match(/(\w+) has left the game/);
      if (playerMatch) {
        console.log(`[${serverName}] Player left: ${playerMatch[1]}`);
        // Handle player leave logic here
      }
    }

    // Kill detection
    if (message.includes('was killed by')) {
      console.log(`[${serverName}] Kill detected: ${message}`);
      // Handle kill logic here
    }

    // Chat messages
    if (message.includes('[CHAT]')) {
      console.log(`[${serverName}] Chat: ${message}`);
      // Handle chat logic here
    }
  }

  // Get server information
  async getServerInfo(ip, port) {
    try {
      const response = await this.sendCommand(ip, port, 'serverinfo');
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to get server info:', error);
      return null;
    }
  }

  // Get player list
  async getPlayers(ip, port) {
    try {
      const response = await this.sendCommand(ip, port, 'players');
      return response;
    } catch (error) {
      console.error('Failed to get players:', error);
      return null;
    }
  }

  // Send a chat message
  async sendChat(ip, port, message) {
    try {
      await this.sendCommand(ip, port, `say ${message}`);
    } catch (error) {
      console.error('Failed to send chat:', error);
    }
  }

  // Disconnect from a server
  disconnect(ip, port) {
    const connectionKey = `${ip}:${port}`;
    const ws = this.connections.get(connectionKey);
    
    if (ws) {
      ws.close();
      this.connections.delete(connectionKey);
    }
  }

  // Disconnect from all servers
  disconnectAll() {
    for (const [key, ws] of this.connections) {
      ws.close();
    }
    this.connections.clear();
  }
}
```

### Usage Example

```javascript
// Create bot instance
const bot = new RconBot();

// Connect to a server
const server1 = bot.connect('My Server', '192.168.1.100', 28016, 'mypassword');

// Send commands
bot.sendCommand('192.168.1.100', 28016, 'players')
  .then(response => console.log('Players:', response))
  .catch(error => console.error('Error:', error));

// Get server info
bot.getServerInfo('192.168.1.100', 28016)
  .then(info => console.log('Server Info:', info));

// Send chat message
bot.sendChat('192.168.1.100', 28016, 'Hello from the bot!');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  bot.disconnectAll();
  process.exit(0);
});
```

## Common RCON Commands

| Command | Description |
|---------|-------------|
| `players` | Get current player list |
| `serverinfo` | Get server information (JSON) |
| `say [message]` | Send chat message to all players |
| `time` | Get current game time |
| `status` | Get server status |
| `kick [player] [reason]` | Kick a player |
| `ban [player] [reason]` | Ban a player |
| `unban [player]` | Unban a player |
| `tp [player1] [player2]` | Teleport player1 to player2 |
| `give [player] [item] [amount]` | Give item to player |

## Event Detection Patterns

### Player Events
```javascript
// Player join
if (message.includes('has entered the game')) {
  const playerMatch = message.match(/(\w+) has entered the game/);
  // Handle player join
}

// Player leave
if (message.includes('has left the game')) {
  const playerMatch = message.match(/(\w+) has left the game/);
  // Handle player leave
}
```

### Kill Events
```javascript
// Player kill
if (message.includes('was killed by')) {
  const killMatch = message.match(/(\w+) was killed by (\w+)/);
  // Handle kill event
}
```

### Chat Events
```javascript
// Chat message
if (message.includes('[CHAT]')) {
  const chatMatch = message.match(/\[CHAT\] (\w+): (.+)/);
  // Handle chat message
}
```

## Web Application Integration

### For Web Apps (Express.js Example)

```javascript
const express = require('express');
const app = express();
const bot = new RconBot();

// Connect to servers on startup
bot.connect('Server 1', '192.168.1.100', 28016, 'password1');
bot.connect('Server 2', '192.168.1.101', 28016, 'password2');

// API endpoint to send commands
app.post('/api/rcon/:serverIp/:serverPort/command', async (req, res) => {
  try {
    const { serverIp, serverPort } = req.params;
    const { command } = req.body;
    
    const response = await bot.sendCommand(serverIp, serverPort, command);
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to get server info
app.get('/api/rcon/:serverIp/:serverPort/info', async (req, res) => {
  try {
    const { serverIp, serverPort } = req.params;
    const info = await bot.getServerInfo(serverIp, serverPort);
    res.json({ success: true, info });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('RCON Bot API running on port 3000');
});
```

## Error Handling Best Practices

1. **Connection Timeouts**: Always implement timeouts for commands
2. **Reconnection Logic**: Handle connection drops gracefully
3. **Command Queuing**: Queue commands to avoid overwhelming the server
4. **Rate Limiting**: Don't send commands too frequently
5. **Error Logging**: Log all errors for debugging

## Security Considerations

1. **Password Protection**: Store RCON passwords securely
2. **Input Validation**: Validate all user inputs before sending commands
3. **Command Restrictions**: Limit which commands users can execute
4. **Rate Limiting**: Prevent command spam
5. **Authentication**: Implement proper authentication for web interfaces

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check IP, port, and password
2. **Command Timeouts**: Server might be overloaded or unresponsive
3. **Invalid JSON**: Server responses might contain special characters
4. **Memory Leaks**: Always clean up event listeners and connections

### Debug Tips

1. Enable debug logging to see all messages
2. Test connections with simple commands first
3. Check server RCON settings and permissions
4. Monitor network connectivity and firewall rules

## Dependencies

```json
{
  "dependencies": {
    "ws": "^8.14.2",
    "express": "^4.18.2"
  }
}
```

## Installation

```bash
npm install ws express
```

This guide provides everything you need to create a robust RCON bot for Rust servers that can be integrated into web applications or run as standalone services.
