# Position Command Format Update

## 🎯 Changes Made

### **Updated Position Enable/Disable Command Format:**

**New Format:**
```
/set OUTPOST on Main Server
/set BANDIT off Main Server
```

**Instead of:**
```
/set OUTPOST-ENABLE on Main Server
/set BANDIT-ENABLE off Main Server
```

## 🔧 Technical Implementation

### **What Changed:**
1. **Command Format**: Now uses `OUTPOST` and `BANDIT` directly as config types
2. **Validation**: Updated to handle position names as enable/disable config types
3. **Database Logic**: All database operations remain exactly the same
4. **Autocomplete**: Shows `OUTPOST (Enable/Disable)` and `BANDIT (Enable/Disable)`

### **What Stayed the Same:**
- ✅ **All database logic** - No changes to queries or table structure
- ✅ **All validation rules** - Same on/off validation
- ✅ **All error handling** - Same error messages and handling
- ✅ **All other position options** - DELAY, COOLDOWN remain unchanged

## 📝 Usage Examples

### **New Enable/Disable Commands:**
```
/set OUTPOST on Main Server
/set BANDIT off Main Server
```

### **Other Commands Unchanged:**
```
/set OUTPOST-DELAY 5 Main Server
/set OUTPOST-COOLDOWN 10 Main Server
/set BANDIT-DELAY 3 Main Server
/set BANDIT-COOLDOWN 15 Main Server
```

### **Consistent with Crate Events:**
```
/set CRATE-1 on Main Server
/set CRATE-2 off Main Server
/set OUTPOST on Main Server
/set BANDIT off Main Server
```

## ✅ Benefits

1. **Consistent Format**: All enable/disable commands now use the same format
2. **Cleaner Commands**: Shorter, more intuitive commands
3. **Same Logic**: All database and validation logic remains identical
4. **User Friendly**: Easier to remember and type
5. **Unified Interface**: Position and crate events use the same command pattern

## 🚀 Ready to Use

The format update is complete and all functionality remains exactly the same. Users can now use the consistent format for all enable/disable operations:

- **Crate Events**: `/set CRATE-1 on/off <server>`
- **Positions**: `/set OUTPOST/BANDIT on/off <server>`
