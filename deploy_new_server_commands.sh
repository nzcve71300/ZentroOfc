#!/bin/bash

# Deploy Discord slash commands for new server
# This script should be run via SSH after adding a new server with /setup-server

echo "🚀 Deploying Discord slash commands for new server..."
echo "Server: 149.102.129.112:29316"
echo "Guild ID: 1403207665106292850"
echo ""

# Change to the bot directory (using current directory since you're already in ~/ZentroOfc)
cd ~/ZentroOfc || {
    echo "❌ Failed to change to bot directory"
    echo "Please make sure you're running this from the correct directory"
    exit 1
}

# Load environment variables
if [ -f .env ]; then
    echo "📋 Loading environment variables..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found!"
    exit 1
fi

# Check if required environment variables are set
if [ -z "$DISCORD_TOKEN" ] || [ -z "$CLIENT_ID" ]; then
    echo "❌ Missing required environment variables (DISCORD_TOKEN or CLIENT_ID)"
    exit 1
fi

echo "✅ Environment variables loaded"

# Deploy commands globally (this makes them available to all guilds including the new one)
echo "🔄 Deploying commands globally..."
node deploy-all-commands.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Commands deployed successfully!"
    echo "🎉 The new server should now have all slash commands available"
    echo ""
    echo "📝 New Server Details:"
    echo "   • IP: 149.102.129.112"
    echo "   • RCON Port: 29316" 
    echo "   • RCON Password: s6x0xRVw"
    echo "   • Guild ID: 1403207665106292850"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Test /list-servers to verify the server was added"
    echo "   2. Test other commands to ensure they're working"
    echo "   3. Configure any additional settings as needed"
else
    echo ""
    echo "❌ Command deployment failed!"
    echo "Please check the error messages above and try again"
    exit 1
fi
