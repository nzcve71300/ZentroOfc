#!/bin/bash

# Zentro Bot Deployment Script for Google Cloud VM

echo "🚀 Starting Zentro Bot deployment..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm if not already installed
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2..."
    sudo npm install -g pm2
fi

# Install PostgreSQL if not already installed
if ! command -v psql &> /dev/null; then
    echo "📥 Installing PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

# Create database and user
echo "🗄️ Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE zentro_bot;"
sudo -u postgres psql -c "CREATE USER zentro_user WITH PASSWORD 'zentro_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zentro_bot TO zentro_user;"

# Install project dependencies
echo "📦 Installing project dependencies..."
npm install

# Create logs directory
mkdir -p logs

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
DISCORD_TOKEN=your-discord-token-here
PGHOST=localhost
PGUSER=zentro_user
PGPASSWORD=zentro_password
PGDATABASE=zentro_bot
PGPORT=5432
RCON_DEFAULT_PORT=28016
RCON_DEFAULT_PASSWORD=changeme
EOF
    echo "⚠️  Please edit .env file with your actual Discord token and database credentials!"
fi

# Run database schema
echo "🗄️ Setting up database schema..."
sudo -u postgres psql -d zentro_bot -f schema.sql

# Start the bot with PM2
echo "🤖 Starting Zentro Bot with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

echo "✅ Deployment complete! Bot should be running."
echo "📊 Check status with: pm2 status"
echo "📋 View logs with: pm2 logs zentro-bot" 