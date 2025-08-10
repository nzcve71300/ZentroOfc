#!/bin/bash

echo "🛑 Stopping Zentro Bot Services..."

# Stop all PM2 processes
pm2 stop all
pm2 delete all

echo "✅ All services stopped successfully!"
echo ""
echo "📋 To start services again, run:"
echo "  ./start-services.sh" 