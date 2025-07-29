# Zentro Bot - MySQL Migration Guide

## Overview

This guide provides a complete migration from PostgreSQL to MySQL/MariaDB for the Zentro Rust Console Discord Bot. The migration includes all database schemas, migration scripts, and code updates to ensure 100% compatibility with MySQL.

## 🗄️ Key Changes

### Database Connection
- **From**: `pg` package (PostgreSQL)
- **To**: `mysql2` package (MySQL/MariaDB)
- **Port**: 5432 → 3306

### Data Types
- **SERIAL** → **INT AUTO_INCREMENT**
- **BIGINT** → **BIGINT** (unchanged)
- **TEXT** → **TEXT** (unchanged)
- **TIMESTAMP** → **TIMESTAMP** (with MySQL syntax)

### SQL Syntax
- **ON CONFLICT** → **ON DUPLICATE KEY UPDATE**
- **$1, $2** → **?** (parameterized queries)
- **NOW()** → **CURRENT_TIMESTAMP**
- **Type casting** → **Removed** (MySQL handles type conversion)

## 📁 New Files Created

### Database Files
- `mysql_schema.sql` - Complete MySQL schema
- `mysql_migrate.js` - Basic MySQL migration script
- `mysql_migrate_to_unified_system.js` - Unified system migration
- `mysql_setup_google_cloud.sh` - Google Cloud VM setup script

### Updated Files
- `src/db/index.js` - MySQL connection pool
- `src/config.js` - Updated default port
- `src/utils/linking.js` - MySQL syntax conversion
- `package.json` - mysql2 dependency

## 🚀 Installation Steps

### 1. Google Cloud VM Setup

```bash
# Make the setup script executable
chmod +x mysql_setup_google_cloud.sh

# Run the setup script
./mysql_setup_google_cloud.sh
```

### 2. Environment Configuration

Update your `.env` file:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=zentro_user
DB_PASSWORD=your_secure_password_here
DB_NAME=zentro_bot
DB_PORT=3306

# Discord Configuration
DISCORD_TOKEN=your_discord_token_here

# RCON Configuration
RCON_DEFAULT_PORT=28016
RCON_DEFAULT_PASSWORD=your_rcon_password
```

### 3. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install PM2 for process management (if not already installed)
sudo npm install -g pm2
```

### 4. Database Migration

```bash
# Option A: Fresh installation with unified schema
mysql -u zentro_user -p zentro_bot < mysql_schema.sql

# Option B: Run migration script
node mysql_migrate.js

# Option C: Migrate to unified system (if upgrading)
node mysql_migrate_to_unified_system.js
```

### 5. Start the Bot

```bash
# Development mode
npm start

# Production mode with PM2
pm2 start ecosystem.config.js
```

## 🔧 Database Schema

### Core Tables

```sql
-- Guilds
CREATE TABLE guilds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discord_id BIGINT NOT NULL UNIQUE,
    name TEXT
);

-- Rust Servers
CREATE TABLE rust_servers (
    id VARCHAR(32) PRIMARY KEY,
    guild_id INT,
    nickname TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INT NOT NULL,
    password TEXT NOT NULL,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Unified Players
CREATE TABLE players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id INT,
    server_id VARCHAR(32),
    discord_id BIGINT NOT NULL,
    ign TEXT NOT NULL,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unlinked_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE KEY unique_guild_server_discord (guild_id, server_id, discord_id),
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Economy
CREATE TABLE economy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT,
    balance INT DEFAULT 0,
    UNIQUE KEY unique_player (player_id),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
```

## 🔄 Migration Process

### From PostgreSQL to MySQL

1. **Backup PostgreSQL Data**
   ```bash
   pg_dump zentro_bot > postgres_backup.sql
   ```

2. **Install MySQL**
   ```bash
   ./mysql_setup_google_cloud.sh
   ```

3. **Create MySQL Schema**
   ```bash
   mysql -u zentro_user -p zentro_bot < mysql_schema.sql
   ```

4. **Update Code**
   - All files have been updated to use MySQL syntax
   - Parameterized queries use `?` instead of `$1, $2`
   - `ON CONFLICT` replaced with `ON DUPLICATE KEY UPDATE`

