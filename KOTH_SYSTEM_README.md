# KOTH (King of the Hill) System

The KOTH system is a comprehensive event management system for Rust servers that allows players to compete for control of designated areas (gates) and earn rewards.

## Features

- **12 KOTH Gates**: Support for up to 12 different KOTH locations per server
- **Event Management**: Create, start, stop, and manage KOTH events
- **Real-time Monitoring**: Track players in zones and determine the current "king"
- **Reward System**: Configurable rewards for event winners
- **Admin Commands**: Full administrative control over events
- **Database Integration**: Persistent storage of events, participants, and history

## Setup Instructions

### 1. Initial Setup
Use the `/setupkoth` command to initialize the KOTH system for a server:
```
/setupkoth server:YourServer gate_count:12
```

### 2. Configure Gate Positions
Use the `/manage-positions` command to set coordinates for each KOTH gate:
```
/manage-positions server:YourServer position:Koth-Gate-1 coordinates:100,200,300
/manage-positions server:YourServer position:Koth-Gate-2 coordinates:150,250,350
... (repeat for all 12 gates)
```

### 3. Start Events
Use any of the following commands to start KOTH events:
- `/koth start` - Full event configuration
- `/startkothevent` - Quick event start
- `/kothrestart` - Restart existing event

## Commands

### Main Commands
- `/koth` - Main KOTH event management with subcommands:
  - `join` - Join an active KOTH event
  - `restart` - Restart the current event
  - `view` - View event status
  - `remove` - Remove current event
  - `start` - Start a new event

### Quick Commands
- `/kothjoin` - Quick join KOTH event
- `/kothrestart` - Quick restart KOTH event
- `/kothview` - Quick view event status
- `/removekoth` - Quick remove KOTH event
- `/setupkoth` - Setup KOTH system for server
- `/startkothevent` - Start KOTH event manually
- `/teleportkoth` - Teleport player to KOTH gate

## Event Flow

1. **Setup**: Admin configures KOTH gates using `/manage-positions`
2. **Start**: Admin starts event using `/koth start` or `/startkothevent`
3. **Countdown**: Event enters countdown phase (default 60 seconds)
4. **Active**: Event becomes active, players can join and compete
5. **Capture**: First player to hold the zone for the capture time wins
6. **Completion**: Event ends, winner receives reward, event is logged

## Configuration Options

### Event Settings
- **Capture Time**: How long a player must hold the zone to win (default: 300 seconds)
- **Countdown Time**: Time before event becomes active (default: 60 seconds)
- **Max Participants**: Maximum number of players allowed (default: 50)
- **Reward Amount**: Amount of reward currency (default: 1000)
- **Reward Currency**: Type of reward (scrap, wood, stone, metal, sulfur)

### Gate Settings
- **Position**: X, Y, Z coordinates of the gate
- **Zone Size**: Size of the capture zone (default: 50 units)
- **Enabled**: Whether the gate is available for events

## Database Tables

### koth_events
Stores active and completed KOTH events with all configuration details.

### koth_gates
Stores gate positions and settings for each server.

### koth_participants
Tracks players who join events and their participation status.

### koth_event_history
Historical record of completed events and winners.

### koth_config
Server-specific configuration settings for the KOTH system.

## Technical Details

### Zone Management
- KOTH zones are created dynamically using Rust's zone system
- Zones are automatically cleaned up when events end
- Zone colors and settings are configured for optimal gameplay

### Teleport System
- Uses the same `global.teleportposrot` command format as OUTPOST and BANDITCAMP
- Players are automatically teleported to KOTH gates when joining events
- Manual teleportation available via `/teleportkoth` command
- Coordinates are validated before teleportation

### Monitoring
- Events are monitored every 5 seconds during active phases
- Player presence in zones is tracked via RCON commands
- Automatic cleanup of expired or abandoned events

### Integration
- Fully integrated with existing Zentro Bot infrastructure
- Uses existing RCON system for server communication
- Leverages existing permission system for admin controls

## Troubleshooting

### Common Issues
1. **No Gates Available**: Run `/setupkoth` first, then configure gate positions
2. **Event Won't Start**: Ensure at least one gate has valid coordinates
3. **Zone Not Created**: Check RCON connection and server permissions
4. **Players Can't Join**: Verify event is in countdown or active status

### Logs
Check the console logs for KOTH-related messages:
- `[KothManager]` - System initialization and event management
- `[KothManager]` - Event status updates and zone operations

## Future Enhancements

- Automatic event scheduling
- Multiple concurrent events
- Team-based KOTH events
- Custom reward items
- Event statistics and leaderboards
- Integration with economy system for automatic reward distribution
