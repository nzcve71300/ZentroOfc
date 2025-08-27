# Position Command Restructure Summary

## 🎯 Changes Made

### 1. **Modified `/manage-positions` Command**

**Before:**
- Handled coordinates, enable/disable, delay, cooldown, and test teleport
- Complex command with multiple optional parameters

**After:**
- **Simplified to only handle coordinates**
- Coordinates parameter is now **required**
- Removed enable, delay, and cooldown options
- Still supports test teleport functionality

**New Usage:**
```
/manage-positions <server> <position> <coordinates> [test_player]
```

**Examples:**
```
/manage-positions "Main Server" outpost "100.5,200.3,300.7"
/manage-positions "Main Server" banditcamp "150.2,250.1,350.8" "PlayerName"
```

### 2. **Enhanced `/set` Command**

**Added new position configuration options:**

#### **Outpost Configuration:**
- `OUTPOST-ENABLE` - Enable/disable Outpost teleport (on/off)
- `OUTPOST-DELAY` - Set teleport delay in seconds (0 for instant)
- `OUTPOST-COOLDOWN` - Set cooldown in minutes

#### **Bandit Camp Configuration:**
- `BANDIT-ENABLE` - Enable/disable Bandit Camp teleport (on/off)
- `BANDIT-DELAY` - Set teleport delay in seconds (0 for instant)
- `BANDIT-COOLDOWN` - Set cooldown in minutes

**New Usage Examples:**
```
/set OUTPOST-ENABLE on Main Server
/set OUTPOST-DELAY 5 Main Server
/set OUTPOST-COOLDOWN 10 Main Server
/set BANDIT-ENABLE off Main Server
/set BANDIT-DELAY 0 Main Server
/set BANDIT-COOLDOWN 15 Main Server
```

## 🔧 Technical Implementation

### Database Tables Used:
- `position_coordinates` - Stores X,Y,Z coordinates for each position
- `position_configs` - Stores enable/delay/cooldown settings for each position

### Command Flow:
1. **`/manage-positions`** - Sets coordinates only
2. **`/set`** - Configures enable/delay/cooldown settings
3. **System** - Uses both tables for complete position functionality

### Validation:
- **Coordinates**: Must be valid numbers (X,Y,Z format)
- **Enable**: on/off, true/false, 1/0
- **Delay**: Positive integer (seconds)
- **Cooldown**: Positive integer (minutes)

## ✅ Benefits

1. **Cleaner Separation**: Coordinates vs. configuration logic
2. **Better UX**: Simpler `/manage-positions` command
3. **Consistent**: Uses existing `/set` command pattern
4. **Flexible**: Easy to add more position types in future
5. **Maintainable**: Clear separation of concerns

## 🚀 Next Steps

The system is now ready for **Timed Events** implementation. The position management system provides a solid foundation for:
- Scheduled teleports
- Event-based position triggers
- Time-based position availability
- Advanced position scheduling

## 📝 Usage Summary

**For Coordinates:**
```
/manage-positions <server> <position> <coordinates>
```

**For Configuration:**
```
/set <position>-<setting> <value> <server>
```

**Complete Example:**
```
/manage-positions "Main Server" outpost "100.5,200.3,300.7"
/set OUTPOST-ENABLE on Main Server
/set OUTPOST-DELAY 3 Main Server
/set OUTPOST-COOLDOWN 10 Main Server
```

This sets up Outpost with coordinates (100.5,200.3,300.7), enabled, 3-second delay, and 10-minute cooldown.
