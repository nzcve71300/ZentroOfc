#!/bin/bash

echo "🔧 Fixing database errors for Zentro Bot..."
echo "Please enter your MySQL root password when prompted:"

mysql -u root -p zentro_bot < fix_database_errors.sql

if [ $? -eq 0 ]; then
    echo "✅ Database fixes applied successfully!"
    echo "✅ Missing servers table created"
    echo "✅ Duplicate key errors resolved"
    echo ""
    echo "Now restarting the bot..."
    pm2 restart zentro-bot
    echo "✅ Bot restarted successfully!"
else
    echo "❌ Database fix failed!"
    echo "Please check the error message above."
fi 