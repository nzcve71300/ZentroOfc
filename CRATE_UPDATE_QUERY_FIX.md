# Crate Update Query Fix

## 🐛 **Issue Identified:**

When using `/set CRATE-1 on <server>`, the bot was returning:
```
❌ Error in set command: Error: Query was empty
```

## 🔍 **Root Cause:**

The switch statement had duplicate `case ''` statements, causing the crate event logic to never be reached:

**Problem Code:**
```javascript
case 'ENABLE':
case '':
  if (isPositionConfig) {
    // Only handled position configs
  }
  break;
// ... other cases ...
case 'ON':
case '':  // This was never reached!
  if (isCrateConfig) {
    // Crate logic was never executed
  }
  break;
```

**What was happening:**
- Input: `CRATE-1` → `configType = ""` → Matched first `case ''`
- First `case ''` only handled `isPositionConfig` → No query set
- Second `case ''` was never reached → `updateQuery` remained empty
- Empty query caused database error

## ✅ **Solution Implemented:**

**Fixed Logic:**
```javascript
case 'ENABLE':
case '':
  if (isPositionConfig) {
    updateQuery = 'UPDATE position_configs SET enabled = ? WHERE server_id = ? AND position_type = ?';
    updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), positionType];
  } else if (isCrateConfig) {
    updateQuery = 'UPDATE crate_event_configs SET enabled = ? WHERE server_id = ? AND crate_type = ?';
    updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), crateType];
  }
  break;
case 'OUTPOST':
case 'BANDIT':
  if (isPositionEnableConfig) {
    updateQuery = 'UPDATE position_configs SET enabled = ? WHERE server_id = ? AND position_type = ?';
    updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), positionType];
  }
  break;
case 'ON':
  if (isCrateConfig) {
    updateQuery = 'UPDATE crate_event_configs SET enabled = ? WHERE server_id = ? AND crate_type = ?';
    updateParams = [validatedOption === 'on' || validatedOption === 'true', server.id.toString(), crateType];
  }
  break;
```

## 🎯 **How It Works Now:**

**Crate Enable/Disable:**
- Input: `CRATE-1` → `configType = ""` → Matches `case ''` → `isCrateConfig = true` → ✅ Sets crate query

**Position Enable/Disable:**
- Input: `OUTPOST` → `configType = ""` → Matches `case ''` → `isPositionConfig = true` → ✅ Sets position query

**Direct Position Enable/Disable:**
- Input: `OUTPOST` → `configType = "OUTPOST"` → Matches `case 'OUTPOST'` → ✅ Sets position query

## 🚀 **Ready to Test!**

Now all crate event commands should work properly:

```
/set CRATE-1 on <server>     ✅ Enable crate-1
/set CRATE-1 off <server>    ✅ Disable crate-1
/set CRATE-1-TIME 30 <server> ✅ Set spawn interval
/set CRATE-1-AMOUNT 2 <server> ✅ Set spawn amount
/set CRATE-1-MSG "Custom" <server> ✅ Set custom message
```

The fix ensures that crate events get the correct database query and parameters! 🎮
