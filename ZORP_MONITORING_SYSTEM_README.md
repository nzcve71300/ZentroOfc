# ZORP Monitoring System - Complete Overview

## 🎯 **System Overview**

The ZORP (Zone Ownership and Resource Protection) system has a comprehensive monitoring setup to ensure reliable detection of player online/offline status and proper zone management.

## ⏰ **Monitoring Intervals**

### **Primary Monitoring (Main System)**
- **Player Online Status Check**: Every **2 minutes** (120,000ms)
- **Event Polling**: Every **30 seconds** (30,000ms)
- **Zone Sync to Database**: Every **10 minutes** (600,000ms)
- **Expired Zone Cleanup**: Every **5 minutes** (300,000ms)
- **Memory Cleanup**: Every **10 minutes** (600,000ms)

### **Backup Monitoring (Redundant Safety Net)**
- **Backup Player Status Check**: Every **5 minutes** (300,000ms)
- **Purpose**: **ALWAYS RUNS** regardless of 2-minute check status
- **Function**: Redundant verification for 100% reliability
- **Activation**: Starts 20 seconds after bot startup
- **Behavior**: Runs independently and corrects any inconsistencies

## 🔄 **How It Works**

### **1. Primary Detection (Every 2 Minutes)**
```javascript
// Main monitoring function
checkAllPlayerOnlineStatus(client)
```
- Checks all active ZORP zones
- Compares current online players with previous state
- Detects players going online/offline
- Updates zone states (green/yellow/red)
- Manages offline timers

### **2. Backup Detection (Every 5 Minutes) - REDUNDANT SAFETY NET**
```javascript
// Backup monitoring function - ALWAYS RUNS
performBackupZorpCheck()
```
- **ALWAYS RUNS** regardless of 2-minute check status
- Independent verification of all active zones
- Verifies zone states are correct
- **Automatically corrects** any inconsistencies found
- Provides 100% reliability through dual verification
- Logs all corrections made for transparency

### **3. Real-time Event Detection**
```javascript
// Event-based detection
checkAllEvents(client)
```
- Monitors join/leave events in real-time
- Immediate response to player status changes
- Primary method for instant detection

## 🎮 **Zone State Management**

### **Green Zone (Player Online)**
- Player is currently online
- Zone is protected and active
- No expiration timer running

### **Yellow Zone (Delay Period)**
- Player just went offline
- Zone enters delay period (configurable, usually 5 minutes)
- Timer counts down to red state

### **Red Zone (Offline Expiration)**
- Player has been offline past delay period
- Zone is vulnerable and will expire
- Expiration timer starts counting down

## ⚙️ **Configuration**

### **ZORP Settings (per server)**
```sql
-- zorp_defaults table
size: 75 (zone size)
delay: 5 (minutes before turning red)
expire: 35 (hours before deletion)
enabled: true/false
```

### **Admin Commands**
```bash
# Edit ZORP settings
/edit-zorp server:"Server Name" expire:35

# Check ZORP status
/zorp-status server:"Server Name"
```

## 🔍 **Monitoring Features**

### **Automatic Startup**
1. **10 seconds**: Initial zone sync
2. **15 seconds**: Offline timer initialization
3. **20 seconds**: Backup monitoring starts
4. **Continuous**: All monitoring intervals active

### **Error Handling**
- Retry mechanisms for failed RCON commands
- Graceful handling of server disconnections
- Automatic cleanup of stuck timers
- Memory leak prevention

### **Logging & Debugging**
```
[ZORP] Player PlayerName went offline on ServerName (via polling)
[ZORP BACKUP] Starting backup monitoring check...
[ZORP OFFLINE TIMER] Starting offline expiration timer for PlayerName
```

## 📊 **System Status**

### **Current Monitoring Status**
- ✅ **Primary monitoring**: Every 2 minutes
- ✅ **Backup monitoring**: Every 5 minutes  
- ✅ **Real-time events**: Every 30 seconds
- ✅ **Zone sync**: Every 10 minutes
- ✅ **Cleanup**: Every 5-10 minutes

### **Reliability Features**
- **Dual monitoring**: Primary + Backup systems (BOTH ALWAYS RUN)
- **Redundant verification**: 5-minute check runs regardless of 2-minute status
- **Event-based detection**: Real-time join/leave
- **Database sync**: Ensures consistency
- **Memory management**: Prevents leaks
- **Error recovery**: Automatic retry mechanisms
- **Automatic correction**: Backup system fixes any inconsistencies

## 🚀 **Deployment**

### **Automatic Integration**
The backup monitoring system is automatically integrated into the main bot:

```javascript
// In src/rcon/index.js
setTimeout(() => {
  console.log('🚀 Initializing backup ZORP monitoring system...');
  const { startBackupZorpMonitoring } = require('../../add_backup_zorp_monitoring');
  startBackupZorpMonitoring();
}, 20000);
```

### **Manual Testing**
```bash
# Test the monitoring system
node verify_zorp_monitoring.js

# Run backup monitoring standalone
node add_backup_zorp_monitoring.js
```

## 📝 **Summary**

The ZORP monitoring system now has **dual-layer protection**:

1. **Primary Layer**: 2-minute monitoring + real-time events
2. **Backup Layer**: 5-minute **REDUNDANT SAFETY NET** that **ALWAYS RUNS**

### **Key Points:**
- ✅ **5-minute backup ALWAYS runs** regardless of 2-minute check status
- ✅ **Independent verification** of all zone states
- ✅ **Automatic correction** of any inconsistencies found
- ✅ **100% reliability** through dual verification
- ✅ **Transparent logging** of all corrections made

This ensures maximum reliability for detecting player online/offline status and managing ZORP zones correctly. The backup system acts as a safety net that will catch and fix any issues, even if the primary system is working perfectly.

## ✅ **Verification**

Run the verification script to check system status:
```bash
node verify_zorp_monitoring.js
```

This will show:
- Active ZORP zones
- Server configurations
- Monitoring intervals
- Any potential issues
- System health status
