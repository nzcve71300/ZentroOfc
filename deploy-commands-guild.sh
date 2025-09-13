#!/bin/bash

# Zentro Bot - Guild Command Deployment Script for Linux/Mac (Testing)

echo "🚀 Zentro Bot - Guild Command Deployment (Testing)"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "Please create a .env file with your Discord bot configuration"
    exit 1
fi

echo "ℹ️  Deploying commands to guild for testing..."
echo "ℹ️  Make sure TEST_GUILD_ID is set in your .env file"
echo

# Run the deployment script
node deploy-commands-guild.js

echo
echo "✅ Guild command deployment completed!"
echo
