# Zorp State Locking System - Complete Implementation

## 🎯 Problem Solved
Zorps were flipping between states (red → green → red) due to race conditions and lack of state confirmation. This system ensures zones are **locked in their current state** until there's a definitive change in player status.

## 🔒 State Locking Features

### 1. **Confirmation Requirements**
- **Online → Green**: Player must be online for **30+ seconds** before zone turns green
- **Offline → Yellow**: Player must be offline for **60+ seconds** before zone turns yellow  
- **Yellow → Red**: Based on configured delay period (usually 5+ minutes)

### 2. **Database-Level Locks**
- **State transition locks** prevent multiple systems from changing the same zone simultaneously
- **Automatic lock expiration** (2-5 minutes) prevents permanent locks
- **Lock cleanup** runs every 5 minutes to remove expired locks

### 3. **State Transition History**
- **Complete audit trail** of all state changes
- **Timing information** for debugging
- **Player status tracking** for each transition

## 🛡️ Locking Logic

### Green State (Player Online)
```sql
-- Only transition to green if:
-- 1. Player has been online for 30+ seconds
-- 2. No active state lock exists
-- 3. Zone is not already green
```

### Yellow State (Player Offline Warning)
```sql
-- Only transition to yellow if:
-- 1. Player has been offline for 60+ seconds  
-- 2. No active state lock exists
-- 3. Zone is currently green
```

### Red State (Player Offline)
```sql
-- Only transition to red if:
-- 1. Player has been offline for delay period (e.g., 5 minutes)
-- 2. No active state lock exists
-- 3. Zone is currently yellow
-- 4. Lock is held for 5 minutes (more permanent)
```

## 🔧 Technical Implementation

### Database Tables Added
1. **`zorp_state_locks`** - Active state transition locks
2. **`zorp_state_transitions`** - Complete history of all state changes

### Database Functions Added
1. **`acquire_zorp_state_lock()`** - Acquire lock for state transition
2. **`release_zorp_state_lock()`** - Release lock after transition
3. **`has_zorp_state_lock()`** - Check if zone has active lock

### Monitoring Logic Enhanced
- **Lock checking** before any state transition
- **Confirmation timing** for all state changes
- **Automatic lock management** with proper cleanup

## 📊 State Flow with Locks

```
Player Online (30s+) → [LOCK] → Green State
Player Offline (60s+) → [LOCK] → Yellow State  
Offline Timeout → [LOCK 5min] → Red State (LOCKED)
Player Online (30s+) → [LOCK] → Green State
```

## 🎮 Expected Behavior

### Normal Operation
1. **Player creates Zorp** → White (no lock needed)
2. **After delay** → Green (with 2-minute lock)
3. **Player goes offline** → Wait 60s → Yellow (with 2-minute lock)
4. **After offline delay** → Red (with 5-minute lock) **← LOCKED STATE**
5. **Player comes back** → Wait 30s → Green (with 2-minute lock)

### Lock Protection
- **Red zones stay red** until player is confirmed online for 30+ seconds
- **No race conditions** between monitoring systems
- **Automatic cleanup** of expired locks
- **Complete audit trail** of all changes

## 🚀 Benefits

1. **Eliminates State Flipping** - Zones can't randomly change states
2. **Prevents Race Conditions** - Database locks ensure atomic transitions
3. **Confirmation-Based** - States only change with confirmed player status
4. **Audit Trail** - Complete history for debugging and monitoring
5. **Automatic Cleanup** - Expired locks are automatically removed
6. **Performance Optimized** - Locks prevent unnecessary processing

## 🔍 Monitoring & Debugging

### Log Messages
- `[ZORP ROCK SOLID] Zone has active state lock - skipping transition`
- `[ZORP ROCK SOLID] CONFIRMED online - Setting zone to green`
- `[ZORP ROCK SOLID] Player offline but not confirmed yet (45s) - keeping green state`
- `[ZORP ROCK SOLID] Zone is LOCKED in red state - waiting for player to come back online`

### Database Queries for Monitoring
```sql
-- Check active locks
SELECT * FROM zorp_state_locks WHERE expires_at > NOW();

-- View recent transitions
SELECT * FROM zorp_state_transitions ORDER BY created_at DESC LIMIT 10;

-- Check zone states
SELECT name, owner, current_state, desired_state, last_online_at, last_offline_at 
FROM zorp_zones WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP;
```

## ✅ Result

**Zorps are now completely locked in their states** until there's a definitive, confirmed change in player status. No more random state flipping or race conditions!

The system ensures:
- **Red zones stay red** until player is confirmed online
- **Green zones stay green** until player is confirmed offline  
- **Yellow zones transition properly** based on timing
- **Complete audit trail** for all state changes
- **Automatic cleanup** of locks and expired data
