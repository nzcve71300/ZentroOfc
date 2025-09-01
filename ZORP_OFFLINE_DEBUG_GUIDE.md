# ZORP Offline Detection Debug Guide

## 🚨 Issue: Zorps Stay Green When Players Go Offline

### Problem Description
- Zorps are created successfully (white → green transition works)
- When players go offline, Zorps remain green instead of turning yellow → red
- Players complain that expire timers don't work and their Zorps never delete

## 🔍 Enhanced Debugging Added

I've added comprehensive logging to track the entire offline detection flow. The logs will now show:

### 1. **Player Offline Detection**
```
[ZORP OFFLINE DEBUG] ===== STARTING OFFLINE PROCESSING FOR PlayerName =====
[ZORP OFFLINE DEBUG] Processing offline for PlayerName on ServerName
[ZORP OFFLINE DEBUG] Found X zones for PlayerName
[ZORP OFFLINE DEBUG] Zone ZoneName current state: green
[ZORP OFFLINE DEBUG] Zone is green, checking if all team members are offline...
```

### 2. **Team Status Checking**
```
[ZORP TEAM DEBUG] ===== CHECKING TEAM OFFLINE STATUS FOR PlayerName =====
[ZORP TEAM DEBUG] Team info for PlayerName: {owner: "Owner", members: ["Player1", "Player2"]}
[ZORP TEAM DEBUG] Team members: Player1, Player2
[ZORP TEAM DEBUG] Online players count: 15
[ZORP TEAM DEBUG] Online players: Player1, Player3, Player4, ...
[ZORP TEAM DEBUG] Team member Player1 is ONLINE
[ZORP TEAM DEBUG] Team member Player2 is OFFLINE
[ZORP TEAM DEBUG] 1 team members are online for PlayerName's team - NOT all offline
```

### 3. **Zone Color Transitions**
```
[ZORP YELLOW DEBUG] ===== STARTING setZoneToYellow FOR PlayerName =====
[ZORP YELLOW DEBUG] Found 1 zones for PlayerName
[ZORP YELLOW DEBUG] Zone: ZoneName, Delay: 5 minutes, Yellow color: 255,255,0
[ZORP YELLOW DEBUG] Setting zone ZoneName to yellow color...
[ZORP YELLOW DEBUG] Zone color set to yellow, updating database state...
[ZORP YELLOW DEBUG] Database and memory state updated to yellow
[ZORP YELLOW DEBUG] Starting timer for 5 minutes (300000ms) to transition to red
[ZORP YELLOW DEBUG] Timer set successfully for zone ZoneName
```

## 🧪 Testing Instructions

### Step 1: Create a Test Zorp
1. Have a player create a team and become team owner
2. Use the Zorp emote to create a zone
3. Verify it goes white → green after 2 minutes

### Step 2: Test Offline Detection
1. Have the team owner go offline
2. **Watch the logs** for the debug messages above
3. Check if the zone turns yellow

### Step 3: Check Logs for Issues
Look for these potential problems in the logs:

#### ❌ **Issue 1: Player Offline Not Detected**
```
[ZORP] Player PlayerName went offline on ServerName (via polling)
```
- If you don't see this message, the offline detection isn't working

#### ❌ **Issue 2: Team Check Failing**
```
[ZORP TEAM DEBUG] Could not get online players list after 3 attempts
```
- This means the server is too busy or RCON is failing

#### ❌ **Issue 3: Team Members Still Online**
```
[ZORP TEAM DEBUG] 1 team members are online for PlayerName's team - NOT all offline
```
- This means other team members are still online

#### ❌ **Issue 4: Zone Not Found**
```
[ZORP OFFLINE DEBUG] Found 0 zones for PlayerName
```
- This means the zone doesn't exist or has expired

#### ❌ **Issue 5: Zone Already in Wrong State**
```
[ZORP OFFLINE DEBUG] Zone for PlayerName is already yellow - skipping offline processing
```
- This means the zone is already in the wrong state

## 🔧 Common Issues & Solutions

### Issue: "Could not get online players list"
**Cause**: Server is too busy or RCON connection issues
**Solution**: The system retries 3 times, but if it fails, it assumes someone is online (keeps zone green)

### Issue: "Team members still online"
**Cause**: Other team members are still connected
**Solution**: This is correct behavior - all team members must be offline

### Issue: "No zones found"
**Cause**: Zone expired or was deleted
**Solution**: Check zone expiration time in database

### Issue: "Zone already in wrong state"
**Cause**: Zone state is inconsistent
**Solution**: Check database for correct zone state

## 📊 Monitoring Commands

### Check Zone Status in Database
```sql
SELECT name, owner, current_state, created_at, expire, delay 
FROM zorp_zones 
WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP;
```

### Check Player Online Status
```sql
SELECT * FROM player_playtime 
WHERE last_online > DATE_SUB(NOW(), INTERVAL 5 MINUTE);
```

## 🚀 Next Steps

1. **Deploy the enhanced logging** (already applied)
2. **Test with a player going offline** and watch the logs
3. **Identify the specific issue** from the debug messages
4. **Report back** with the log output to pinpoint the exact problem

The enhanced logging will show exactly where the offline detection is failing, allowing us to fix the specific issue causing Zorps to stay green when players go offline.
