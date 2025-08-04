#!/bin/bash

echo "🎨 Installing Canvas Dependencies for Visual Status Command..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update

# Install system dependencies for canvas
echo "🔧 Installing system dependencies for canvas..."
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# Install Node.js dependencies with correct Chart.js version
echo "📦 Installing Node.js dependencies..."
npm install canvas@^2.11.2 chart.js@^3.9.1 chartjs-node-canvas@^4.1.6

echo "✅ Canvas dependencies installed successfully!"
echo "🚀 You can now deploy the visual status command:"
echo "   node deploy-commands.js"
echo "   pm2 restart zentro-bot" 