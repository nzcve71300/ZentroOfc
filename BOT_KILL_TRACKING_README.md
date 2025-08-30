# Bot Kill Tracking & Respawn Detection System

## 🎯 Overview
The Bot Kill Tracking System monitors when the bot (SCARLETT) kills a player and tracks their respawn within a 20-second window. When the player respawns within this timeframe, the system sends a "SUCCESS!" message in-game.

## 🆕 Key Features

### 1. **Precise Kill Tracking**
- Only tracks kills made by **SCARLETT** (the bot)
- Ignores player-to-player kills
- Records exact kill timestamp

### 2. **Respawn Detection**
- Monitors "has entered the game" messages
- Matches respawn to specific killed players
- 20-second tracking window

### 3. **Success Feedback**
- Sends "SUCCESS!" message when respawn detected
- Automatic cleanup after 20 seconds
- Memory efficient tracking

## 🔧 How It Works

### Kill Detection
```
SCARLETT kills PlayerName
↓
System tracks: PlayerName killed at timestamp
↓
20-second timer starts
```

### Respawn Detection
```
PlayerName has entered the game
↓
System checks: Was PlayerName killed by SCARLETT within 20s?
↓
If YES: Send SUCCESS message
If NO: Ignore respawn
```

### Message Flow
1. **Bot kills player** → `[BOT KILL] Bot killed PlayerName, tracking for respawn`
2. **Player respawns** → `[BOT KILL] Success! PlayerName respawned within Xs of bot kill`
3. **Success message** → `SUCCESS! PlayerName has respawned after being killed by SCARLETT!`

## 📊 System Components

### In-Memory Tracking
```javascript
const botKillTracking = new Map(); // Track players killed by bot
```

### Key Functions
- `handleKillEvent()` - Detects bot kills and starts tracking
- `handleBotKillRespawn()` - Checks respawns and sends success messages
- Automatic cleanup after 20 seconds

## 🎮 In-Game Behavior

### When Bot Kills Player
- System logs the kill
- Starts 20-second tracking window
- No immediate message (waiting for respawn)

### When Player Respawns (Within 20s)
- System detects respawn
- Sends green "SUCCESS!" message
- Removes tracking for that player

### When Player Respawns (After 20s)
- System ignores respawn
- Tracking already removed
- No message sent

## 🔍 Log Messages

### Kill Detection
```
[BOT KILL] Bot killed PlayerName, tracking for respawn
```

### Respawn Detection
```
[BOT KILL] Success! PlayerName respawned within 5s of bot kill
[BOT KILL] Bot kill respawn tracking completed for PlayerName
```

### Timeout
```
[BOT KILL] 20 second timeout reached for PlayerName, removing tracking
```

## ⚙️ Configuration

### Tracking Window
- **20 seconds** - Configurable in code
- Players must respawn within this window
- Automatic cleanup prevents memory leaks

### Bot Name
- **SCARLETT** - Hardcoded bot name
- Only kills by this bot are tracked
- Player-to-player kills ignored

## 🧪 Testing

### Test Scenarios
1. **✅ Success Case**: Bot kills player → player respawns within 20s → SUCCESS message
2. **⏰ Timeout Case**: Bot kills player → player respawns after 20s → no message
3. **🚫 No Respawn**: Bot kills player → player doesn't respawn → tracking removed
4. **🎮 Player Kill**: Player kills player → no tracking (only bot kills tracked)

### Test Commands
```bash
# Test the system
node test_bot_kill_tracking.js

# Monitor logs
pm2 logs zentro-bot --lines 100
```

## 🚀 Deployment

### Automatic Setup
The system automatically initializes with the bot:
- Kill detection starts immediately
- Respawn monitoring active
- Memory cleanup every 20 seconds

### No Manual Configuration Required
- Works out of the box
- No database changes needed
- No admin setup required

## ✅ Benefits

1. **Immediate Feedback**: Players know when bot kill respawn is successful
2. **Precise Tracking**: Only tracks bot kills, not player kills
3. **Memory Efficient**: Automatic cleanup prevents leaks
4. **Reliable**: Uses existing respawn detection system
5. **Configurable**: Easy to adjust timing or bot name

## 🔧 Technical Details

### Kill Message Format
- Detects: `"SCARLETT killed PlayerName"`
- Parses killer and victim names
- Validates it's a player kill (not scientist)

### Respawn Message Format
- Detects: `"PlayerName has entered the game"`
- Matches to tracked kills
- Validates timing window

### Memory Management
- Uses Map for efficient lookups
- Automatic cleanup after 20 seconds
- Prevents memory leaks from abandoned tracking

## 🎯 Summary

The Bot Kill Tracking System provides immediate feedback when players respawn after being killed by SCARLETT. It ensures players know their respawn was successful and helps with home teleport and other bot-related functionality that requires respawn detection.
