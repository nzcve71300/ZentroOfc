const crypto = require('crypto');
const fetch = require('node-fetch');

class DiscordBotIntegration {
  constructor() {
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
    this.webhookSecret = process.env.WEBHOOK_SECRET || 'webhook-secret';
  }

  /**
   * Generate webhook signature for secure communication
   */
  generateWebhookSignature(body) {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
  }

  /**
   * Send webhook to API for real-time updates
   */
  async sendWebhook(event, data) {
    try {
      const body = { event, data };
      const signature = this.generateWebhookSignature(body);

      const response = await fetch(`${this.apiBaseUrl}/webhook/discord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send webhook:', error);
      throw error;
    }
  }

  /**
   * Create or update server via API
   */
  async createOrUpdateServer(serverData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getBotToken()}`
        },
        body: JSON.stringify(serverData)
      });

      if (!response.ok) {
        throw new Error(`Server creation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Send webhook for real-time update
      await this.sendWebhook('server.created', result.server);
      
      return result;
    } catch (error) {
      console.error('Failed to create/update server:', error);
      throw error;
    }
  }

  /**
   * Get servers for a guild
   */
  async getServersForGuild(guildId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/servers?guildId=${guildId}`, {
        headers: {
          'Authorization': `Bearer ${this.getBotToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch servers: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch servers:', error);
      throw error;
    }
  }

  /**
   * Create or update player via API
   */
  async createOrUpdatePlayer(playerData) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getBotToken()}`
        },
        body: JSON.stringify(playerData)
      });

      if (!response.ok) {
        throw new Error(`Player creation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Send webhook for real-time update
      await this.sendWebhook('player.created', result.player);
      
      return result;
    } catch (error) {
      console.error('Failed to create/update player:', error);
      throw error;
    }
  }

  /**
   * Update player balance via API
   */
  async updatePlayerBalance(playerId, serverId, amount, reason) {
    try {
      const endpoint = amount > 0 ? 'add' : 'remove';
      const response = await fetch(`${this.apiBaseUrl}/economy/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getBotToken()}`
        },
        body: JSON.stringify({
          playerId,
          serverId,
          amount: Math.abs(amount),
          reason
        })
      });

      if (!response.ok) {
        throw new Error(`Balance update failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Send webhook for real-time update
      await this.sendWebhook('economy.updated', {
        playerId,
        serverId,
        balance: result.balance,
        amount: amount
      });
      
      return result;
    } catch (error) {
      console.error('Failed to update balance:', error);
      throw error;
    }
  }

  /**
   * Execute RCON command via API
   */
  async executeRconCommand(playerId, serverId, command) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/players/${playerId}/execute-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getBotToken()}`
        },
        body: JSON.stringify({
          command,
          serverId
        })
      });

      if (!response.ok) {
        throw new Error(`Command execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Send webhook for real-time update
      await this.sendWebhook('command.executed', {
        playerId,
        serverId,
        command: result.command,
        result: result.result
      });
      
      return result;
    } catch (error) {
      console.error('Failed to execute command:', error);
      throw error;
    }
  }

  /**
   * Get bot authentication token
   * This should be implemented based on your bot's authentication system
   */
  getBotToken() {
    // This should return a valid JWT token for the bot
    // You might want to implement a service account or use a specific bot token
    return process.env.BOT_API_TOKEN || 'bot-token-placeholder';
  }

  /**
   * Handle Discord slash command and route to API
   */
  async handleSlashCommand(interaction, commandData) {
    try {
      // Defer reply to avoid timeout
      await interaction.deferReply();

      switch (commandData.command) {
        case 'setup-server':
          return await this.handleSetupServer(interaction, commandData);
        
        case 'add-currency-player':
          return await this.handleAddCurrency(interaction, commandData);
        
        case 'balance':
          return await this.handleBalance(interaction, commandData);
        
        default:
          throw new Error(`Unknown command: ${commandData.command}`);
      }
    } catch (error) {
      console.error('Slash command error:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }

  /**
   * Handle setup-server slash command
   */
  async handleSetupServer(interaction, commandData) {
    const { serverKey, displayName, region, webRconHost, webRconPort, rconPassword } = commandData;

    const serverData = {
      guildId: interaction.guildId,
      serverKey,
      displayName,
      region,
      webRconHost,
      webRconPort,
      rconPassword
    };

    const result = await this.createOrUpdateServer(serverData);

    await interaction.editReply({
      content: `✅ Server "${displayName}" has been ${result.message.toLowerCase()}`,
      ephemeral: true
    });
  }

  /**
   * Handle add-currency-player slash command
   */
  async handleAddCurrency(interaction, commandData) {
    const { playerIgn, amount, reason } = commandData;

    // First, find the player
    const player = await this.findPlayerByIgn(playerIgn, interaction.guildId);
    if (!player) {
      throw new Error(`Player "${playerIgn}" not found`);
    }

    // Get server ID (you might need to implement server selection logic)
    const servers = await this.getServersForGuild(interaction.guildId);
    if (servers.servers.length === 0) {
      throw new Error('No servers configured for this guild');
    }

    const serverId = servers.servers[0].id; // Use first server or implement selection logic

    const result = await this.updatePlayerBalance(player.id, serverId, amount, reason);

    await interaction.editReply({
      content: `✅ Added ${amount} currency to ${playerIgn}. New balance: ${result.balance}`,
      ephemeral: true
    });
  }

  /**
   * Handle balance slash command
   */
  async handleBalance(interaction, commandData) {
    const { playerIgn } = commandData;

    // Find the player
    const player = await this.findPlayerByIgn(playerIgn, interaction.guildId);
    if (!player) {
      throw new Error(`Player "${playerIgn}" not found`);
    }

    // Get servers for guild
    const servers = await this.getServersForGuild(interaction.guildId);
    if (servers.servers.length === 0) {
      throw new Error('No servers configured for this guild');
    }

    // Get balance for each server
    const balances = [];
    for (const server of servers.servers) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/economy/balance/${player.id}?serverId=${server.id}`, {
          headers: {
            'Authorization': `Bearer ${this.getBotToken()}`
          }
        });

        if (response.ok) {
          const balanceData = await response.json();
          balances.push({
            server: server.display_name,
            balance: balanceData.balance || 0
          });
        }
      } catch (error) {
        console.error(`Failed to get balance for server ${server.id}:`, error);
      }
    }

    const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);
    const balanceText = balances.map(b => `${b.server}: ${b.balance}`).join('\n');

    await interaction.editReply({
      content: `💰 **${playerIgn}'s Balance**\n${balanceText}\n\n**Total: ${totalBalance}**`,
      ephemeral: true
    });
  }

  /**
   * Find player by IGN
   */
  async findPlayerByIgn(ign, guildId) {
    try {
      const servers = await this.getServersForGuild(guildId);
      
      for (const server of servers.servers) {
        const response = await fetch(`${this.apiBaseUrl}/players?serverId=${server.id}`, {
          headers: {
            'Authorization': `Bearer ${this.getBotToken()}`
          }
        });

        if (response.ok) {
          const playersData = await response.json();
          const player = playersData.players.find(p => p.ign.toLowerCase() === ign.toLowerCase());
          if (player) {
            return player;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to find player:', error);
      return null;
    }
  }
}

module.exports = DiscordBotIntegration;
