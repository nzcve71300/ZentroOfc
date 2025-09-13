#!/bin/bash

# Zentro Bot - Command Deployment Script for Linux/Mac

echo "🚀 Zentro Bot - Command Deployment"
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

echo "ℹ️  Deploying commands globally..."
echo

# Run the deployment script
node deploy-commands.js

echo
echo "✅ Command deployment completed!"
echo
