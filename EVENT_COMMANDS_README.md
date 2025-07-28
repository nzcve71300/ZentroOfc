# Event Commands Documentation

## New Event System Commands

### `/set-events` - Configure Bradley and Helicopter Events

Configure Bradley APC and Patrol Helicopter event settings for your Rust servers.

**Usage:**
```
/set-events <server> <event> <option> <value>
```

**Parameters:**
- **server**: Select a server (with autocomplete, includes "ALL" option)
- **event**: Choose between "Bradley APC" or "Patrol Helicopter"
- **option**: Configuration option to set
- **value**: Value for the option

**Available Options:**

#### Bradley APC Options:
- **bradscout**: Enable/disable Bradley event detection (`on`/`off`)
- **bradkillmsg**: Custom kill message (e.g., `<color=#00ffff>Brad got taken</color>`)
- **bradrespawnmsg**: Custom respawn message (e.g., `<color=#00ffff>Bradley APC has respawned</color>`)

#### Patrol Helicopter Options:
- **heliscout**: Enable/disable Helicopter event detection (`on`/`off`)
- **helikillmsg**: Custom kill message (e.g., `<color=#00ffff>Heli got taken</color>`)
- **helirespawnmsg**: Custom respawn message (e.g., `<color=#00ffff>Patrol Helicopter has respawned</color>`)

**Examples:**
```
/set-events Main Server bradley bradscout on
/set-events Main Server bradley bradkillmsg "<color=#ff0000>Bradley APC destroyed!</color>"
/set-events ALL helicopter heliscout off
```

### `/view-events` - View Event Configurations

View current Bradley and Helicopter event configurations for servers.

**Usage:**
```
/view-events <server>
```

**Parameters:**
- **server**: Select a server (with autocomplete, includes "ALL" option)

**Features:**
- Shows current enabled/disabled status for each event
- Displays custom kill and respawn messages
- Supports viewing configurations for all servers at once

## How It Works

### Event Detection
The bot continuously monitors Rust servers for Bradley APC and Patrol Helicopter events using RCON commands:

- **Bradley Detection**: Uses `find_entity servergibs_bradley` command
- **Helicopter Detection**: Uses `find_entity servergibs_patrolhelicopter` command

### Event Flow
1. **Detection**: Bot detects when Bradley/Helicopter debris appears
2. **Flag Management**: Prevents duplicate events with 10-minute cooldown
3. **In-Game Message**: Sends custom kill message to server chat
4. **Discord Notification**: Posts event to configured Discord channel
5. **Respawn Tracking**: Monitors for respawn events

### Database Schema
New table `event_configs` stores:
- `server_id`: Reference to Rust server
- `event_type`: 'bradley' or 'helicopter'
- `enabled`: Boolean for event detection
- `kill_message`: Custom kill message
- `respawn_message`: Custom respawn message
- `created_at`/`updated_at`: Timestamps

## Setup Instructions

### 1. Database Migration
Run the SQL migration to add the events table:
```sql
-- Run add_events_table.sql
```

### 2. Deploy Commands
Deploy the new commands to Discord:
```bash
node deploy-event-commands.js
```

### 3. Configure Events
Use the commands to set up event detection:
```bash
# Enable Bradley events
/set-events Main Server bradley bradscout on

# Set custom kill message
/set-events Main Server bradley bradkillmsg "<color=#00ffff>Brad got taken</color>"

# Enable Helicopter events
/set-events Main Server helicopter heliscout on
```

### 4. Configure Discord Channel (Optional)
Set up an event feed channel to receive Discord notifications:
```sql
INSERT INTO channel_settings (server_id, channel_type, channel_id) 
VALUES (server_id, 'eventfeed', 'your_channel_id');
```

## Features

- ✅ **Multi-tenant**: Each guild has isolated event configurations
- ✅ **ALL Option**: Configure all servers at once
- ✅ **Custom Messages**: Fully customizable kill/respawn messages
- ✅ **Real-time Detection**: Continuous monitoring via RCON
- ✅ **Cooldown System**: Prevents spam with 10-minute flags
- ✅ **Discord Integration**: Posts events to configured channels
- ✅ **Orange Embeds**: Consistent with bot's UI theme

## Troubleshooting

### Event Not Detecting
1. Verify RCON connection is active
2. Check event is enabled: `/view-events <server>`
3. Ensure server has Bradley/Helicopter spawns
4. Check bot logs for RCON errors

### Messages Not Appearing
1. Verify kill/respawn messages are set
2. Check server chat permissions
3. Ensure RCON password is correct

### Discord Notifications Not Working
1. Set up eventfeed channel in database
2. Verify bot has channel permissions
3. Check channel ID is correct 