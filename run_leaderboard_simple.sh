#!/bin/bash
echo "🔧 Running simple leaderboard migration..."
echo "This creates the leaderboard table without foreign key constraints."
echo "Please enter your MySQL password when prompted:"
mysql -u zentro_user -p zentro_bot < fix_leaderboard_simple.sql
if [ $? -eq 0 ]; then
    echo "✅ Leaderboard migration completed successfully!"
    echo "✅ Leaderboard settings table created"
    echo "✅ Indexes added for performance"
    echo ""
    echo "Now restarting the bot..."
    pm2 restart zentro-bot
    echo "✅ Bot restarted successfully!"
    echo ""
    echo "🎉 Leaderboard system is now ready!"
    echo "You can use /servers-leaderboard to set up the channel."
else
    echo "❌ Leaderboard migration failed!"
    echo "Please check the error message above."
fi 