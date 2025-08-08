#!/bin/bash
echo "🔧 Adding original_name column to channel_settings table..."
echo "This will allow player count channels to preserve their original names."
echo "Please enter your MySQL password when prompted:"

mysql -u zentro_user -p zentro_bot < add_original_name_column.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "✅ original_name column added to channel_settings table"
    echo ""
    echo "Now restarting the bot to apply changes..."
    pm2 restart zentro-bot
    echo "✅ Bot restarted successfully!"
    echo ""
    echo "🎉 Player count channels will now preserve their original names!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Use /channel-set to set up a playercount channel"
    echo "2. The bot will now append '🌐1 🕑0' to the original channel name"
    echo "3. Example: 'My Server Status' becomes 'My Server Status 🌐5 🕑2'"
else
    echo "❌ Migration failed!"
    echo "Please check the error message above."
fi