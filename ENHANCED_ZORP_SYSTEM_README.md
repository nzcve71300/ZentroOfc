# Enhanced ZORP System

## 🎯 Overview
The Enhanced ZORP System introduces advanced color transitions, proximity validation, and improved admin controls for Zone Offline Raid Protection.

## 🆕 New Features

### 1. **Advanced Color Transitions**
- **White (2 minutes)** → **Green** → **Yellow (delay period)** → **Red**
- Zones start **white** when created, automatically transition to **green** after 2 minutes
- When players go offline, zones turn **yellow** for the admin-set delay period
- After delay expires, zones turn **red** (offline protection)
- **Yellow color is always fixed** - users cannot change it

### 2. **Proximity Protection**
- **Minimum 150m distance** between ZORP zones
- Prevents players from placing zones on top of each other
- Shows exact distance when placement is blocked
- Real-time validation during zone creation

### 3. **Enhanced Admin Controls**
- **Delay in minutes**: Set offline delay in minutes instead of seconds
- **RGB color validation**: Custom online/offline colors with format validation
- **Improved error messages**: Clear feedback for invalid inputs

### 4. **Smart Timer Management**
- Automatic transition timers with cleanup
- Timers are cleared when players come back online
- Memory-efficient timer tracking
- Prevents timer conflicts and memory leaks

## 🎮 In-Game Behavior

### Zone Creation Process
1. Player uses ZORP emote (`d11_quick_chat_questions_slot_1`)
2. System checks proximity to existing zones (150m minimum)
3. Zone created in **WHITE** color
4. After **2 minutes** → automatically changes to **GREEN**
5. Zone remains green while team members are online

### Offline Transition Process
1. All team members go offline
2. Zone immediately changes to **YELLOW**
3. Timer starts for admin-set delay (default: 5 minutes)
4. After delay expires → zone changes to **RED**
5. If team comes back online during yellow period → zone returns to **GREEN**

## ⚙️ Admin Commands

### `/edit-zorp` Enhanced Options

```bash
# Set 10-minute offline delay
/edit-zorp server:"My Server" delay:10

# Set custom online color (bright green)
/edit-zorp server:"My Server" color_online:"0,255,0"

# Set custom offline color (bright red)  
/edit-zorp server:"My Server" color_offline:"255,0,0"

# Set zone size and delay together
/edit-zorp server:"My Server" size:100 delay:15
```

### RGB Color Format
- Format: `"R,G,B"` where R, G, B are 0-255
- Examples:
  - Green: `"0,255,0"`
  - Red: `"255,0,0"`
  - Blue: `"0,0,255"`
  - Purple: `"255,0,255"`
  - Orange: `"255,165,0"`

## 🗄️ Database Changes

### New Columns in `zorp_zones`
```sql
current_state VARCHAR(10) DEFAULT 'white'      -- Tracks zone color state
last_online_at TIMESTAMP DEFAULT NOW()         -- Last time owner was online  
color_yellow TEXT DEFAULT '255,255,0'          -- Yellow transition color
```

### New Columns in `zorp_defaults`
```sql
color_yellow TEXT DEFAULT '255,255,0'          -- Default yellow color
```

### Updated Behavior
- `delay` column now stores **minutes** instead of seconds
- Default delay changed from 0 to 5 minutes

## 🚀 Deployment (SSH)

### Prerequisites
- SSH access to your server
- MySQL/MariaDB access with root privileges
- PM2 running the Zentro bot

### Deployment Steps
```bash
# 1. Pull latest code
git pull origin main

# 2. Run database migration
mysql -u root -p zentro_bot < sql/enhance_zorp_system.sql

# 3. Verify database changes
mysql -u root -p zentro_bot -e "DESCRIBE zorp_zones;" | grep -E "(current_state|last_online_at|color_yellow)"

# 4. Update existing data
mysql -u root -p zentro_bot -e "
UPDATE zorp_zones 
SET current_state = 'green', 
    last_online_at = NOW(), 
    color_yellow = '255,255,0' 
WHERE current_state IS NULL;

UPDATE zorp_defaults 
SET color_yellow = '255,255,0' 
WHERE color_yellow IS NULL;
"

# 5. Restart bot
pm2 restart zentro-bot

# 6. Monitor logs
pm2 logs zentro-bot | grep ZORP
```

### Alternative: Use Deployment Script
```bash
chmod +x deploy_enhanced_zorp_ssh.sh
./deploy_enhanced_zorp_ssh.sh
```

## 🔧 Technical Details

### Files Modified
- `src/commands/admin/edit-zorp.js` - Enhanced admin command with RGB validation
- `src/rcon/index.js` - New color transition system and proximity checks
- `sql/enhance_zorp_system.sql` - Database migration script

### Memory Management
- Timer tracking with automatic cleanup
- Zone state caching for performance
- Efficient proximity calculations using 2D distance

### Error Handling
- Comprehensive input validation
- Graceful fallbacks for missing data
- Detailed logging for debugging

## 🎯 Usage Examples

### For Players
- Use ZORP emote to create zones (same as before)
- Zones start white, turn green after 2 minutes
- When you go offline, zone turns yellow then red after delay

### For Admins
- Set longer delays for more protection: `/edit-zorp server:"Main" delay:30`
- Customize colors to match server theme
- Monitor zone states in logs: `pm2 logs zentro-bot | grep "ZORP.*color"`

## 🐛 Troubleshooting

### Common Issues
1. **Zones not changing colors**: Check bot logs for timer errors
2. **Proximity check failing**: Verify coordinate extraction in logs  
3. **RGB colors not working**: Ensure format is "R,G,B" with quotes

### Debug Commands
```bash
# Check zone states in database
mysql -u root -p zentro_bot -e "SELECT name, owner, current_state, last_online_at FROM zorp_zones;"

# Monitor ZORP activity
pm2 logs zentro-bot --lines 50 | grep ZORP

# Check active timers (in bot console)
console.log(zorpTransitionTimers.size + " active transition timers");
```

## 📊 Performance Impact
- **Minimal CPU usage**: Efficient timer management
- **Low memory footprint**: Smart cleanup of expired timers
- **Database optimized**: Indexed queries for proximity checks
- **Network efficient**: Reduced RCON calls through caching

---

✅ **System Status**: Ready for deployment
🔄 **Compatibility**: Works with existing ZORP zones
⚡ **Performance**: Optimized for high-traffic servers
