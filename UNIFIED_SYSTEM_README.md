# Zentro Unified System

A unified API system that connects your Discord bot and web application, allowing them to share the same data and functionality.

## 🎯 Overview

This system creates a single source of truth for all your Zentro data by:

- **Unified API**: Single Express.js API that both Discord bot and web app use
- **Shared Database**: Single database schema that supports both bot and app features
- **Real-time Sync**: Socket.IO for instant updates between bot and app
- **Secure Authentication**: Discord OAuth2 and JWT-based authentication
- **Audit Logging**: Complete audit trail of all data changes
- **Encrypted Secrets**: Secure storage of RCON passwords and sensitive data

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord Bot   │    │  Unified API    │    │   Web App       │
│                 │    │                 │    │                 │
│  - Slash Commands│◄──►│  - REST Endpoints│◄──►│  - React UI     │
│  - RCON Commands │    │  - Socket.IO    │    │  - Player Mgmt  │
│  - Event Handling│    │  - Authentication│    │  - Server Mgmt  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Database      │
                       │                 │
                       │  - Servers      │
                       │  - Players      │
                       │  - Economy      │
                       │  - Audit Logs   │
                       └─────────────────┘
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install API dependencies
cd src/api
npm install

# Install additional dependencies for the main project
npm install express cors helmet express-rate-limit socket.io jsonwebtoken
```

### 2. Environment Variables

Add these to your `.env` file:

```env
# API Configuration
API_PORT=3001
API_BASE_URL=http://localhost:3001/api
WEBHOOK_SECRET=your-webhook-secret

# Authentication
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-character-encryption-key

# Discord OAuth2
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Bot Integration
BOT_API_TOKEN=your-bot-api-token
```

### 3. Run Database Migration

```bash
# Apply the unified schema
node src/api/migrate-to-unified.js
```

### 4. Start the API Server

```bash
# Start the unified API
node start-unified-api.js
```

## 📊 Database Schema

### Core Tables

- **`servers`**: Unified server configurations with encrypted RCON passwords
- **`players`**: Player data linked to both Discord and app users
- **`player_balances`**: Server-specific economy balances
- **`player_stats`**: Server-specific player statistics
- **`app_users`**: Web app users with Discord linking
- **`server_events`**: Audit log of all server events
- **`audit_logs`**: Complete audit trail of all data mutations

### Key Features

- **Encrypted RCON Passwords**: Stored in `server_secrets` table
- **Multi-tenant**: All data scoped by `guild_id`
- **Audit Trail**: Every change is logged with user, timestamp, and details
- **Real-time Updates**: Socket.IO events for instant synchronization

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/discord` - Initiate Discord OAuth2
- `GET /api/auth/discord/callback` - Handle OAuth2 callback
- `POST /api/auth/register` - Register new app user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/verify` - Verify JWT token

### Servers
- `GET /api/servers` - List servers for guild
- `GET /api/servers/:id` - Get specific server
- `POST /api/servers` - Create/update server (idempotent)
- `PUT /api/servers/:id` - Update server details
- `DELETE /api/servers/:id` - Delete server

### Players
- `GET /api/players` - List players
- `GET /api/players/:id` - Get specific player
- `POST /api/players` - Create/update player
- `POST /api/players/:id/execute-command` - Execute RCON command
- `GET /api/players/:id/stats` - Get player statistics
- `GET /api/players/:id/balance` - Get player balance

### Economy
- `GET /api/economy/balance/:playerId` - Get player balance
- `POST /api/economy/add` - Add currency to player
- `POST /api/economy/remove` - Remove currency from player
- `POST /api/economy/set` - Set player balance
- `POST /api/economy/transfer` - Transfer between players
- `GET /api/economy/transactions` - Get transaction history

### Audit
- `GET /api/audit/logs` - Get audit logs
- `GET /api/audit/logs/resource/:type/:id` - Get resource logs
- `GET /api/audit/logs/guild/:guildId` - Get guild logs
- `POST /api/audit/cleanup` - Clean up old logs

## 🔧 Discord Bot Integration

### Update Your Bot

Replace direct database calls with API calls:

```javascript
// OLD: Direct database access
const [servers] = await pool.query('SELECT * FROM rust_servers WHERE guild_id = ?', [guildId]);

