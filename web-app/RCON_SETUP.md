# Zentro Gaming Hub - RCON Bot Setup Guide

This guide will help you set up the Zentro Gaming Hub with real RCON connections to your Rust servers.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up MariaDB Database

#### Option A: Using Docker (Recommended)
```bash
# Start MariaDB container
docker run --name zentro-db \
  -e MYSQL_ROOT_PASSWORD=your_root_password \
  -e MYSQL_DATABASE=zentro_gaming_hub \
  -e MYSQL_USER=zentro_user \
  -e MYSQL_PASSWORD=your_secure_password \
  -p 3306:3306 \
  -d mariadb:latest

# Initialize database schema
node scripts/init-database.js
```

#### Option B: Local MariaDB Installation
1. Install MariaDB on your system
2. Create database and user:
```sql
CREATE DATABASE zentro_gaming_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'zentro_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON zentro_gaming_hub.* TO 'zentro_user'@'localhost';
FLUSH PRIVILEGES;
```
3. Initialize schema:
```bash
node scripts/init-database.js
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=zentro_user
DB_PASSWORD=your_secure_password
DB_NAME=zentro_gaming_hub

# Encryption Key (Generate a secure 32-character key)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Application Configuration
NODE_ENV=development
PORT=8081
```

### 4. Start the Application

```bash
npm run dev
```

The app will be available at `http://localhost:8081` [[memory:5833326]].

## 🎮 Setting Up Your Rust Server

### 1. Enable RCON on Your Rust Server

Add these settings to your `server.cfg`:

```cfg
# RCON Configuration
rcon.web 1
rcon.port 28015
rcon.password "your_secure_rcon_password"
```

### 2. Restart Your Rust Server

After adding the RCON configuration, restart your Rust server to apply the changes.

### 3. Test RCON Connection

You can test your RCON connection using the built-in test feature in the app, or manually:

```bash
# Test with telnet (optional)
telnet your_server_ip 28015
```

## 🔧 Adding Your Server to Zentro

1. **Navigate to Server Setup**: Go to the server setup page in the app
2. **Fill in Server Details**:
   - **Server Name**: A friendly name for your server
   - **Server IP**: Your server's IP address or hostname
   - **RCON Port**: Usually 28015 (default Rust RCON port)
   - **RCON Password**: The password you set in your server.cfg
3. **Test Connection**: The app will automatically test the RCON connection
4. **Create Server**: Once the connection test passes, your server will be added

## 📊 Features

### Real-Time Player Tracking
- **Player Joins/Leaves**: Automatically detected and logged
- **Kill/Death Tracking**: Real-time statistics updates
- **Chat Monitoring**: All chat messages are logged
- **Server-Specific Data**: Each server maintains its own player data

### Database Structure
- **Clean Schema**: Well-structured MariaDB database with proper relationships
- **Data Integrity**: Foreign key constraints and data validation
- **Performance Optimized**: Indexed queries for fast data retrieval
- **Encrypted Passwords**: RCON passwords are encrypted before storage

### Server Management
- **Connection Status**: Real-time connection monitoring
- **Automatic Reconnection**: Handles connection drops gracefully
- **Command Execution**: Send RCON commands directly from the app
- **Event Logging**: Complete audit trail of all server events

## 🛡️ Security Features

### Data Protection
- **Encrypted RCON Passwords**: All passwords are encrypted using AES-256-GCM
- **Secure Database**: Proper user permissions and connection security
- **Input Validation**: All user inputs are validated and sanitized
- **SQL Injection Protection**: Parameterized queries prevent SQL injection

### Access Control
- **User-Based Servers**: Each user can only access their own servers
- **Connection Verification**: RCON connections are tested before storage
- **Audit Logging**: All actions are logged for security monitoring

## 🔍 Monitoring and Analytics

### Server Statistics
- **Player Count**: Real-time player statistics
- **Activity Tracking**: Player activity and engagement metrics
- **Performance Monitoring**: Server performance and connection health
- **Event History**: Complete log of all server events

### Player Analytics
- **Kill/Death Ratios**: Player performance tracking
- **Playtime Statistics**: Time spent on each server
- **Balance Tracking**: In-game economy monitoring
- **Leaderboards**: Top players by various metrics

## 🚨 Troubleshooting

### Common Issues

#### RCON Connection Failed
- **Check Firewall**: Ensure RCON port (28015) is open
- **Verify Password**: Double-check your RCON password
- **Server Status**: Make sure your Rust server is running
- **Port Configuration**: Confirm the RCON port in server.cfg

#### Database Connection Issues
- **Check Credentials**: Verify database username and password
- **Network Access**: Ensure database is accessible from your app
- **Schema Initialization**: Run the database initialization script
- **Permissions**: Verify database user has proper permissions

#### Player Data Not Updating
- **RCON Connection**: Check if RCON connection is active
- **Server Events**: Verify server is sending proper event messages
- **Database Logs**: Check database for any error messages
- **Bot Status**: Ensure the RCON bot is running and connected

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=true
VERBOSE_LOGGING=true
LOG_LEVEL=debug
```

## 📈 Performance Optimization

### Database Optimization
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Indexed queries for fast data retrieval
- **Transaction Management**: Proper transaction handling for data integrity

### RCON Optimization
- **Connection Pooling**: Reuse RCON connections when possible
- **Command Queuing**: Queue commands to avoid overwhelming servers
- **Rate Limiting**: Prevent command spam and server overload
- **Error Handling**: Graceful handling of connection issues

## 🔄 Maintenance

### Regular Tasks
- **Database Backups**: Regular database backups for data safety
- **Log Rotation**: Manage log files to prevent disk space issues
- **Connection Monitoring**: Monitor RCON connection health
- **Performance Review**: Regular performance analysis and optimization

### Updates
- **Schema Migrations**: Handle database schema updates safely
- **Bot Updates**: Keep RCON bot updated with latest features
- **Security Patches**: Apply security updates regularly

## 📞 Support

If you encounter any issues:

1. **Check Logs**: Review application and database logs
2. **Verify Configuration**: Double-check all configuration settings
3. **Test Connections**: Verify RCON and database connections
4. **Review Documentation**: Check this guide for common solutions

## 🎯 Next Steps

After setting up your RCON bot:

1. **Add Multiple Servers**: Connect multiple Rust servers
2. **Configure Monitoring**: Set up alerts and monitoring
3. **Customize Features**: Configure player tracking and analytics
4. **Scale Up**: Add more servers and players as needed

---

**Happy Gaming! 🎮**

Your Zentro Gaming Hub is now ready to manage your Rust servers with real-time RCON connections and comprehensive player tracking.
