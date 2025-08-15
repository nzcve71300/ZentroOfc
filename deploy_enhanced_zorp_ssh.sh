#!/bin/bash

echo "🚀 Deploying Enhanced ZORP System..."
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Database Migration
print_status "1. Running database migration for enhanced ZORP system..."
if mysql -u root -p zentro_bot < sql/enhance_zorp_system.sql; then
    print_success "Database migration completed successfully!"
else
    print_error "Database migration failed!"
    exit 1
fi

# Step 2: Verify new database columns
print_status "2. Verifying new database columns..."
mysql -u root -p zentro_bot -e "DESCRIBE zorp_zones;" | grep -E "(current_state|last_online_at|color_yellow)"
if [ $? -eq 0 ]; then
    print_success "New columns verified in zorp_zones table"
else
    print_warning "Could not verify new columns - please check manually"
fi

mysql -u root -p zentro_bot -e "DESCRIBE zorp_defaults;" | grep "color_yellow"
if [ $? -eq 0 ]; then
    print_success "New columns verified in zorp_defaults table"
else
    print_warning "Could not verify new columns in zorp_defaults - please check manually"
fi

# Step 3: Update existing zones with default states
print_status "3. Updating existing zones with default states..."
mysql -u root -p zentro_bot -e "
UPDATE zorp_zones 
SET current_state = 'green', 
    last_online_at = NOW(), 
    color_yellow = '255,255,0' 
WHERE current_state IS NULL;
"
print_success "Existing zones updated with default states"

# Step 4: Update existing defaults with yellow color
print_status "4. Updating zorp_defaults with yellow color..."
mysql -u root -p zentro_bot -e "
UPDATE zorp_defaults 
SET color_yellow = '255,255,0' 
WHERE color_yellow IS NULL;
"
print_success "Default configurations updated"

# Step 5: Restart the bot
print_status "5. Restarting Zentro bot..."
if pm2 restart zentro-bot; then
    print_success "Bot restarted successfully!"
else
    print_error "Failed to restart bot!"
    exit 1
fi

# Step 6: Wait for bot to initialize
print_status "6. Waiting for bot to initialize..."
sleep 5

# Step 7: Check bot status
print_status "7. Checking bot status..."
pm2 status zentro-bot

# Step 8: Check logs for any errors
print_status "8. Checking recent logs for errors..."
pm2 logs zentro-bot --lines 20 --nostream

echo ""
print_success "🎉 Enhanced ZORP System deployment completed!"
echo ""
echo "📋 New Features:"
echo "• Color Transitions: White (2min) → Green → Yellow (delay) → Red"
echo "• Delay in Minutes: Set offline delay in minutes instead of seconds"
echo "• RGB Color Validation: Custom online/offline colors with validation"
echo "• Yellow Intermediate State: Always yellow during delay period"
echo "• Timer Management: Automatic transition timers with cleanup"
echo ""
echo "🔧 Updated Files:"
echo "• src/commands/admin/edit-zorp.js - Enhanced with RGB validation and minute delays"
echo "• src/rcon/index.js - New color transition system and timer management"
echo "• sql/enhance_zorp_system.sql - Database migration for new columns"
echo ""
echo "📖 Usage:"
echo "• /edit-zorp [server] delay:5 - Set 5-minute delay before red"
echo "• /edit-zorp [server] color_online:\"0,255,0\" - Set custom green color"
echo "• /edit-zorp [server] color_offline:\"255,0,0\" - Set custom red color"
echo ""
print_status "Monitor logs with: pm2 logs zentro-bot"
print_status "Check ZORP status: pm2 logs zentro-bot | grep ZORP"
