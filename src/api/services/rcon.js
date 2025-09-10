const WebSocket = require('ws');
const EncryptionService = require('./encryption');

class RconService {
  constructor() {
    this.connections = new Map();
    this.encryption = new EncryptionService();
  }

  async connect(serverId, ip, port, encryptedPassword) {
    try {
      const password = this.encryption.decrypt(encryptedPassword);
      const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          this.connections.set(serverId, ws);
          resolve(ws);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      throw new Error(`Failed to connect to server: ${error.message}`);
    }
  }

  async sendCommand(serverId, command) {
    const ws = this.connections.get(serverId);
    if (!ws) {
      throw new Error('Server not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 30000);

      ws.send(command);
      
      ws.once('message', (data) => {
        clearTimeout(timeout);
        resolve(data.toString());
      });

      ws.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  disconnect(serverId) {
    const ws = this.connections.get(serverId);
    if (ws) {
      ws.close();
      this.connections.delete(serverId);
    }
  }

  isConnected(serverId) {
    const ws = this.connections.get(serverId);
    return ws && ws.readyState === WebSocket.OPEN;
  }
}

module.exports = RconService;