5. **Test Migration**
   ```bash
   node mysql_migrate.js
   ```

## 🛠️ Code Changes

### Database Connection

**Before (PostgreSQL):**
```javascript
const { Pool } = require('pg');
const pool = new Pool(db);
```

**After (MySQL):**
```javascript
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: db.host,
  user: db.user,
  password: db.password,
  database: db.database,
  port: db.port || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### Query Syntax

**Before (PostgreSQL):**
```sql
INSERT INTO players (guild_id, discord_id, ign)
VALUES ($1, $2, $3)
ON CONFLICT (guild_id, discord_id) 
DO UPDATE SET ign = EXCLUDED.ign;
```

**After (MySQL):**
```sql
INSERT INTO players (guild_id, discord_id, ign)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE ign = VALUES(ign);
```

### Result Handling

**Before (PostgreSQL):**
```javascript
const result = await pool.query('SELECT * FROM players');
return result.rows;
```

**After (MySQL):**
```javascript
const [result] = await pool.query('SELECT * FROM players');
return result;
```

## 🔍 Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check MySQL service
   sudo systemctl status mysql
   
   # Restart MySQL
   sudo systemctl restart mysql
   ```

2. **Access Denied**
   ```bash
   # Reset MySQL root password
   sudo mysql -u root
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
   ```

3. **Port Already in Use**
   ```bash
   # Check what's using port 3306
   sudo netstat -tlnp | grep :3306
   ```

4. **Character Set Issues**
   ```sql
   -- Set proper character set
   ALTER DATABASE zentro_bot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

### Performance Optimization

1. **Index Optimization**
   ```sql
   -- Check slow queries
   SHOW VARIABLES LIKE 'slow_query_log';
   
   -- Analyze query performance
   EXPLAIN SELECT * FROM players WHERE guild_id = ?;
   ```

2. **Connection Pooling**
   ```javascript
   // Adjust connection pool settings
   const pool = mysql.createPool({
     connectionLimit: 20,
     acquireTimeout: 60000,
     timeout: 60000
   });
   ```

## 📊 Monitoring

### MySQL Status
```bash
# Check MySQL status
sudo systemctl status mysql

# View MySQL logs
sudo tail -f /var/log/mysql/error.log
```

### Bot Monitoring
```bash
# PM2 status
pm2 status

# View logs
pm2 logs zentro-bot

# Monitor resources
pm2 monit
```

## 🔒 Security Considerations

1. **Firewall Configuration**
   ```bash
   # Allow MySQL port (if needed for remote access)
   sudo ufw allow 3306
   ```

2. **User Permissions**
   ```sql
   -- Create restricted user for application
   CREATE USER 'zentro_app'@'localhost' IDENTIFIED BY 'secure_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON zentro_bot.* TO 'zentro_app'@'localhost';
   ```

3. **SSL Configuration**
   ```bash
   # Enable SSL for MySQL connections
   # Add to MySQL configuration
   ssl-ca=/path/to/ca-cert.pem
   ssl-cert=/path/to/server-cert.pem
   ssl-key=/path/to/server-key.pem
   ```

## ✅ Verification Checklist

- [ ] MySQL server installed and running
- [ ] Database and user created
- [ ] Environment variables configured
- [ ] Node.js dependencies installed
- [ ] Database schema created
- [ ] Migration scripts executed
- [ ] Bot starts without errors
- [ ] All commands working
- [ ] Linking system functional
- [ ] Economy system working
- [ ] Admin commands operational

## 🆘 Support

If you encounter issues:

1. Check the MySQL error logs: `/var/log/mysql/error.log`
2. Verify environment variables are correct
3. Test database connection manually
4. Review the migration logs for errors
5. Ensure all dependencies are installed

## 📈 Performance Tips

1. **Use Connection Pooling**: Already configured in the code
2. **Optimize Queries**: Use indexes on frequently queried columns
3. **Monitor Slow Queries**: Enable slow query logging
4. **Regular Backups**: Set up automated database backups
5. **Resource Monitoring**: Use PM2 for process management

This migration provides a complete, production-ready MySQL setup for your Zentro Bot with all the performance optimizations and security considerations needed for a Google Cloud VM deployment. 