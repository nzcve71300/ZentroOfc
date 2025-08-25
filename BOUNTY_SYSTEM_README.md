# 🎯 Bounty System

The Bounty System is an exciting feature that rewards players for eliminating high-value targets who have achieved kill streaks.

## 📋 Overview

When a player gets 5 kills without dying, they become marked as a **Bounty**. Other players can eliminate the bounty to earn a substantial currency reward.

## ⚙️ Configuration

### Admin Commands

Use `/eco-configs` to configure the bounty system:

1. **Enable/Disable Bounty System:**
   ```
   /eco-configs server: [ServerName] setup: Bounty System On/Off option: on
   ```

2. **Set Bounty Reward Amount:**
   ```
   /eco-configs server: [ServerName] setup: Bounty Rewards option: [Amount]
   ```

### Default Settings
- **Kills Required:** 5 kills without dying
- **Default Reward:** 100 currency
- **System Status:** Disabled by default

## 🎮 How It Works

### Becoming a Bounty
1. Player gets kills without dying
2. After 5 kills, they become marked as a bounty
3. Server-wide announcement is displayed

### Bounty Announcement
The system displays a formatted message in-game:
```
[BOUNTY] Eliminate the Bounty [PlayerName] reward = [Amount] [Currency]
```

**Colors Used:**
- **Deep Gold (#FFD700):** Main bounty text
- **Dark Crimson (#8B0000):** Player name and reward amount
- **Text Size:** 35-40 for maximum visibility

### Claiming a Bounty
1. Any player can eliminate the bounty
2. Killer receives the configured currency reward
3. **Requirement:** Killer must be Discord linked to receive reward
4. New bounty can be set after current one is claimed

### Kill Streak Tracking
- Kill streaks are tracked per player
- Streaks reset when player dies
- Only one active bounty per server at a time
- System waits for current bounty to be claimed before setting a new one

## 💰 Rewards

### Currency Distribution
- Bounty rewards are added to player's economy balance
- Transaction is recorded in the database
- Currency name is server-specific (configured per server)

### Requirements
- **Discord Linking:** Players must be linked to receive rewards
- **Player Kills Only:** Bounty system only works on player kills (not scientists/animals)

## 🗄️ Database Tables

### bounty_configs
Stores server-specific bounty configuration:
- `server_id`: Server identifier
- `enabled`: Whether bounty system is active
- `reward_amount`: Currency reward for claiming bounty
- `kills_required`: Number of kills needed to become bounty

### bounty_tracking
Tracks player kill streaks and bounty status:
- `player_name`: In-game player name
- `kill_streak`: Current kill streak count
- `is_active_bounty`: Whether player is currently a bounty
- `bounty_created_at`: When bounty was set
- `bounty_claimed_at`: When bounty was claimed
- `claimed_by`: Who claimed the bounty

## 🚀 Deployment

1. **Run the deployment script:**
   ```bash
   node deploy_bounty_system.js
   ```

2. **Restart the bot:**
   ```bash
   pm2 restart zentro-bot
   ```

3. **Configure per server using `/eco-configs`**

## 🔧 Technical Details

### Integration Points
- **Kill Processing:** Integrated into existing kill event handling
- **Currency System:** Uses existing economy and transaction systems
- **Player Linking:** Leverages existing Discord linking system

### Performance
- Database indexes for efficient queries
- In-memory tracking for active bounties
- Minimal impact on existing kill processing

### Error Handling
- Graceful handling of missing player records
- Fallback for unlinked players
- Comprehensive logging for debugging

## 🎯 Example Usage

1. **Enable bounty system:**
   ```
   /eco-configs server: RUST SERVER setup: Bounty System On/Off option: on
   ```

2. **Set reward amount:**
   ```
   /eco-configs server: RUST SERVER setup: Bounty Rewards option: 500
   ```

3. **Players get 5 kills without dying**
4. **Bounty announcement appears in-game**
5. **Another player eliminates the bounty**
6. **Reward is given to the killer**

## 🔍 Monitoring

### Console Logs
The system provides detailed logging:
- New bounty creation
- Bounty claims
- Kill streak updates
- Error conditions

### Admin Feed Logging
Bounty events are automatically logged to the admin feed channel (`/channel-set4`):
- **Bounty Set:** When a player becomes a bounty
- **Bounty Claimed:** When a bounty is eliminated and reward is given

### Database Queries
Monitor bounty activity:
```sql
-- Check active bounties
SELECT * FROM bounty_tracking WHERE is_active_bounty = TRUE;

-- Check bounty configuration
SELECT * FROM bounty_configs WHERE enabled = TRUE;

-- View recent bounty claims
SELECT * FROM bounty_tracking WHERE bounty_claimed_at IS NOT NULL ORDER BY bounty_claimed_at DESC;
```

## 🛠️ Troubleshooting

### Common Issues
1. **Bounty not appearing:** Check if system is enabled for the server
2. **No reward given:** Verify player is Discord linked
3. **Multiple bounties:** System ensures only one active bounty per server

### Debug Commands
- Check bounty configuration: Query `bounty_configs` table
- Verify player linking: Check `players` table for `discord_id`
- Monitor kill streaks: Query `bounty_tracking` table

---

**Note:** The bounty system is designed to work seamlessly with existing kill reward systems and does not interfere with normal player kill rewards.
