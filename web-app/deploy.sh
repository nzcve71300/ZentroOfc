#!/bin/bash

# Zentro Gaming Hub - Google Cloud VM Deployment Script
# This script sets up the application on a Google Cloud VM

set -e  # Exit on any error

echo "🚀 Starting Zentro Gaming Hub deployment..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MariaDB
echo "🗄️ Installing MariaDB..."
sudo apt install -y mariadb-server mariadb-client

# Start and enable MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Secure MariaDB installation
echo "🔒 Securing MariaDB installation..."
sudo mysql_secure_installation

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/zentro
sudo chown -R $USER:$USER /var/www/zentro

# Create log directory
sudo mkdir -p /var/log/zentro
sudo chown -R $USER:$USER /var/log/zentro

# Create uploads directory
sudo mkdir -p /var/www/zentro/uploads
sudo chown -R $USER:$USER /var/www/zentro/uploads

echo "✅ System setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Clone your repository to /var/www/zentro"
echo "2. Install dependencies: npm install"
echo "3. Set up database: node scripts/init-database.js"
echo "4. Configure environment variables"
echo "5. Start the application with PM2"
echo ""
echo "🔧 To continue setup, run:"
echo "cd /var/www/zentro"
echo "git clone https://github.com/yourusername/zentro-game-hub.git ."
echo "npm install"
echo "node scripts/init-database.js"