// NEW: API call
const response = await fetch(`${API_BASE_URL}/servers?guildId=${guildId}`, {
  headers: { 'Authorization': `Bearer ${botToken}` }
});
const { servers } = await response.json();
```

### Slash Command Integration

```javascript
const DiscordBotIntegration = require('./src/api/services/discord-bot-integration');
const botIntegration = new DiscordBotIntegration();

// In your slash command handler
await botIntegration.handleSlashCommand(interaction, {
  command: 'setup-server',
  serverKey: 'my-server',
  displayName: 'My Rust Server',
  region: 'US',
  webRconHost: '192.168.1.100',
  webRconPort: 28016,
  rconPassword: 'secret123'
});
```

## 🌐 Web App Integration

### Authentication Flow

1. User clicks "Login with Discord"
2. Redirected to Discord OAuth2
3. Returns with JWT token
4. Store token for API calls

### API Client Example

```javascript
class ZentroAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async getServers() {
    const response = await fetch(`${this.baseUrl}/servers`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }

  async addCurrency(playerId, serverId, amount, reason) {
    const response = await fetch(`${this.baseUrl}/economy/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ playerId, serverId, amount, reason })
    });
    return response.json();
  }
}
```

## 🔄 Real-time Updates

### Socket.IO Events

The API emits real-time events for instant updates:

- `server.created` - New server added
- `server.updated` - Server configuration changed
- `server.deleted` - Server removed
- `player.created` - New player registered
- `economy.updated` - Player balance changed
- `command.executed` - RCON command executed

### Web App Integration

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.emit('join-guild', guildId);

socket.on('economy.updated', (data) => {
  // Update player balance in UI
  updatePlayerBalance(data.playerId, data.balance);
});

socket.on('server.created', (data) => {
  // Add new server to list
  addServerToList(data.server);
});
```

## 🔒 Security Features

### Authentication
- JWT tokens with expiration
- Discord OAuth2 integration
- Role-based access control

### Data Protection
- Encrypted RCON passwords
- Secure webhook signatures
- Rate limiting on all endpoints
- CORS protection

### Audit Trail
- Every data mutation is logged
- User attribution for all changes
- IP address and user agent tracking
- Configurable retention periods

## 📈 Monitoring & Logging

### Health Check
```bash
curl http://localhost:3001/health
```

### Audit Logs
```bash
# Get recent audit logs
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/audit/logs?limit=100
```

### Real-time Monitoring
The API provides comprehensive logging and monitoring:
- Request/response logging
- Error tracking
- Performance metrics
- Database query monitoring

## 🚀 Deployment

### Production Setup

1. **Environment Variables**: Set all production values
2. **Database**: Use MariaDB/PostgreSQL in production
3. **SSL**: Enable HTTPS for all endpoints
4. **Load Balancing**: Use nginx or similar
5. **Monitoring**: Set up logging and monitoring

### Docker Support

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "start-unified-api.js"]
```

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection**: Check DB credentials and network
2. **Authentication**: Verify JWT secret and Discord OAuth2 config
3. **CORS**: Ensure allowed origins include your app domains
4. **Rate Limiting**: Adjust limits if needed for your use case

### Debug Mode

```bash
NODE_ENV=development node start-unified-api.js
```

## 📚 API Documentation

Full API documentation is available at:
- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI Spec: `http://localhost:3001/api-spec.json`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

## 🎉 Benefits

With this unified system, you get:

- **Single Source of Truth**: All data in one place
- **Real-time Sync**: Instant updates between bot and app
- **Better Security**: Encrypted secrets and audit trails
- **Scalability**: API-first architecture
- **Maintainability**: Centralized business logic
- **User Experience**: Seamless integration between Discord and web

Your Discord bot and web app now work together as a unified platform! 🚀
