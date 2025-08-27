# Crate Config Type Extraction Fix

## 🐛 **Issue Identified:**

When using `/set CRATE-1 on <server>`, the bot was returning:
```
❌ Unknown config type: 1
```

## 🔍 **Root Cause:**

The `configType` extraction logic was incorrectly parsing crate event commands:

**Problem Code:**
```javascript
const configType = config.split('-')[1] || ''; // e.g., "USE", "TIME", "SCOUT", or empty for CRATE-X
```

**What was happening:**
- Input: `CRATE-1`
- `config.split('-')` → `["CRATE", "1"]`
- `config.split('-')[1]` → `"1"`
- Validation switch had no case for `"1"` → Error

## ✅ **Solution Implemented:**

**New Logic:**
```javascript
// Extract config type, handling crate events properly
let configType = '';
if (isCrateConfig) {
  // For crate events, check if there's a suffix after the crate number
  const crateParts = config.split('-');
  if (crateParts.length >= 3) {
    // e.g., "CRATE-1-TIME" -> "TIME"
    configType = crateParts[2];
  } else {
    // e.g., "CRATE-1" -> "" (empty for enable/disable)
    configType = '';
  }
} else {
  // For other configs, use the original logic
  configType = config.split('-')[1] || '';
}
```

## 🎯 **How It Works Now:**

**Crate Enable/Disable:**
- Input: `CRATE-1` → `configType = ""` → Matches `case ''` → ✅ Works

**Crate Configuration:**
- Input: `CRATE-1-TIME` → `configType = "TIME"` → Matches `case 'TIME'` → ✅ Works
- Input: `CRATE-1-AMOUNT` → `configType = "AMOUNT"` → Matches `case 'AMOUNT'` → ✅ Works
- Input: `CRATE-1-MSG` → `configType = "MSG"` → Matches `case 'MSG'` → ✅ Works

## 🚀 **Ready to Test:**

Now all crate event commands should work properly:

```
/set CRATE-1 on <server>     ✅ Enable crate-1
/set CRATE-1 off <server>    ✅ Disable crate-1
/set CRATE-1-TIME 30 <server> ✅ Set spawn interval
/set CRATE-1-AMOUNT 2 <server> ✅ Set spawn amount
/set CRATE-1-MSG "Custom" <server> ✅ Set custom message
```

The fix ensures that crate events are parsed correctly and match the appropriate validation cases! 🎮
