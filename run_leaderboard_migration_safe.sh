#!/bin/bash
echo "🔧 Running safe leaderboard database migration..."
echo "This version handles foreign key constraint issues."
echo "Please enter your MySQL password when prompted:"
mysql -u zentro_user -p zentro_bot < leaderboard_migration_safe.sql
if [ $? -eq 0 ]; then
    echo "✅ Leaderboard migration completed successfully!"
    echo "✅ Leaderboard settings table created"
    echo "✅ Indexes created"
    echo ""
    echo "Now restarting the bot..."
    pm2 restart zentro-bot
    echo "✅ Bot restarted successfully!"
else
    echo "❌ Leaderboard migration failed!"
    echo "Please check the error message above."
fi 