# Teleport System

A comprehensive teleport system for Rust servers that allows players to teleport to configured locations using emotes.

## Features

- **Emote-based teleportation**: Players use `d11_quick_chat_location_slot_0` emote to teleport
- **Configurable settings**: Multiple configuration options for each server
- **User management**: Allow/ban specific players from using teleports
- **Cooldown system**: Prevent spam with configurable cooldowns
- **Kit integration**: Automatically give kits when teleporting
- **Kill before teleport**: Option to kill players before teleporting
- **Delay system**: Configurable delay before teleporting

## Commands

### `/set` - Configure Teleport Settings

Configure various teleport system options:

- **TPN-USE**: Enable/disable teleport system (`on`/`off`)
- **TPN-TIME**: Cooldown time in minutes between teleports
- **TPN-DELAYTIME**: Delay time in minutes before teleporting
- **TPN-NAME**: Display name for the teleport location
- **TPN-USELIST**: Enable/disable user list restrictions (`on`/`off`)
- **TPN-USE-DELAY**: Enable/disable delay system (`on`/`off`)
- **TPN-USE-KIT**: Enable/disable kit giving (`on`/`off`)
- **TPN-KITNAME**: Name of kit to give when teleporting
- **TPN-KILL**: Enable/disable killing before teleport (`on`/`off`)

**Usage:**
```
/set config:TPN-USE option:on server:ServerName
/set config:TPN-TIME option:60
/set config:TPN-NAME option:Nuketown
```

### `/add-to-list` - Manage User Lists

Add players to allowed or banned lists:

- **TPN-LIST**: Add players to allowed list
- **TPN-BANLIST**: Add players to banned list

**Usage:**
```
/add-to-list list-name:TPN-LIST name:PlayerName server:ServerName
/add-to-list list-name:TPN-BANLIST name:123456789012345678
```

## Database Tables

### `teleport_configs`
Stores teleport configuration for each server:
- `server_id`: Server ID
- `teleport_name`: Teleport location name (default: 'default')
- `position_x`, `position_y`, `position_z`: Teleport coordinates
- `enabled`: Whether teleport system is enabled
- `cooldown_minutes`: Cooldown time in minutes
- `delay_minutes`: Delay time in minutes
- `display_name`: Display name for the location
- `use_list`: Whether to use user lists
- `use_delay`: Whether delay system is enabled
- `use_kit`: Whether to give kits
- `kit_name`: Name of kit to give
- `kill_before_teleport`: Whether to kill before teleporting

### `teleport_allowed_users`
Stores players allowed to use teleports:
- `server_id`: Server ID
- `teleport_name`: Teleport location name
- `discord_id`: Player's Discord ID
- `ign`: Player's in-game name
- `added_by`: Discord ID of who added them

### `teleport_banned_users`
Stores players banned from using teleports:
- `server_id`: Server ID
- `teleport_name`: Teleport location name
- `discord_id`: Player's Discord ID
- `ign`: Player's in-game name
- `banned_by`: Discord ID of who banned them

### `teleport_usage`
Tracks teleport usage for cooldowns:
- `server_id`: Server ID
- `teleport_name`: Teleport location name
- `discord_id`: Player's Discord ID
- `ign`: Player's in-game name
- `used_at`: When teleport was used

## Setup Instructions

1. **Deploy the database schema:**
   ```bash
   node deploy_teleport_system.js
   ```

2. **Restart the bot:**
   ```bash
   pm2 restart zentro-bot
   ```

3. **Configure teleport settings:**
   ```
   /set config:TPN-USE option:on
   /set config:TPN-TIME option:60
   /set config:TPN-NAME option:Main Base
   ```

4. **Add allowed users (if using lists):**
   ```
   /set config:TPN-USELIST option:on
   /add-to-list list-name:TPN-LIST name:PlayerName
   ```

## How It Works

1. **Player uses emote**: Player uses `d11_quick_chat_location_slot_0` emote
2. **System checks**: Bot checks if teleport system is enabled, player permissions, and cooldowns
3. **Validation**: Verifies player is in database and meets all requirements
4. **Execution**: Executes teleport commands in sequence:
   - Kill player (if enabled)
   - Teleport to location
   - Give kit (if enabled)
5. **Feedback**: Sends success/error message to player

## Teleport Commands

The system uses these Rust commands:
- `global.killplayer "PlayerName"` - Kill player before teleport
- `global.teleportposrot "X,Y,Z" "PlayerName" "1"` - Teleport player
- `kit givetoplayer KitName PlayerName` - Give kit to player

## Configuration Examples

### Basic Teleport
```
/set config:TPN-USE option:on
/set config:TPN-TIME option:30
/set config:TPN-NAME option:Spawn Point
```

### Teleport with Kit
```
/set config:TPN-USE option:on
/set config:TPN-USE-KIT option:on
/set config:TPN-KITNAME option:starter_kit
/set config:TPN-NAME option:Starter Area
```

### Restricted Teleport
```
/set config:TPN-USE option:on
/set config:TPN-USELIST option:on
/set config:TPN-KILL option:on
/set config:TPN-NAME option:VIP Area
/add-to-list list-name:TPN-LIST name:VIPPlayer1
```

## Troubleshooting

### Common Issues

1. **Player not found**: Player must be linked in the database
2. **Cooldown active**: Player must wait for cooldown to expire
3. **Not allowed**: Player must be on allowed list if lists are enabled
4. **Banned**: Player is on banned list

### Debug Commands

Check teleport configuration:
```sql
SELECT * FROM teleport_configs WHERE server_id = [SERVER_ID];
```

Check allowed users:
```sql
SELECT * FROM teleport_allowed_users WHERE server_id = [SERVER_ID];
```

Check banned users:
```sql
SELECT * FROM teleport_banned_users WHERE server_id = [SERVER_ID];
```

## Security Features

- **Server-specific**: Each server has independent settings
- **User validation**: Only linked players can use teleports
- **Permission system**: Granular control over who can use teleports
- **Cooldown protection**: Prevents spam and abuse
- **Audit trail**: All usage is logged for monitoring

## Future Enhancements

- Multiple teleport locations per server
- Teleport zones with automatic detection
- Integration with economy system
- Advanced permission roles
- Teleport history and statistics
