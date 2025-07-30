# Zentro Bot - MariaDB Setup Guide

This guide provides complete setup instructions for running Zentro Bot with MariaDB/MySQL database.

## 🗄️ Database Requirements

- **MariaDB 10.5+** or **MySQL 8.0+**
- Port: **3306** (default)
- Database: **zentro_bot**
- User: **zentro_user**

## 🚀 Quick Setup (Windows)

### Option A: Automated Setup
1. Run `setup-env.bat` to create environment file
2. Edit `.env` file with your Discord bot token
3. Run `setup-mariadb.bat` to set up database
4. Run `apply-mariadb-schema.bat` to create tables
5. Run `npm install` to install dependencies
6. Run `npm start` to start the bot

### Option B: Manual Setup

#### 1. Install MariaDB
- **Option 1**: Download from [MariaDB.org](https://mariadb.org/download/)
- **Option 2**: Use XAMPP (includes MariaDB)
- **Option 3**: Use Docker: `docker run --name zentro_mariadb -e MYSQL_ROOT_PASSWORD=admin -e MYSQL_DATABASE=zentro_bot -p 3306:3306 -d mariadb:latest`

#### 2. Create Database
```sql
CREATE DATABASE zentro_bot;
CREATE USER 'zentro_user'@'localhost' IDENTIFIED BY 'zentro_password';
GRANT ALL PRIVILEGES ON zentro_bot.* TO 'zentro_user'@'localhost';
FLUSH PRIVILEGES;
```

#### 3. Apply Schema
```bash
mysql -u zentro_user -pzentro_password zentro_bot < mysql_schema.sql
```

## 🔧 Environment Configuration

Create a `.env` file in the project root:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here

# MariaDB Database Configuration
DB_HOST=localhost
DB_USER=zentro_user
DB_PASSWORD=zentro_password
DB_NAME=zentro_bot
DB_PORT=3306

# RCON Configuration
RCON_DEFAULT_PORT=28016
RCON_DEFAULT_PASSWORD=your_rcon_password_here
```

## 📊 Database Schema

The bot uses the following tables:

### Core Tables
- `guilds` - Discord guilds (servers)
- `rust_servers` - Rust game servers
- `players` - Player accounts and links

### Economy System
- `economy` - Player balances
- `transactions` - Transaction history

### Shop System
- `shop_categories` - Shop categories
- `shop_items` - Shop items
- `shop_kits` - Shop kits

### Game Features
- `autokits` - Automatic kit configurations
- `kit_auth` - Kit authorization
- `killfeed_configs` - Killfeed settings
- `player_stats` - Player statistics
- `zones` - Zone management

### Linking System
- `link_requests` - Link request queue
- `link_blocks` - Blocked players

## 🔍 Testing Database Connection

Run the test script to verify your database setup:

```bash
node test-db.js
```

This will:
- Test database connection
- Verify table structure
- Test basic operations

## 🛠️ Troubleshooting

### Common Issues

#### 1. Connection Refused
- Ensure MariaDB service is running
- Check if port 3306 is available
- Verify firewall settings

#### 2. Access Denied
- Check username/password in `.env`
- Verify user has proper permissions
- Try connecting as root first

#### 3. Table Not Found
- Run `apply-mariadb-schema.bat` to create tables
- Check if schema was applied correctly

#### 4. Auto-increment Issues
- Ensure tables use `AUTO_INCREMENT` (not `SERIAL`)
- Check primary key constraints

### Useful Commands

```bash
# Check MariaDB status
mysql --version

# Connect to database
mysql -u zentro_user -pzentro_password zentro_bot

# Show tables
SHOW TABLES;

# Check table structure
DESCRIBE guilds;
```

## 🔄 Migration from PostgreSQL

If migrating from PostgreSQL:

1. **Backup PostgreSQL data**:
   ```bash
   pg_dump zentro_bot > postgres_backup.sql
   ```

2. **Install MariaDB** (see above)

3. **Create new database**:
   ```bash
   mysql -u root -p
   CREATE DATABASE zentro_bot;
   ```

4. **Apply MariaDB schema**:
   ```bash
   mysql -u zentro_user -pzentro_password zentro_bot < mysql_schema.sql
   ```

5. **Migrate data** (if needed):
   - Export PostgreSQL data to CSV
   - Import into MariaDB using `LOAD DATA INFILE`

## 📝 Key Differences from PostgreSQL

| Feature | PostgreSQL | MariaDB/MySQL |
|---------|------------|---------------|
| Auto-increment | `SERIAL` | `AUTO_INCREMENT` |
| Timestamp | `NOW()` | `CURRENT_TIMESTAMP` |
| JSON | `JSONB` | `JSON` |
| Port | `5432` | `3306` |
| Package | `pg` | `mysql2` |

## 🎯 Next Steps

After successful database setup:

1. **Install dependencies**: `npm install`
2. **Configure Discord bot**: Update token in `.env`
3. **Start the bot**: `npm start`
4. **Deploy commands**: Use the deploy scripts
5. **Test functionality**: Try basic commands

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify MariaDB installation and configuration
3. Test database connection with `test-db.js`
4. Check bot logs for specific error messages

---

**Note**: This bot is designed for MariaDB/MySQL and has been fully migrated from PostgreSQL. All database operations use parameterized queries for security. 