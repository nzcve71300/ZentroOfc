#!/bin/bash

echo "🚀 Enhanced ZORP System - Manual Deployment"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

echo ""
print_status "Step 1: Database Migration Options"
echo "Choose your database connection method:"
echo "A) Use MySQL with username/password"
echo "B) Use sudo mysql (if configured for socket auth)"
echo "C) Skip database migration (run manually later)"
echo ""

read -p "Choose option (A/B/C): " db_option

case $db_option in
    [Aa]*)
        print_status "Enter your MySQL credentials:"
        read -p "MySQL username: " mysql_user
        read -s -p "MySQL password: " mysql_pass
        echo ""
        
        print_status "Running database migration with credentials..."
        if mysql -u "$mysql_user" -p"$mysql_pass" zentro_bot < sql/enhance_zorp_system.sql; then
            print_success "Database migration completed!"
        else
            print_error "Database migration failed!"
            exit 1
        fi
        ;;
    [Bb]*)
        print_status "Running database migration with sudo mysql..."
        if sudo mysql zentro_bot < sql/enhance_zorp_system.sql; then
            print_success "Database migration completed!"
        else
            print_error "Database migration failed!"
            exit 1
        fi
        ;;
    [Cc]*)
        print_warning "Skipping database migration - you'll need to run this manually:"
        echo "mysql -u [username] -p zentro_bot < sql/enhance_zorp_system.sql"
        ;;
    *)
        print_error "Invalid option selected!"
        exit 1
        ;;
esac

# Step 2: Verify database changes (if migration was run)
if [[ $db_option != [Cc]* ]]; then
    print_status "2. Verifying database changes..."
    
    if [[ $db_option == [Aa]* ]]; then
        mysql -u "$mysql_user" -p"$mysql_pass" zentro_bot -e "DESCRIBE zorp_zones;" | grep -E "(current_state|last_online_at|color_yellow)"
        mysql -u "$mysql_user" -p"$mysql_pass" zentro_bot -e "DESCRIBE zorp_defaults;" | grep "color_yellow"
    else
        sudo mysql zentro_bot -e "DESCRIBE zorp_zones;" | grep -E "(current_state|last_online_at|color_yellow)"
        sudo mysql zentro_bot -e "DESCRIBE zorp_defaults;" | grep "color_yellow"
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Database columns verified!"
    else
        print_warning "Could not verify columns - please check manually"
    fi
    
    # Update existing data
    print_status "3. Updating existing zones with default states..."
    if [[ $db_option == [Aa]* ]]; then
        mysql -u "$mysql_user" -p"$mysql_pass" zentro_bot -e "
        UPDATE zorp_zones 
        SET current_state = 'green', 
            last_online_at = NOW(), 
            color_yellow = '255,255,0' 
        WHERE current_state IS NULL;
        
        UPDATE zorp_defaults 
        SET color_yellow = '255,255,0' 
        WHERE color_yellow IS NULL;
        "
    else
        sudo mysql zentro_bot -e "
        UPDATE zorp_zones 
        SET current_state = 'green', 
            last_online_at = NOW(), 
            color_yellow = '255,255,0' 
        WHERE current_state IS NULL;
        
        UPDATE zorp_defaults 
        SET color_yellow = '255,255,0' 
        WHERE color_yellow IS NULL;
        "
    fi
    print_success "Existing data updated!"
fi

# Step 4: Restart bot
print_status "4. Restarting Zentro bot..."
if pm2 restart zentro-bot; then
    print_success "Bot restarted successfully!"
else
    print_error "Failed to restart bot - please check PM2 status"
    pm2 status
    exit 1
fi

# Step 5: Wait and check status
print_status "5. Waiting for bot to initialize..."
sleep 5

print_status "6. Checking bot status..."
pm2 status zentro-bot

# Step 6: Show recent logs
print_status "7. Checking recent logs for ZORP activity..."
pm2 logs zentro-bot --lines 10 --nostream | grep -i zorp || echo "No ZORP activity in recent logs"

echo ""
print_success "🎉 Enhanced ZORP System deployment completed!"
echo ""
echo "📋 New Features Active:"
echo "• ⚪ White → 🟢 Green → 🟡 Yellow → 🔴 Red color transitions"
echo "• 📏 150m minimum distance between zones"
echo "• ⏱️  Delay in minutes (default: 5 minutes)"
echo "• 🎨 RGB color validation for custom colors"
echo ""
echo "🔧 Test Commands:"
echo "• /edit-zorp [server] delay:10 - Set 10-minute delay"
echo "• /edit-zorp [server] color_online:\"0,255,0\" - Set custom green"
echo "• Create a ZORP in-game to test the white→green transition"
echo ""
print_status "Monitor with: pm2 logs zentro-bot | grep ZORP"
