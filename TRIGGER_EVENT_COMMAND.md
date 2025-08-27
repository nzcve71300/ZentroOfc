# Trigger Event Command Implementation

## 🎯 **New Command: `/trigger-event`**

### **Purpose:**
Manually trigger crate events and reset their timers, bypassing the automatic spawn schedule.

### **Command Format:**
```
/trigger-event <event> <server>
```

### **Parameters:**
- **`event`** (Required): The crate event to trigger
  - `CRATE-1`
  - `CRATE-2` 
  - `CRATE-3`
  - `CRATE-4`
- **`server`** (Required): The server to trigger the event on (autocomplete enabled)

## 🔧 **How It Works:**

### **1. Validation Checks:**
- ✅ **Server exists** - Verifies the server is configured
- ✅ **Crate configured** - Checks if the crate event has been set up with `/set`
- ✅ **Crate enabled** - Ensures the crate event is enabled
- ✅ **Position set** - Verifies coordinates are set with `/manage-positions`

### **2. Event Execution:**
- 📢 **Sends spawn message** - Uses the custom message configured with `CRATE-X-MSG`
- 📦 **Spawns crates** - Executes `entity.spawn codelockedhackablecrate <coordinates>` 
- 🔢 **Respects amount** - Spawns the configured number of crates (1-2)
- ⏰ **Resets timer** - Updates `last_spawn` timestamp to reset the countdown

### **3. Success Response:**
```
✅ **CRATE-1** triggered on **Main Server**!

📦 **Spawned:** 2/2 crates
📍 **Location:** 100,50,200
⏰ **Timer Reset:** Next spawn in 30 minutes
💬 **Message:** <b><size=45><color=#00FF00>CRATE EVENT SPAWNED</color></size></b>
```

## 📋 **Prerequisites:**

### **Before using `/trigger-event`, you must:**

1. **Configure the crate event:**
   ```
   /set CRATE-1 on <server>
   /set CRATE-1-TIME 30 <server>
   /set CRATE-1-AMOUNT 2 <server>
   /set CRATE-1-MSG "Custom message" <server>
   ```

2. **Set the spawn position:**
   ```
   /manage-positions <server> CRATE-1 <coordinates>
   ```

## 🚀 **Usage Examples:**

### **Basic Usage:**
```
/trigger-event CRATE-1 Main Server
/trigger-event CRATE-2 Test Server
/trigger-event CRATE-3 PvP Server
/trigger-event CRATE-4 Event Server
```

### **Complete Workflow:**
```
1. /set CRATE-1 on Main Server
2. /set CRATE-1-TIME 60 Main Server
3. /set CRATE-1-AMOUNT 2 Main Server
4. /set CRATE-1-MSG "Special crate spawned!" Main Server
5. /manage-positions Main Server CRATE-1 100,50,200
6. /trigger-event CRATE-1 Main Server
```

## ⚠️ **Error Messages:**

### **Common Issues:**
- `❌ Server not found: <server>` - Server not configured
- `❌ No configuration found for CRATE-1` - Crate not set up with `/set`
- `❌ CRATE-1 is disabled` - Crate needs to be enabled first
- `❌ No position set for CRATE-1` - Coordinates not set with `/manage-positions`

## 🔄 **Timer Reset Logic:**

When `/trigger-event` is used:
1. **Immediately spawns** the configured crates
2. **Updates `last_spawn`** timestamp to current time
3. **Resets countdown** - Next automatic spawn will be `spawn_interval_minutes` from now
4. **Maintains schedule** - Future automatic spawns continue based on the new timestamp

## 📊 **Database Changes:**

### **New Column Added:**
- **`last_spawn`** (TIMESTAMP NULL) - Tracks when crate was last spawned
- **Purpose:** Enables timer reset functionality
- **Used by:** `/trigger-event` command and future automatic spawn system

## 🎮 **Ready to Use!**

The `/trigger-event` command is now available and will:
- ✅ **Respect all crate configurations** from `/set` commands
- ✅ **Use configured spawn positions** from `/manage-positions`
- ✅ **Send custom messages** when crates spawn
- ✅ **Reset timers** for automatic spawning
- ✅ **Provide detailed feedback** on success/failure

Perfect for manual event triggering and testing crate configurations! 🚀
