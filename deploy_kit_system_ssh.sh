#!/bin/bash

echo "🚀 Deploying Kit Delivery System via SSH..."
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Create database table
echo -e "${YELLOW}Step 1: Creating kit delivery queue table...${NC}"
node deploy_kit_delivery_system.js
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to create database table!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database table created successfully!${NC}"
echo ""

# Step 2: Test the modified files for syntax errors
echo -e "${YELLOW}Step 2: Testing modified files for syntax errors...${NC}"

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

echo "Testing src/utils/kitDeliveryHandler.js..."
node -c src/utils/kitDeliveryHandler.js
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Syntax error in kitDeliveryHandler.js!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All files passed syntax check!${NC}"
echo ""

# Step 3: Check PM2 status
echo -e "${YELLOW}Step 3: Checking PM2 status...${NC}"
pm2 list | grep zentro
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Zentro bot not found in PM2!${NC}"
    echo "Please start the bot with: pm2 start ecosystem.config.js"
    exit 1
fi
echo -e "${GREEN}✅ Bot found in PM2${NC}"
echo ""

# Step 4: Restart the bot
echo -e "${YELLOW}Step 4: Restarting bot to apply changes...${NC}"
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

# Step 5: Run cleanup utility
echo -e "${YELLOW}Step 5: Running initial cleanup...${NC}"
node deploy_kit_delivery_system.js --cleanup
echo -e "${GREEN}✅ Cleanup completed!${NC}"
echo ""

# Step 6: Display system status
echo -e "${YELLOW}Step 6: System Status Check...${NC}"

echo "Bot Status:"
pm2 show zentro-bot | grep -E "(status|uptime|cpu|memory)"

echo ""
echo "Database Connection Test:"
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
echo -e "${GREEN}🎉 Kit Delivery System Deployment Complete!${NC}"
echo "============================================="
echo ""
echo -e "${YELLOW}📋 What was deployed:${NC}"
echo "• Kit delivery queue database table"
echo "• Modified shop purchase flow for multi-kit orders"
echo "• Discord reaction handler for 📦 emoji"
echo "• Anti-spam cooldown system (5 seconds)"
echo "• Real-time embed updates"
echo "• In-game delivery notifications"
echo "• Admin feed logging"
echo "• Automatic cleanup system"
echo ""
echo -e "${YELLOW}🧪 How to test:${NC}"
echo "1. Use /shop to purchase a kit with quantity > 1"
echo "2. Look for the 'Kit Delivery Queue' message with 📦 reaction"
echo "3. React with 📦 to claim one kit at a time"
echo "4. Verify in-game delivery and embed updates"
echo "5. Test the 5-second cooldown between claims"
echo ""
echo -e "${YELLOW}🔧 Maintenance commands:${NC}"
echo "• Clean old entries: node deploy_kit_delivery_system.js --cleanup"
echo "• Check bot logs: pm2 logs zentro-bot"
echo "• Monitor queue: Check admin feed or database"
echo ""
echo -e "${GREEN}✨ The system is now live and ready to use!${NC}"
