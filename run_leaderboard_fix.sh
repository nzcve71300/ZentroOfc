#!/bin/bash
echo "🔧 Running leaderboard migration fix..."
echo "This adds the missing index and creates the leaderboard table."
echo "Please enter your MySQL password when prompted:"
mysql -u zentro_user -p zentro_bot < fix_leaderboard_migration.sql
if [ $? -eq 0 ]; then
    echo "✅ Leaderboard migration completed successfully!"
    echo "✅ Missing index added to guilds table"
    echo "✅ Leaderboard settings table created"
    echo "✅ Foreign key constraint added"
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