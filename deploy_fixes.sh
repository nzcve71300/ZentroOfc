#!/bin/bash

echo "🚀 Deploying Zentro Bot Fixes"
echo "=============================="

# Navigate to the project directory
cd ~/ZentroOfc

echo "📥 Pulling latest changes..."
git pull origin main

echo "🔧 Installing dependencies..."
npm install

echo "🧹 Cleaning up invalid servers..."
node cleanup_invalid_servers.js

echo "🔧 Fixing database schema..."
node fix_database_schema.js

echo "🔄 Restarting the bot..."
pm2 restart zentro-bot

echo "✅ Deployment complete!"
echo "📊 Check bot status: pm2 status"
echo "📋 Check logs: pm2 logs zentro-bot" 