# 🚀 Zentro Gaming Hub - Google Cloud VM Deployment Guide

This guide will help you deploy your RCON bot system to a Google Cloud VM with MariaDB.

## 📋 Prerequisites

- Google Cloud Platform account
- GitHub account
- Basic knowledge of Linux commands

## 🎯 Step-by-Step Deployment

### Step 1: Create Google Cloud VM

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** (or select existing one)
3. **Enable Compute Engine API**
4. **Create VM Instance**:
   - **Name**: `zentro-gaming-hub`
   - **Region**: Choose closest to your users
   - **Machine Type**: `e2-medium` (2 vCPU, 4GB RAM) - minimum recommended
   - **Boot Disk**: Ubuntu 20.04 LTS or newer
   - **Firewall**: Allow HTTP and HTTPS traffic
   - **SSH Keys**: Add your public SSH key

### Step 2: Create GitHub Repository

1. **Go to GitHub**: https://github.com/new
2. **Repository name**: `zentro-game-hub`
3. **Make it private** (recommended for production)
4. **Don't initialize** with README (we already have files)

### Step 3: Push Your Code to GitHub

```bash
# Add GitHub remote (replace with your username)
git remote add origin https://github.com/YOUR_USERNAME/zentro-game-hub.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 4: Connect to Your VM

```bash
# SSH into your VM (replace with your VM's external IP)
ssh -i ~/.ssh/your_key username@YOUR_VM_IP
```

### Step 5: Run Deployment Script

```bash
# Download and run the deployment script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/zentro-game-hub/main/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

### Step 6: Clone Your Repository

```bash
# Clone your repository
cd /var/www/zentro
git clone https://github.com/YOUR_USERNAME/zentro-game-hub.git .

# Install dependencies
npm install
```

### Step 7: Set Up MariaDB

```bash
# Create database and user
sudo mysql -u root -p

# In MySQL prompt:
CREATE DATABASE zentro_gaming_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'zentro_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON zentro_gaming_hub.* TO 'zentro_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Initialize database schema
node scripts/init-database.js
```

### Step 8: Configure Environment Variables

```bash
# Copy the production config
cp deploy-config.env .env

# Edit the configuration
nano .env
```

**Important**: Update these values in `.env`:
- `DB_PASSWORD`: Your MariaDB password
- `ENCRYPTION_KEY`: Generate a secure 32-character key
- `JWT_SECRET`: Generate a secure JWT secret
- `SESSION_SECRET`: Generate a secure session secret

### Step 9: Set Up Nginx

```bash
# Copy Nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/zentro
sudo ln -s /etc/nginx/sites-available/zentro /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 10: Start the Application

```bash
# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

### Step 11: Set Up SSL (Optional but Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

## 🔧 Configuration Details

### Database Configuration

The MariaDB setup includes:
- **Database**: `zentro_gaming_hub`
- **User**: `zentro_user`
- **Tables**: Users, servers, players, player_stats, player_balances, server_events
- **Encryption**: RCON passwords are encrypted with AES-256-GCM

### Application Configuration

- **Port**: 8081 (internal)
- **Nginx**: Handles external traffic on port 80/443
- **PM2**: Manages the Node.js process
- **Logs**: Located in `/var/log/zentro/`

### Security Features

- **Encrypted passwords**: All RCON passwords are encrypted
- **SQL injection protection**: Parameterized queries
- **Rate limiting**: Built-in request limiting
- **CORS**: Configurable cross-origin policies
- **SSL/TLS**: HTTPS encryption (with Certbot)

## 📊 Monitoring

### Check Application Status

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs zentro-game-hub

# Restart application
pm2 restart zentro-game-hub
```

### Check Database

```bash
# Connect to database
mysql -u zentro_user -p zentro_gaming_hub

# Check tables
SHOW TABLES;

# Check server connections
SELECT * FROM servers;
```

### Check Nginx

```bash
# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/zentro_access.log
sudo tail -f /var/log/nginx/zentro_error.log
```

## 🔄 Updates and Maintenance

### Update Application

```bash
# Pull latest changes
cd /var/www/zentro
git pull origin main

# Install new dependencies
npm install

# Build application
npm run build

# Restart with PM2
pm2 restart zentro-game-hub
```

### Database Backups

```bash
# Create backup
mysqldump -u zentro_user -p zentro_gaming_hub > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
mysql -u zentro_user -p zentro_gaming_hub < backup_file.sql
```

## 🚨 Troubleshooting

### Common Issues

1. **Application won't start**:
   ```bash
   pm2 logs zentro-game-hub
   ```

2. **Database connection failed**:
   ```bash
   sudo systemctl status mariadb
   mysql -u zentro_user -p
   ```

3. **Nginx errors**:
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

4. **Port conflicts**:
   ```bash
   sudo netstat -tlnp | grep :8081
   ```

### Log Locations

- **Application logs**: `/var/log/zentro/`
- **Nginx logs**: `/var/log/nginx/`
- **System logs**: `/var/log/syslog`

## 📈 Scaling

### Increase VM Resources

1. **Stop the VM** in Google Cloud Console
2. **Change machine type** to larger instance
3. **Start the VM**
4. **Restart services**:
   ```bash
   pm2 restart zentro-game-hub
   sudo systemctl restart nginx
   ```

### Load Balancing (Advanced)

For high traffic, consider:
- **Multiple VM instances**
- **Google Cloud Load Balancer**
- **Database read replicas**
- **Redis for caching**

## 🎉 Success!

Your Zentro Gaming Hub is now running on Google Cloud VM with:
- ✅ Real RCON connections to Rust servers
- ✅ MariaDB database with encrypted passwords
- ✅ Nginx reverse proxy with SSL
- ✅ PM2 process management
- ✅ Automatic restarts and monitoring

## 🔗 Next Steps

1. **Add your first Rust server** through the web interface
2. **Configure your domain** to point to the VM's IP
3. **Set up monitoring** and alerts
4. **Test RCON connections** with your Rust servers
5. **Monitor player activity** and server statistics

---

**Need help?** Check the logs and troubleshooting section above, or review the RCON_SETUP.md for detailed RCON configuration.
