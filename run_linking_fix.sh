#!/bin/bash
echo "🔧 Fixing linking system issues..."
echo "This will clean up the database and fix linking problems."
echo "Please enter your MySQL password when prompted:"
mysql -u zentro_user -p zentro_bot < fix_linking_system.sql
if [ $? -eq 0 ]; then
    echo "✅ Linking system fixed successfully!"
    echo "✅ Duplicate records removed"
    echo "✅ Data types corrected"
    echo "✅ Constraints and indexes created"
    echo "✅ Economy records cleaned up"
    echo ""
    echo "Now restarting the bot..."
    pm2 restart zentro-bot
    echo "✅ Bot restarted successfully!"
    echo ""
    echo "🎉 Linking system should now work properly!"
    echo "Players should be able to link without false 'already linked' errors."
else
    echo "❌ Linking system fix failed!"
    echo "Please check the error message above."
fi 