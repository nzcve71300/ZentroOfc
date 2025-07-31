# Zentro Bot

Multi-Tenant Rust Console Discord Bot

## Stack
- Node.js
- Discord.js v14
- PostgreSQL
- WebRCON

## Features
- Multi-tenant: Each Discord guild has its own data
- Up to 10 Rust servers per guild
- PostgreSQL for all storage (economy, shops, configs, kits, etc.)
- Autocomplete for server/category options
- Orange rich embeds for all responses
- Deferred replies to prevent interaction errors

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. PostgreSQL Setup

#### Option A: Docker (Recommended for Development)
```bash
# Install Docker Desktop first, then run:
docker-compose up -d
```

#### Option B: Manual PostgreSQL Installation
1. Download PostgreSQL from https://www.postgresql.org/download/
2. Install with default settings
3. Create database and user:
```sql
CREATE DATABASE zentro_bot;
CREATE USER zentro_user WITH PASSWORD 'zentro_password';
GRANT ALL PRIVILEGES ON DATABASE zentro_bot TO zentro_user;
```

#### Option C: Cloud PostgreSQL
- Use Google Cloud SQL, AWS RDS, or DigitalOcean Managed Databases
- Update `.env` with cloud database credentials

### 3. Database Schema
```bash
# For local PostgreSQL:
psql -U zentro_user -d zentro_bot -f schema.sql

# For Docker:
# Schema will be automatically loaded
```

### 4. Environment Configuration
Create a `.env` file:
```
DISCORD_TOKEN=your-bot-token
PGHOST=localhost
PGUSER=zentro_user
PGPASSWORD=zentro_password
PGDATABASE=zentro_bot
PGPORT=5432
RCON_DEFAULT_PORT=28016
RCON_DEFAULT_PASSWORD=changeme
```

### 5. Run the Bot
```bash
npm start
```

## Production Deployment (Google Cloud VM)

### 1. GitHub Setup
```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit"

# Create GitHub repository and push
git remote add origin https://github.com/yourusername/zentro-bot.git
git branch -M main
git push -u origin main
```

### 2. Google Cloud VM Setup
1. Create a VM instance in Google Cloud Console
2. SSH into your VM
3. Clone your repository:
```bash
git clone https://github.com/yourusername/zentro-bot.git
cd zentro-bot
```

### 3. Automated Deployment
```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment script
./deploy.sh
```

### 4. Manual Deployment Steps
If you prefer manual setup:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Setup database
sudo -u postgres psql -c "CREATE DATABASE zentro_bot;"
sudo -u postgres psql -c "CREATE USER zentro_user WITH PASSWORD 'zentro_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zentro_bot TO zentro_user;"

# Install dependencies and start
npm install
sudo -u postgres psql -d zentro_bot -f schema.sql
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 5. Environment Variables for Production
Edit `.env` with your production credentials:
```
DISCORD_TOKEN=your-production-bot-token
PGHOST=localhost
PGUSER=zentro_user
PGPASSWORD=your-secure-password
PGDATABASE=zentro_bot
PGPORT=5432
RCON_DEFAULT_PORT=28016
RCON_DEFAULT_PASSWORD=your-rcon-password
```

## Commands

### Admin Commands
- `/setup-server` - Add a Rust server
- `/open-shop` - Open shop with dropdown
- `/add-shop-category` - Create shop categories
- `/add-shop-item` - Add items to shop
- `/set-currency` - Set currency name
- `/set-events` - Configure Bradley/Helicopter events
- `/view-events` - View event configurations
- `/edit-zorp` - Edit ZORP zone settings
- `/delete-zorp` - Delete a ZORP zone
- `/list-zones` - List all active ZORP zones

### Player Commands
- `/balance` - Show balance across servers
- `/link` - Link Discord account with IGN
- `/daily` - Claim daily rewards

## PM2 Management
```bash
# Check status
pm2 status

# View logs
pm2 logs zentro-bot

# Restart bot
pm2 restart zentro-bot

# Stop bot
pm2 stop zentro-bot

# Monitor
pm2 monit
```

## ZORP (Zone Offline Raid Protection) System

### Overview
The ZORP system allows players to create protected zones using in-game emotes. Zones automatically expire after 32 hours and can be managed through Discord commands.

### In-Game Usage
Players can create zones by using the emote: `d11_quick_chat_questions_slot_1`

**Zone Creation Process:**
1. Player uses the ZORP emote in-game
2. System checks team size (min: 1, max: 8)
3. Gets player position using `printpos`
4. Creates sphere zone with 75 unit radius
5. Sends confirmation message to player

**Zone Properties:**
- **Size:** 75 units (default)
- **Shape:** Sphere
- **Online Color:** Green (0,255,0)
- **Offline Color:** Red (255,0,0)
- **Expiration:** 32 hours (115200 seconds)
- **Team Limits:** 1-8 players

### Discord Admin Commands

#### `/edit-zorp <server> [options]`
Edit zone configuration settings.

**Parameters:**
- `zone_name`: Name of the zone to edit
- `size`: Zone size (default: 75)
- `color_online`: Online color (R,G,B format)
- `color_offline`: Offline color (R,G,B format)
- `radiation`: Radiation level (default: 0)
- `delay`: Delay in seconds (default: 0)
- `expire`: Expiration time in seconds
- `min_team`: Minimum team size
- `max_team`: Maximum team size

**Examples:**
```
/edit-zorp "Server Name" size 100
/edit-zorp "Server Name" color_online "255,255,0"
/edit-zorp "Server Name" expire 86400
```

#### `/delete-zorp <zone_name>`
Delete a ZORP zone from both game and database.

**Parameters:**
- `zone_name`: Name of the zone to delete

**Examples:**
```
/delete-zorp ZORP_1234567890
```

#### `/list-zones`
List all active ZORP zones in the guild.

**Examples:**
```
/list-zones
```



### Database Schema
The ZORP system uses the `zones` table:

```sql
CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    server_id INT REFERENCES rust_servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    team JSONB,
    position JSONB,
    size INTEGER DEFAULT 75,
    color_online TEXT DEFAULT '0,255,0',
    color_offline TEXT DEFAULT '255,0,0',
    radiation INTEGER DEFAULT 0,
    delay INTEGER DEFAULT 0,
    expire INTEGER DEFAULT 115200,
    min_team INTEGER DEFAULT 1,
    max_team INTEGER DEFAULT 8,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Setup Instructions

1. **Database Migration:**
   ```bash
   psql -d your_database -f add_zones_table.sql
   ```

2. **Deploy Commands:**
   ```bash
   node deploy-commands.js
   ```

3. **Configuration:**
   - Zones are created automatically when players use the ZORP emote
   - Use Discord commands to manage existing zones
   - Expired zones are automatically cleaned up every 5 minutes

### Troubleshooting

- **Zone not created:** Check if player has valid team size (1-8 players)
- **Position errors:** Ensure player is in a valid location
- **RCON errors:** Verify server connection and permissions
- **Database errors:** Run the migration script to create the zones table

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check credentials in `.env`
- Ensure database exists: `psql -U zentro_user -d zentro_bot -c "\l"`

### Bot Not Starting
- Check logs: `pm2 logs zentro-bot`
- Verify Discord token is valid
- Ensure all dependencies are installed: `npm install`

### RCON Connection Issues
- Verify Rust server RCON is enabled
- Check IP, port, and password in `/setup-server`
- Ensure firewall allows RCON port (usually 28016)
