#!/bin/bash

echo "🚀 Deploying In-Game Kit Delivery Emote System..."
echo "================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Test the modified files for syntax errors
echo -e "${YELLOW}Step 1: Testing modified files for syntax errors...${NC}"

echo "Testing src/events/interactionCreate.js..."
node -c src/events/interactionCreate.js
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Syntax error in interactionCreate.js!${NC}"
    exit 1
fi

echo "Testing src/index.js..."
node -c src/index.js
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Syntax error in index.js!${NC}"
    exit 1
fi

echo "Testing src/rcon/index.js..."
node -c src/rcon/index.js
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Syntax error in rcon/index.js!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All files passed syntax check!${NC}"
echo ""

# Step 2: Check PM2 status
echo -e "${YELLOW}Step 2: Checking PM2 status...${NC}"
pm2 list | grep zentro
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Zentro bot not found in PM2!${NC}"
    echo "Please start the bot with: pm2 start ecosystem.config.js"
    exit 1
fi
echo -e "${GREEN}✅ Bot found in PM2${NC}"
echo ""

# Step 3: Restart the bot
echo -e "${YELLOW}Step 3: Restarting bot to apply changes...${NC}"
pm2 restart zentro-bot
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to restart bot!${NC}"
    exit 1
fi

# Wait for bot to start
echo "Waiting for bot to start..."
sleep 5

# Check if bot is running
pm2 show zentro-bot | grep "status" | grep "online"
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Bot failed to start! Check logs with: pm2 logs zentro-bot${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Bot restarted successfully!${NC}"
echo ""

# Step 4: Test database connection
echo -e "${YELLOW}Step 4: Testing database connection...${NC}"
node -e "
const pool = require('./src/db');
pool.query('SELECT COUNT(*) as count FROM kit_delivery_queue')
  .then(([rows]) => {
    console.log('✅ Database connection OK');
    console.log(\`📊 Active queue entries: \${rows[0].count}\`);
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ Database connection failed:', err.message);
    process.exit(1);
  });
"

echo ""
echo -e "${GREEN}🎉 In-Game Kit Delivery Emote System Deployment Complete!${NC}"
echo "========================================================"
echo ""
echo -e "${YELLOW}📋 What was updated:${NC}"
echo "• Modified shop purchase flow to use in-game emotes"
echo "• Added kit delivery handler for d11_quick_chat_orders_slot_6 emote"
echo "• Updated Discord embeds to mention in-game emote usage"
echo "• Removed Discord reaction system (no longer needed)"
echo "• Added 5-second cooldown between kit claims"
echo "• Added proper in-game messaging with shop colors"
echo "• Admin feed logging for all deliveries"
echo ""
echo -e "${YELLOW}🎮 How it works now:${NC}"
echo "1. Player purchases multiple kits via /shop in Discord"
echo "2. Bot adds kits to delivery queue and notifies player"
echo "3. Player uses the orders emote (📋) in-game to claim one kit at a time"
echo "4. Bot delivers kit and shows remaining count in-game"
echo "5. Process repeats until all kits are claimed"
echo ""
echo -e "${YELLOW}🧪 How to test:${NC}"
echo "1. Use /shop to purchase a kit with quantity > 1"
echo "2. Look for the 'Kit Delivery Queue' message in Discord"
echo "3. Go in-game and use the orders emote (📋)"
echo "4. Verify kit delivery and remaining count message"
echo "5. Test the 5-second cooldown between claims"
echo ""
echo -e "${YELLOW}🔧 In-game emote:${NC}"
echo "• Emote: d11_quick_chat_orders_slot_6 (📋 orders emote)"
echo "• Cooldown: 5 seconds between claims"
echo "• Colors: Same as existing shop messages"
echo "• Messages: Shows remaining kit count"
echo ""
echo -e "${GREEN}✨ The system is now live and ready to use!${NC}"
