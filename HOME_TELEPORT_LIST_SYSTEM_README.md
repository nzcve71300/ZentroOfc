# Home Teleport List System

## Overview
The Home Teleport system has been updated to use the same list-based permission system as Recycler and Zorp systems. This provides better control and consistency across all bot features.

## What Changed

### ❌ Removed (Old System)
- `/add-player-whitelist` command
- `/remove-player-whitelist` command  
- `/view-player-whitelist` command
- Old whitelist system using `player_whitelists` table
- `whitelist_enabled` column in `home_teleport_configs`

### ✅ Added (New System)
- `/set HOMETP-USELIST` configuration option
- `HOMETP-LIST` option in `/add-to-list` and `/remove-from-list`
- `HOMETP-BANLIST` option in `/add-to-list` and `/remove-from-list`
- New database tables: `home_teleport_allowed_users` and `home_teleport_banned_users`
- `use_list` column in `home_teleport_configs`

## Database Schema

### New Tables
```sql
-- Home teleport allowed users
CREATE TABLE home_teleport_allowed_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    discord_id VARCHAR(32) NULL,
    ign VARCHAR(255) NULL,
    added_by VARCHAR(32) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_home_teleport_allowed (server_id, discord_id, ign)
);

-- Home teleport banned users
CREATE TABLE home_teleport_banned_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    discord_id VARCHAR(32) NULL,
    ign VARCHAR(255) NULL,
    banned_by VARCHAR(32) NOT NULL,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_home_teleport_banned (server_id, discord_id, ign)
);
```

### Updated Table
```sql
-- Add use_list column to home_teleport_configs
ALTER TABLE home_teleport_configs 
ADD COLUMN use_list BOOLEAN DEFAULT FALSE AFTER cooldown_minutes;
```

## Commands

### Configuration
```
/set HOMETP-USELIST on|off server:ServerName
```
- **on**: Only players in HOMETP-LIST can use home teleport
- **off**: Anyone can use home teleport (except banned players)

### Adding Players
```
/add-to-list HOMETP-LIST name:PlayerName server:ServerName
/add-to-list HOMETP-BANLIST name:PlayerName server:ServerName
```

### Removing Players
```
/remove-from-list HOMETP-LIST name:PlayerName server:ServerName
/remove-from-list HOMETP-BANLIST name:PlayerName server:ServerName
```

## How It Works

### When HOMETP-USELIST is OFF (Default)
1. ✅ Anyone can use home teleport
2. ❌ Players in HOMETP-BANLIST cannot use home teleport (silent rejection)
3. ✅ No in-game messages for unauthorized players

### When HOMETP-USELIST is ON
1. ✅ Only players in HOMETP-LIST can use home teleport
2. ❌ Players not in HOMETP-LIST cannot use home teleport (silent rejection)
3. ❌ Players in HOMETP-BANLIST cannot use home teleport (silent rejection)
4. ✅ No in-game messages for unauthorized players

### Priority System
1. **Banned players** are always blocked (highest priority)
2. **List restrictions** apply if HOMETP-USELIST is ON
3. **Cooldown** applies to all allowed players

## Migration from Old System

### Automatic Migration
- Old `whitelist_enabled` column is preserved but not used
- New `use_list` column defaults to FALSE (allowing everyone)
- No data migration needed - start fresh with new system

### Manual Migration Steps
1. Run database update script: `sql/update_home_teleport_schema.sql`
2. Configure servers: `/set HOMETP-USELIST on server:ServerName`
3. Add players to lists: `/add-to-list HOMETP-LIST name:PlayerName server:ServerName`
4. Test functionality

## Benefits

### Consistency
- Same system as Recycler and Zorp
- Familiar commands for admins
- Consistent behavior across all features

### Better Control
- Separate allowed and banned lists
- Silent rejection (no spam messages)
- Easy to manage with existing commands

### Performance
- Direct database queries (no complex joins)
- Efficient indexing
- Clean separation of concerns

## Testing

Run the test script to verify everything works:
```bash
node test_home_teleport_list_system.js
```

## Troubleshooting

### Common Issues
1. **"Table doesn't exist"**: Run the database update script
2. **"Column doesn't exist"**: Check if `use_list` column was added
3. **"Command not found"**: Restart the bot to load new commands

### Debug Commands
- Check configuration: Look at `home_teleport_configs` table
- Check allowed users: `SELECT * FROM home_teleport_allowed_users WHERE server_id = 'SERVER_ID'`
- Check banned users: `SELECT * FROM home_teleport_banned_users WHERE server_id = 'SERVER_ID'`

## Files Modified
- `src/commands/admin/set.js` - Added HOMETP-USELIST option
- `src/commands/admin/addToList.js` - Added HOMETP-LIST and HOMETP-BANLIST
- `src/commands/admin/removeFromList.js` - Added HOMETP-LIST and HOMETP-BANLIST
- `src/rcon/index.js` - Updated home teleport functions to use new list system
- `sql/update_home_teleport_schema.sql` - Database schema updates
- `test_home_teleport_list_system.js` - Test script

## Files Deleted
- `src/commands/admin/addPlayerWhitelist.js`
- `src/commands/admin/removePlayerWhitelist.js`
- `src/commands/admin/viewWhitelistPlayers.js`
