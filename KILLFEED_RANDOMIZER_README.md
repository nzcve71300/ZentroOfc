# 🎲 Killfeed Randomizer

The Killfeed Randomizer adds variety and excitement to your killfeed messages by randomly replacing the word "killed" with different phrases.

## 📋 Overview

When enabled, the randomizer will replace "killed" in your killfeed messages with one of 8 different phrases, making each kill announcement unique and entertaining.

## ⚙️ Configuration

### Admin Commands

Use `/killfeed-setup` to configure the killfeed randomizer:

```
/killfeed-setup server: [ServerName] format_string: "{Killer} killed {Victim}" randomizer: Enable
```

**Options:**
- `randomizer: Enable` - Turn on the randomizer
- `randomizer: Disable` - Turn off the randomizer

### Default Settings
- **Randomizer Status:** Disabled by default (respects database setting)
- **Format String:** Uses your existing killfeed format
- **Replacement Word:** "killed" (case-insensitive)
- **Behavior:** When OFF, uses exact format string; when ON, randomizes "killed"

## 🎮 How It Works

### Randomizer Phrases
The system randomly selects from these 8 phrases:

1. **killed** (the classic, keep it in)
2. **murked**
3. **clapped**
4. **smoked**
5. **deleted**
6. **dropped**
7. **rekt**
8. **bonked**

### Example Output
With format string: `"{Killer} killed {Victim}"`

**Possible results:**
- `Player1 killed Player2`
- `Player1 murked Player2`
- `Player1 clapped Player2`
- `Player1 smoked Player2`
- `Player1 deleted Player2`
- `Player1 dropped Player2`
- `Player1 rekt Player2`
- `Player1 bonked Player2`

## 🎯 Usage Examples

### Basic Setup
```
/killfeed-setup server: RUST SERVER format_string: "{Killer} killed {Victim}" randomizer: Enable
```

### With Additional Placeholders
```
/killfeed-setup server: RUST SERVER format_string: "{Killer} killed {Victim} (K/D: {KillerKD})" randomizer: Enable
```

### Disable Randomizer
```
/killfeed-setup server: RUST SERVER format_string: "{Killer} killed {Victim}" randomizer: Disable
```

## 🔧 Technical Details

### Integration
- **Seamless Integration:** Works with existing killfeed system
- **Format Preservation:** Maintains all placeholders and formatting
- **Case Insensitive:** Replaces "killed", "Killed", "KILLED", etc.
- **Real-time:** Each kill gets a random phrase immediately

### Database Storage
- **Table:** `killfeed_configs`
- **Field:** `randomizer_enabled` (BOOLEAN)
- **Default:** FALSE (disabled)

### Performance
- **Minimal Impact:** No performance overhead
- **Memory Efficient:** Uses simple array lookup
- **Fast Execution:** Instant phrase selection

## 🚀 Deployment

1. **Run the fix script:**
   ```bash
   node fix_killfeed_randomizer_and_teleport_spam.js
   ```

2. **Restart the bot:**
   ```bash
   pm2 restart zentro-bot
   ```

3. **Configure per server using `/killfeed-setup`**

## 🎲 Example Configurations

### Simple Killfeed
```
Format: "{Killer} killed {Victim}"
Randomizer: Enable
Results:
- Player1 killed Player2
- Player1 murked Player2
- Player1 clapped Player2
```

### Detailed Killfeed
```
Format: "{Killer} killed {Victim} | K/D: {KillerKD} | Streak: {KillerStreak}"
Randomizer: Enable
Results:
- Player1 killed Player2 | K/D: 2.5 | Streak: 3
- Player1 murked Player2 | K/D: 2.5 | Streak: 3
- Player1 clapped Player2 | K/D: 2.5 | Streak: 3
```

### Clan Killfeed
```
Format: "[{KillerClanName}] {Killer} killed {Victim}"
Randomizer: Enable
Results:
- [ClanA] Player1 killed Player2
- [ClanA] Player1 murked Player2
- [ClanA] Player1 clapped Player2
```

## 🔍 Monitoring

### Console Logs
The system provides logging for:
- Randomizer enable/disable events
- Phrase selection (debug mode)
- Error conditions

### Database Queries
Monitor randomizer usage:
```sql
-- Check which servers have randomizer enabled
SELECT rs.nickname, kc.randomizer_enabled 
FROM killfeed_configs kc 
JOIN rust_servers rs ON kc.server_id = rs.id;

-- Check all killfeed configurations
SELECT rs.nickname, kc.enabled, kc.randomizer_enabled, kc.format_string 
FROM killfeed_configs kc 
JOIN rust_servers rs ON kc.server_id = rs.id;
```

## 🛠️ Troubleshooting

### Common Issues
1. **Randomizer not working:** Check if it's enabled for the server
2. **No phrase changes:** Ensure format string contains "killed"
3. **Same phrase every time:** Randomizer is working correctly - each kill is independent
4. **Randomizer always on:** Fixed - now respects database setting
5. **Teleport spam in admin feed:** Fixed - Outpost/Bandit Camp teleports no longer spam

### Debug Steps
1. Check randomizer status: `/killfeed-setup` command
2. Verify format string contains "killed"
3. Test with player kills
4. Check console logs for errors

## 🎯 Tips

### Best Practices
- **Keep it Simple:** Don't overcomplicate the format string
- **Test First:** Try with a simple format before adding complexity
- **Monitor Feedback:** Ask players what they think of the phrases
- **Regular Updates:** Consider changing phrases periodically for variety

### Creative Uses
- **Event Killfeeds:** Use special phrases for events
- **Server Themes:** Match phrases to server theme
- **Player Feedback:** Let players suggest new phrases

---

**Note:** The randomizer only affects the word "killed" and preserves all other formatting, placeholders, and styling in your killfeed messages.
