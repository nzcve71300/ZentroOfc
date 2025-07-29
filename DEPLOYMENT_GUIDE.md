# Zentro Bot - Deployment Guide

## 🚀 **Quick Start (Windows)**

### **Step 1: Install MySQL**
Choose one of these options:

**Option A: XAMPP (Recommended)**
1. Download XAMPP: https://www.apachefriends.org/download.html
2. Install XAMPP with default settings
3. Start XAMPP Control Panel
4. Start MySQL service

**Option B: MySQL Server**
1. Download MySQL: https://dev.mysql.com/downloads/mysql/
2. Install with default settings
3. Set root password during installation

### **Step 2: Set Up Database**
1. Open MySQL command line or phpMyAdmin
2. Create database:
   ```sql
   CREATE DATABASE zentro_bot;
   ```

### **Step 3: Configure Environment**
1. Edit `.env` file:
   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your-actual-discord-bot-token
   CLIENT_ID=your-actual-discord-client-id
   
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=zentro_bot
   DB_USER=root
   DB_PASSWORD=your-mysql-password
   ```

### **Step 4: Run Setup Scripts**
```bash
# Install dependencies
npm install

# Run database migration
node mysql_migrate.js

# Run final fix
node final_fix.js

# Deploy Discord commands
node deploy-commands.js
```

### **Step 5: Start Bot**
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Or start directly
node src/index.js
```

## 🔧 **Troubleshooting**

### **MySQL Connection Issues**
```bash
# Test database connection
node setup_database.js

# Common solutions:
# 1. Make sure MySQL is running
# 2. Check credentials in .env
# 3. Verify database exists
```

### **RCON Connection Errors**
- These are normal if you haven't added real servers yet
- Use `/setup-server` to add your Rust servers
- Bot will skip invalid servers automatically

### **Discord Bot Issues**
```bash
# Check bot logs
pm2 logs zentro-bot

# Restart bot
pm2 restart zentro-bot

# Deploy commands again
node deploy-commands.js
```

## 📋 **Command Reference**

### **Admin Commands**
- `/setup-server` - Add Rust server
- `/add-shop-category` - Create shop category
- `/add-shop-item` - Add item to shop
- `/add-shop-kit` - Add kit to shop
- `/set-currency` - Set currency name
- `/eco-games-setup` - Configure games
- `/autokits-setup` - Configure autokits
- `/killfeed` - Enable/disable killfeed
- `/allow-link` - Unblock player
- `/unlink` - Unlink player

### **Player Commands**
- `/shop` - Access shop
- `/link` - Link Discord to game
- `/balance` - View balance
- `/daily` - Claim daily reward
- `/blackjack` - Play blackjack
- `/slots` - Play slots

## 🎯 **Testing Checklist**

### **Basic Setup**
- [ ] MySQL database created and accessible
- [ ] Bot connects to Discord successfully
- [ ] Commands are deployed and visible
- [ ] No database constraint errors in logs

### **Server Management**
- [ ] `/setup-server` works
- [ ] Server appears in autocomplete
- [ ] RCON connections work (if real servers added)

### **Shop System**
- [ ] `/add-shop-category` works
- [ ] `/add-shop-item` works
- [ ] `/shop` (player command) works
- [ ] Items can be purchased

### **Economy System**
- [ ] `/set-currency` works
- [ ] `/balance` shows correct balance
- [ ] `/daily` gives rewards
- [ ] `/blackjack` and `/slots` work

### **Player Linking**
- [ ] `/link` works
- [ ] `/allow-link` works (admin)
- [ ] `/unlink` works (admin)

## 🚨 **Common Issues & Solutions**

### **"MySQL connection failed"**
- Install MySQL/XAMPP
- Check credentials in `.env`
- Ensure MySQL service is running

### **"RCON connection refused"**
- Normal for placeholder servers
- Add real servers with `/setup-server`
- Check server IP/port/password

### **"Could not add constraint"**
- Run `node final_fix.js`
- This fixes database schema issues

### **"Unknown interaction"**
- Commands not deployed
- Run `node deploy-commands.js`
- Check bot permissions in Discord

### **"Permission denied"**
- Bot needs Zentro Admin role
- Or user needs Administrator permission
- Check role hierarchy in Discord

## 📊 **Monitoring**

### **Check Bot Status**
```bash
# View logs
pm2 logs zentro-bot

# Check status
pm2 status

# Restart if needed
pm2 restart zentro-bot
```

### **Database Health**
```bash
# Test connection
node setup_database.js

# Check tables
node test_mysql_connection.js
```

## 🎉 **Success Indicators**

✅ **Bot is working when:**
- No database errors in logs
- Commands respond properly
- Orange embeds display correctly
- Autocomplete works for servers
- Player commands function

✅ **Ready for production when:**
- All admin commands work
- Shop system is configured
- Economy games are set up
- Player linking works
- RCON connections stable (if using real servers)

## 🆘 **Support**

If you encounter issues:
1. Check the logs: `pm2 logs zentro-bot`
2. Run diagnostic: `node setup_database.js`
3. Run final fix: `node final_fix.js`
4. Restart bot: `pm2 restart zentro-bot`

The Zentro Bot is now fully MySQL-compatible and ready for deployment! 🚀 