#!/bin/bash
echo "🔧 Running Weekly Maintenance for Zentro Bot..."
echo "This prevents common issues from recurring."
echo ""

# Check for issues first
echo "📊 Checking for issues..."
node preventive_maintenance.js

echo ""
echo "🔧 Applying automatic fixes..."
mysql -u zentro_user -p zentro_bot < auto_fix_common_issues.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Weekly maintenance completed successfully!"
    echo "🔄 Restarting bot to ensure clean state..."
    pm2 restart zentro-bot
    echo "✅ Bot restarted!"
    echo ""
    echo "📋 Maintenance Summary:"
    echo "  - Cleaned invalid ZORP zones"
    echo "  - Fixed color formats"
    echo "  - Removed orphaned records"
    echo "  - Cleaned duplicates"
    echo "  - Ensured economy consistency"
    echo "  - Removed expired zones"
    echo ""
    echo "🎉 All systems optimized and healthy!"
else
    echo "❌ Maintenance failed! Check the error above."
fi