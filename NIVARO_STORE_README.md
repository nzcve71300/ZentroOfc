# Nivaro Store Discord Bot Integration

This system provides a complete Discord bot integration for the Nivaro store platform, allowing users to link their Discord servers to their Nivaro stores using secure secret keys.

## 🚀 Features

- **Secure Secret Key System**: 64-character hexadecimal keys that expire after 10 minutes
- **Discord Bot Command**: `/nivaro-link [secret_key]` for easy server linking
- **API Server**: RESTful API for verification and management
- **Rate Limiting**: Protection against abuse with configurable limits
- **Database Integration**: MySQL/MariaDB support with proper indexing
- **Transaction Safety**: Database transactions ensure data integrity

## 📋 Requirements

- Node.js 16+ 
- MySQL/MariaDB database
- Discord Bot Token
- Discord Application ID

## 🛠️ Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

Run the setup script to create the required tables:

```bash
node setup_nivaro_system.js
```

This will:
- Create the Nivaro store tables
- Set up proper indexes
- Add sample data for testing
- Configure environment variables

### 3. Configure Environment

Ensure your `.env` file contains:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=1402749479244926996

# Database Configuration
DB_HOST=localhost
DB_USER=zentro_user
DB_PASSWORD=zentro_password
DB_NAME=zentro_bot
DB_PORT=3306

# Nivaro Store API Configuration
API_PORT=3001
```

### 4. Deploy Discord Commands

```bash
node deploy-commands.js
```

### 5. Start the Services

**Start the Discord Bot:**
```bash
npm start
```

**Start the API Server:**
```bash
npm run start:api
```

## 🎯 Usage

### Discord Bot Command

**Admin users** can link their Discord server to a Nivaro store using:

```
/nivaro-link [secret_key]
```

**Requirements:**
- **Administrator** permissions in the Discord server
- Valid secret key from Nivaro store dashboard

**Example:**
```
/nivaro-link a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Note:** This command is restricted to server administrators only for security purposes.

### API Endpoints

#### Health Check
```http
GET /health
```

#### Generate Secret Key
```http
POST /api/generate-secret
Content-Type: application/json

{
  "store_name": "My Store",
  "store_url": "https://mystore.nivaro.com",
  "owner_email": "owner@example.com"
}
```

#### Verify Discord Link
```http
POST /api/verify-discord-link
Content-Type: application/json

{
  "secret_key": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "discord_guild_id": "123456789012345678",
  "discord_guild_name": "My Discord Server",
  "linked_by_user_id": "987654321098765432"
}
```

#### Get Store Information
```http
GET /api/store/:discord_guild_id
```

## 🗄️ Database Schema

### Tables

#### `pending_stores`
Stores waiting for Discord verification
- `id`: Primary key
- `secret_key`: 64-character unique key
- `store_name`: Store display name
- `store_url`: Store website URL
- `owner_email`: Store owner email
- `created_at`: Creation timestamp
- `expires_at`: Expiration timestamp (10 minutes)
- `is_used`: Whether key has been used

#### `stores`
Verified and active stores
- `id`: Primary key
- `store_name`: Store display name
- `store_url`: Store website URL
- `owner_email`: Store owner email
- `is_active`: Store status
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

#### `discord_links`
Mapping between Discord servers and stores
- `id`: Primary key
- `store_id`: Foreign key to stores table
- `discord_guild_id`: Discord server ID
- `discord_guild_name`: Discord server name
- `linked_by_user_id`: User who created the link
- `linked_at`: Link creation timestamp
- `is_active`: Link status

#### `api_rate_limits`
Rate limiting data
- `id`: Primary key
- `ip_address`: Client IP address
- `endpoint`: API endpoint
- `request_count`: Number of requests
- `first_request_at`: First request timestamp
- `last_request_at`: Last request timestamp

## 🔒 Security Features

### Secret Key Security
- 64-character hexadecimal keys (256-bit entropy)
- 10-minute expiration
- Single-use only
- Cryptographically secure generation

### Rate Limiting
- Global: 100 requests per 15 minutes per IP
- Verification endpoint: 10 requests per minute per IP
- Automatic cleanup of expired data

### Database Security
- Parameterized queries (SQL injection protection)
- Transaction safety for data integrity
- Proper indexing for performance

## 🧪 Testing

### Run System Tests
```bash
node test_nivaro_system.js
```

### Test API Endpoints

**Health Check:**
```bash
curl http://localhost:3001/health
```

**Generate Secret Key:**
```bash
curl -X POST http://localhost:3001/api/generate-secret \
  -H "Content-Type: application/json" \
  -d '{
    "store_name": "Test Store",
    "store_url": "https://test.nivaro.com",
    "owner_email": "test@example.com"
  }'
```

**Verify Discord Link:**
```bash
curl -X POST http://localhost:3001/api/verify-discord-link \
  -H "Content-Type: application/json" \
  -d '{
    "secret_key": "sample_key_123",
    "discord_guild_id": "123456789012345678",
    "discord_guild_name": "Test Server",
    "linked_by_user_id": "987654321098765432"
  }'
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | API server port | `3001` |
| `DB_HOST` | Database host | `localhost` |
| `DB_USER` | Database user | `zentro_user` |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | `zentro_bot` |
| `DB_PORT` | Database port | `3306` |

### Rate Limiting Configuration

You can modify rate limits in `src/api/server.js`:

```javascript
// Global rate limiter: 100 requests per 15 minutes
const globalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100,
  'Too many requests from this IP, please try again later.'
);

// Specific endpoint rate limiter: 10 requests per minute
const verifyEndpointLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10,
  'Too many verification attempts, please try again later.'
);
```

## 🚨 Troubleshooting

### Common Issues

**1. Database Connection Failed**
- Ensure MySQL/MariaDB is running
- Check database credentials in `.env`
- Verify database exists: `zentro_bot`

**2. Discord Bot Not Responding**
- Check Discord token in `.env`
- Ensure bot has proper permissions
- Deploy commands: `node deploy-commands.js`

**3. API Server Won't Start**
- Check if port 3001 is available
- Verify all dependencies are installed
- Check database connection

**4. Secret Keys Not Working**
- Keys expire after 10 minutes
- Keys can only be used once
- Check for typos in the key

### Logs

**Discord Bot Logs:**
```bash
pm2 logs zentro-bot
```

**API Server Logs:**
```bash
pm2 logs nivaro-api
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the logs for error messages
3. Test with the provided sample keys
4. Contact support with specific error details

## 🔄 Maintenance

### Cleanup Expired Data

The system automatically cleans up expired pending stores every hour. You can also run manual cleanup:

```sql
DELETE FROM pending_stores WHERE expires_at < NOW() AND is_used = FALSE;
```

### Database Backup

Regular backups are recommended:

```bash
mysqldump -u zentro_user -p zentro_bot > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 📈 Performance

### Database Indexes

The system includes optimized indexes for:
- Secret key lookups
- Expiration time queries
- Discord guild ID searches
- Rate limiting data

### Monitoring

Monitor system health with:
- Health check endpoint: `GET /health`
- Database connection status
- Rate limiting statistics

## 🎉 Success!

Once set up, server administrators can:
1. Get a secret key from their Nivaro store dashboard
2. Run `/nivaro-link [secret_key]` in their Discord server (requires Administrator permissions)
3. See "Successfully connected!" confirmation
4. Access their store through the Discord integration

**Security Note:** Only Discord server administrators can link stores to prevent unauthorized access and ensure proper server management. 