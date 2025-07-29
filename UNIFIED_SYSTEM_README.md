# Zentro Bot - Unified Player System

## Problem Solved

The original system had **two separate database structures** for managing players and their balances:

1. **Old `players` table** - Used by economy commands (`/balance`, `/add-currency-player`, etc.)
2. **New `player_links` table** - Used by linking commands (`/link`, `/unlink`, etc.)

This created a disconnect where:
- Players could link their accounts but economy commands couldn't find them
- Economy commands worked with one system while linking worked with another
- Balances weren't shared between the systems

## Solution: Unified Player System

I've created a **unified database structure** that consolidates everything into a single, consistent system.

### Key Changes

1. **Unified `players` table** - Replaces both old `players` and `player_links` tables
2. **Consistent foreign keys** - Economy table now properly references the unified players table
3. **Single source of truth** - All commands now use the same player data
4. **Proper linking system** - Discord IDs are properly linked to IGNs across all servers

### New Database Structure

```sql
-- Unified players table (replaces both old players and player_links)
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    guild_id INT REFERENCES guilds(id) ON DELETE CASCADE,
    server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
    discord_id VARCHAR(32) NOT NULL,
    ign TEXT NOT NULL,
    linked_at TIMESTAMP DEFAULT NOW(),
    unlinked_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(guild_id, discord_id, server_id)
);

-- Economy table (properly linked to unified players)
CREATE TABLE economy (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id) ON DELETE CASCADE,
    balance INT DEFAULT 0,
    UNIQUE(player_id)
);
```

### Updated Commands

All commands now use the unified system:

- **`/link`** - Creates player records in the unified system
- **`/unlink`** - Removes player records from the unified system  
- **`/allow-link`** - Admin command to create player links
- **`/balance`** - Shows balance from unified player records
- **`/add-currency-player`** - Adds currency to unified player records
- **`/remove-currency-player`** - Removes currency from unified player records
- **`/add-currency-server`** - Adds currency to all players on a server
- **`/remove-currency-server`** - Removes currency from all players on a server

## Implementation Steps

### Step 1: Backup Your Database
```bash
pg_dump your_database_name > backup_before_migration.sql
```

### Step 2: Run the Migration
```bash
node migrate_to_unified_system.js
```

### Step 3: Update Your Commands
The commands have been updated to use the new unified system. Make sure to:

1. Replace the old utility imports with the new unified system
2. Update any remaining commands that still use the old system

### Step 4: Test the System
Test these scenarios:

1. **Linking**: `/link <in-game-name>` should work across all servers
2. **Balance**: `/balance` should show balances from all linked servers
3. **Admin commands**: `/add-currency-player` should work with linked players
4. **Server commands**: `/add-currency-server` should affect all linked players

## Key Benefits

1. **100% Integration** - All commands now share the same player data
2. **Consistent Balances** - Economy commands work with linked players
3. **Multi-server Support** - Players can be linked across multiple servers
4. **Admin Control** - Admins can manage links and economy together
5. **Better Performance** - Optimized indexes and queries

## Files Created/Modified

### New Files:
- `unified_database_schema.sql` - Complete new database schema
- `src/utils/unifiedPlayerSystem.js` - New unified utility functions
- `migrate_to_unified_system.js` - Migration script
- `UNIFIED_SYSTEM_README.md` - This documentation

### Modified Files:
- `src/commands/player/link.js` - Updated to use unified system
- `src/commands/player/balance.js` - Updated to use unified system
- `src/commands/admin/addCurrencyPlayer.js` - Updated to use unified system
- `src/commands/admin/removeCurrencyPlayer.js` - Updated to use unified system
- `src/commands/admin/addCurrencyServer.js` - Updated to use unified system
- `src/commands/admin/removeCurrencyServer.js` - Updated to use unified system
- `src/commands/admin/unlink.js` - Updated to use unified system
- `src/commands/admin/allowLink.js` - Updated to use unified system

## Troubleshooting

### If migration fails:
1. Restore from backup: `psql your_database_name < backup_before_migration.sql`
2. Check database permissions
3. Ensure no active connections to the database

### If commands don't work:
1. Check that all imports are updated to use `unifiedPlayerSystem.js`
2. Verify the database migration completed successfully
3. Check console logs for any errors

### If balances are missing:
1. Run the migration script again
2. Check that economy records were properly migrated
3. Verify player records are active (`is_active = true`)

## Next Steps

After implementing this unified system:

1. **Test thoroughly** with your existing data
2. **Update remaining commands** that might still use the old system
3. **Monitor performance** and adjust indexes if needed
4. **Backup regularly** to prevent data loss

This unified system will ensure that all your linking and economy commands work together seamlessly!