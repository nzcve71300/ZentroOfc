#!/bin/bash

echo "🚀 Starting Zentro Bot Services..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 not found. Installing PM2..."
    sudo npm install -g pm2
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if services are already running
if pm2 list | grep -q "zentro-bot\|nivaro-api"; then
    echo "⚠️  Services are already running. Stopping them first..."
    pm2 stop all
    pm2 delete all
fi

# Start both services
echo "📦 Starting Discord Bot..."
pm2 start ecosystem.config.js

# Wait a moment for services to start
sleep 3

# Show status
echo "📊 Service Status:"
pm2 status

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📋 Useful commands:"
echo "  pm2 status          - Check service status"
echo "  pm2 logs zentro-bot - View Discord bot logs"
echo "  pm2 logs nivaro-api - View API server logs"
echo "  pm2 restart all     - Restart all services"
echo "  pm2 stop all        - Stop all services"
echo ""
echo "🌐 API Server: http://localhost:3001"
echo "🔗 Health Check: http://localhost:3001/health" 