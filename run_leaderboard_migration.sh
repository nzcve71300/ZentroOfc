#!/bin/bash
echo "🔧 Running leaderboard database migration..."
echo "Please enter your MySQL password when prompted:"
mysql -u zentro_user -p zentro_bot < leaderboard_migration.sql
if [ $? -eq 0 ]; then
    echo "✅ Leaderboard migration completed successfully!"
    echo "✅ Leaderboard settings table created"
    echo ""
    echo "Now restarting the bot..."
    pm2 restart zentro-bot
    echo "✅ Bot restarted successfully!"
else
    echo "❌ Leaderboard migration failed!"
    echo "Please check the error message above."
fi 