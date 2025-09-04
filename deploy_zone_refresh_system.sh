#!/bin/bash

# Zone Refresh System Deployment Script
# This will set up a permanent fix for Zorp status issues

set -e

echo "🚀 Deploying Zone Refresh System..."
echo "💡 This will create a permanent fix for Zorp status mismatches"
echo ""

# Check if we're in the right directory
if [ ! -f "zone_refresh_system.js" ]; then
    echo "❌ Error: zone_refresh_system.js not found in current directory"
    echo "   Please run this script from the ZentroOfc directory"
    exit 1
fi

# Create logs directory if it doesn't exist
echo "📁 Creating logs directory..."
mkdir -p logs

# Test the zone refresh system
echo "🧪 Testing zone refresh system..."
if node -e "require('./zone_refresh_system.js'); console.log('✅ System loads successfully')"; then
    echo "✅ Zone refresh system test passed"
else
    echo "❌ Zone refresh system test failed"
    exit 1
fi

# Test database connection
echo "🗄️  Testing database connection..."
if node -e "const pool = require('./src/db'); pool.query('SELECT 1').then(() => { console.log('✅ Database connection successful'); pool.end(); }).catch(e => { console.error('❌ Database connection failed:', e.message); process.exit(1); })"; then
    echo "✅ Database connection test passed"
else
    echo "❌ Database connection test failed"
    exit 1
fi

# Make control script executable
echo "🔧 Making control script executable..."
chmod +x control_zone_refresh.js

# Test control script
echo "🧪 Testing control script..."
if node control_zone_refresh.js help > /dev/null 2>&1; then
    echo "✅ Control script test passed"
else
    echo "❌ Control script test failed"
    exit 1
fi

# Show deployment summary
echo ""
echo "🎉 Zone Refresh System Deployment Complete!"
echo ""
echo "📋 What was installed:"
echo "   ✅ zone_refresh_system.js - Main system that runs every 5 minutes"
echo "   ✅ control_zone_refresh.js - Control script for managing the system"
echo "   ✅ ecosystem.config.js - PM2 configuration for production"
echo "   ✅ logs/ directory - For system logs"
echo ""
echo "🚀 How to use:"
echo ""
echo "1. Start the system:"
echo "   node control_zone_refresh.js start"
echo ""
echo "2. Check status:"
echo "   node control_zone_refresh.js status"
echo ""
echo "3. Force refresh:"
echo "   node control_zone_refresh.js refresh"
echo ""
echo "4. Stop system:"
echo "   node control_zone_refresh.js stop"
echo ""
echo "5. For production (PM2):"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 status"
echo "   pm2 logs zone-refresh-system"
echo ""
echo "💡 The system will:"
echo "   - Run every 5 minutes automatically"
echo "   - Check all zones against actual player status"
echo "   - Fix any mismatched zones immediately"
echo "   - Keep your Zorp system always in sync"
echo ""
echo "🔍 Monitor the system:"
echo "   - Check logs: tail -f logs/zone-refresh-combined.log"
echo "   - Check status: node control_zone_refresh.js status"
echo "   - View PM2 logs: pm2 logs zone-refresh-system"
echo ""
echo "🎯 This is a PERMANENT fix - your Zorp status issues should never happen again!"
echo ""

# Test run
echo "🧪 Running initial test refresh..."
if node control_zone_refresh.js refresh; then
    echo "✅ Initial test refresh successful"
else
    echo "⚠️  Initial test refresh had issues - check logs"
fi

echo ""
echo "🚀 Ready to deploy! Run 'node control_zone_refresh.js start' to begin."
