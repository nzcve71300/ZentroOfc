#!/bin/bash

echo "📋 Zentro Bot Logs Viewer"
echo ""

if [ "$1" = "bot" ]; then
    echo "🤖 Discord Bot Logs:"
    pm2 logs zentro-bot --lines 50
elif [ "$1" = "api" ]; then
    echo "🌐 API Server Logs:"
    pm2 logs nivaro-api --lines 50
elif [ "$1" = "all" ]; then
    echo "📊 All Services Logs:"
    pm2 logs --lines 30
else
    echo "Usage:"
    echo "  ./view-logs.sh bot    - View Discord bot logs"
    echo "  ./view-logs.sh api    - View API server logs"
    echo "  ./view-logs.sh all    - View all logs"
    echo ""
    echo "📊 Current Status:"
    pm2 status
fi 