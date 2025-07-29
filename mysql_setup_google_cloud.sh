#!/bin/bash

# MySQL/MariaDB Setup Script for Google Cloud VM
# This script installs and configures MySQL for the Zentro Bot

echo "🚀 Setting up MySQL/MariaDB for Zentro Bot on Google Cloud VM..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install MySQL Server
echo "🗄️ Installing MySQL Server..."
sudo apt install mysql-server -y

# Start and enable MySQL service
echo "🔧 Starting MySQL service..."
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure MySQL installation
echo "🔒 Securing MySQL installation..."
sudo mysql_secure_installation

# Create database and user for Zentro Bot
echo "👤 Creating database and user for Zentro Bot..."
sudo mysql -u root -p << EOF
CREATE DATABASE IF NOT EXISTS zentro_bot;
CREATE USER IF NOT EXISTS 'zentro_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';
CREATE USER IF NOT EXISTS 'zentro_user'@'%' IDENTIFIED BY 'your_secure_password_here';
GRANT ALL PRIVILEGES ON zentro_bot.* TO 'zentro_user'@'localhost';
GRANT ALL PRIVILEGES ON zentro_bot.* TO 'zentro_user'@'%';
FLUSH PRIVILEGES;
EOF

# Configure MySQL for better performance
echo "⚙️ Configuring MySQL for better performance..."
sudo tee /etc/mysql/mysql.conf.d/custom.cnf > /dev/null << EOF
[mysqld]
# Basic settings
default-storage-engine = InnoDB
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Connection settings
max_connections = 200
max_connect_errors = 10000

# Buffer settings
innodb_buffer_pool_size = 256M
innodb_log_file_size = 64M
innodb_log_buffer_size = 16M

# Query cache (if using MySQL 5.7 or earlier)
# query_cache_type = 1
# query_cache_size = 32M

# Performance settings
tmp_table_size = 64M
max_heap_table_size = 64M
table_open_cache = 2000

# Logging
log_error = /var/log/mysql/error.log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# Security
local_infile = 0
EOF

# Restart MySQL to apply configuration
echo "🔄 Restarting MySQL to apply configuration..."
sudo systemctl restart mysql

# Create log directory and set permissions
echo "📁 Setting up log directories..."
sudo mkdir -p /var/log/mysql
sudo chown mysql:mysql /var/log/mysql

# Install Node.js and npm (if not already installed)
echo "📦 Installing Node.js and npm..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
echo "⚡ Installing PM2 for process management..."
sudo npm install -g pm2

echo "✅ MySQL setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with MySQL credentials:"
echo "   DB_HOST=localhost"
echo "   DB_USER=zentro_user"
echo "   DB_PASSWORD=your_secure_password_here"
echo "   DB_NAME=zentro_bot"
echo "   DB_PORT=3306"
echo ""
echo "2. Install Node.js dependencies:"
echo "   npm install"
echo ""
echo "3. Run the MySQL migration:"
echo "   node mysql_migrate.js"
echo ""
echo "4. Start the bot:"
echo "   npm start"
echo ""
echo "🔧 MySQL is now ready for Zentro Bot!" 