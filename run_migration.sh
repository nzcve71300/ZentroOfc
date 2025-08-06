#!/bin/bash

echo "Running database migration to add currency_name column..."
echo "Please enter your MySQL root password when prompted:"

mysql -u root -p zentro_bot < add_currency_name_column.sql

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully!"
    echo "✅ Currency name column has been added to rust_servers table"
    echo ""
    echo "Now restarting the bot..."
    pm2 restart zentro-bot
    echo "✅ Bot restarted successfully!"
else
    echo "❌ Database migration failed!"
    echo "Please check the error message above."
fi 