# Robust Offline Timer System for ZORP

## 🎯 Overview
The Robust Offline Timer System ensures that Zorp zones expire **exactly** when players are offline for the full duration set with `/edit-zorp`, not based on creation time. This provides precise control over zone expiration.

## 🆕 Key Features

### 1. **Precise Offline Tracking**
- Timer starts **only** when all team members go offline
- Timer resets **immediately** when any team member comes back online
- Expiration is based on **actual offline time**, not creation time

### 2. **Robust Timer Management**
- Memory-efficient timer tracking with cleanup
- Automatic timer initialization on bot startup
- Fallback cleanup for old zones
- Prevents memory leaks with periodic cleanup

### 3. **Accurate Expiration**
- Zones expire **exactly** when offline for the full duration
- No early or late expiration
- Handles bot restarts gracefully

## 🔧 How It Works

### Timer Lifecycle
1. **Player Online** → Zone is green, no timer active
2. **All Team Offline** → Zone turns red, offline timer starts
3. **Timer Running** → Counts down the expire time (e.g., 35 hours)
4. **Player Returns** → Timer resets, zone turns green
5. **Timer Expires** → Zone is deleted from game and database

### Timer States
- **No Timer**: Player is online, zone is green
- **Active Timer**: Player is offline, counting down to expiration
- **Expired**: Timer reached zero, zone deleted

## 📊 Database Changes

### New In-Memory Tracking
```javascript
const zorpOfflineTimers = new Map(); // Track offline expiration timers
const zorpOfflineStartTimes = new Map(); // Track when players went offline
```

### Enhanced Functions
- `startOfflineExpirationTimer()` - Starts countdown when player goes offline
- `clearOfflineExpirationTimer()` - Resets timer when player comes online
- `handleOfflineExpiration()` - Deletes zone when timer expires
- `initializeOfflineTimers()` - Sets up timers on bot startup

## 🎮 In-Game Behavior

### When Players Go Offline
1. Zone turns **yellow** (delay period)
2. After delay → zone turns **red**
3. **Offline timer starts** counting down expire time
4. Timer continues until player returns or expires

### When Players Come Online
1. Zone turns **green** immediately
2. **Offline timer resets** (cleared)
3. Timer starts fresh next time they go offline

### When Timer Expires
1. Zone is **deleted** from game
2. Zone is **removed** from database
3. **Feed message** sent to Discord
4. All timer references cleaned up

## ⚙️ Admin Commands

### `/edit-zorp` Expire Time
```bash
# Set 35-hour offline expiration
/edit-zorp server:"My Server" expire:35

# Set 24-hour offline expiration  
/edit-zorp server:"My Server" expire:24

# Set 48-hour offline expiration
/edit-zorp server:"My Server" expire:48
```

**Important**: The expire time is now **100% accurate** - zones will expire exactly when players are offline for the full duration, not based on when the zone was created.

## 🔍 Monitoring & Debugging

### Log Messages
```
[ZORP OFFLINE TIMER] Starting offline expiration timer for PlayerName (ZoneName) - 126000 seconds
[ZORP OFFLINE TIMER] Timer set for PlayerName - will expire in 126000 seconds
[ZORP OFFLINE TIMER] Cleared offline timer for ZoneName
[ZORP OFFLINE TIMER] Offline expiration reached for PlayerName (ZoneName) - deleting Zorp
```

### Test Commands
```bash
# Test the offline timer system
node test_offline_timer.js

# Monitor bot logs
pm2 logs zentro-bot --lines 100
```

## 🚀 Deployment

### Automatic Setup
The system automatically initializes on bot startup:
1. **10 seconds** → Zone sync
2. **15 seconds** → Offline timer initialization
3. **Every 5 minutes** → Expired zone cleanup
4. **Every 10 minutes** → Memory cleanup

### No Manual Configuration Required
- Timers are automatically managed
- Memory cleanup prevents leaks
- Fallback cleanup handles edge cases

## ✅ Benefits

1. **Precise Control**: Zones expire exactly when intended
2. **Fair System**: Players can extend their time by staying online
3. **Robust**: Handles bot restarts and edge cases
4. **Memory Efficient**: Automatic cleanup prevents leaks
5. **Transparent**: Clear logging for monitoring

## 🔧 Technical Details

### Timer Accuracy
- Uses `setTimeout()` for precise timing
- Tracks start time in milliseconds
- Handles bot restarts with database persistence
- Fallback cleanup for edge cases

### Memory Management
- Automatic cleanup every 10 minutes
- Removes old timer references after 24 hours
- Prevents memory leaks from abandoned timers

### Error Handling
- Graceful error handling for all timer operations
- Fallback cleanup for corrupted states
- Detailed logging for debugging

## 🎯 Summary

The Robust Offline Timer System ensures that `/edit-zorp expire` times are **100% accurate**. Players' Zorps will expire exactly when they are offline for the full duration, providing fair and predictable zone management.
