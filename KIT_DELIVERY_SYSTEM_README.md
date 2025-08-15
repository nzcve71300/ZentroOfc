# 📦 Kit Delivery System

A solution to Rust's quantity limitation issue when purchasing kits through the Discord shop system.

## 🎯 Problem Solved

**Issue:** When users purchase kits with quantity > 1 (e.g., 5x VIP Kit), Rust blocks the quantity adjustment and players receive nothing in-game.

**Solution:** The bot now queues kit purchases and delivers them one-at-a-time through Discord emoji reactions, bypassing Rust's quantity limitations.

## 🔧 How It Works

### For Kit Purchases (Quantity > 1)
1. User purchases kits with quantity > 1 through `/shop`
2. Instead of sending all kits at once, the bot:
   - Adds the purchase to a delivery queue
   - Shows a special "Kit Delivery Queue" embed
   - Adds a 📦 reaction to the message
   - Notifies the player in-game to react in Discord

### For Single Kits & Items
- Single kits (quantity = 1) are delivered immediately as before
- All items are delivered immediately (not affected by Rust limitations)

### Kit Claiming Process
1. Player reacts with 📦 emoji on their queue message
2. Bot delivers exactly one kit via RCON
3. Updates the embed showing remaining quantity
4. Removes the player's reaction so they can react again
5. Repeats until all kits are delivered

## 🛡️ Anti-Spam Protection

- **5-second cooldown** between kit claims per player
- **User verification** - only the kit owner can claim their kits
- **Automatic reaction removal** to prevent spam
- **In-game cooldown notifications**

## 📊 Features

### Real-Time Updates
- ✅ Live embed updates showing remaining kits
- 🎮 In-game delivery confirmations
- 📝 Admin feed logging for all deliveries
- 🏁 Automatic completion when all kits delivered

### Smart Queue Management
- 🗑️ Auto-cleanup of completed deliveries
- ⏰ Scheduled cleanup of old entries (7+ days)
- 🔄 Persistent across bot restarts
- 💾 Full database tracking

### User Experience
- 🎨 Beautiful delivery-themed embeds
- 🚀 Instant feedback and confirmations
- 🛡️ Error handling and recovery
- 📱 Mobile-friendly emoji reactions

## 🗄️ Database Schema

### New Table: `kit_delivery_queue`
```sql
CREATE TABLE kit_delivery_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    guild_id BIGINT NOT NULL,
    server_id VARCHAR(32) NOT NULL,
    kit_id INT NOT NULL,
    kit_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    remaining_quantity INT NOT NULL,
    original_quantity INT NOT NULL,
    price_per_kit INT NOT NULL,
    total_paid INT NOT NULL,
    emote_reaction VARCHAR(100) NOT NULL DEFAULT '📦',
    message_id BIGINT,
    channel_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_delivered_at TIMESTAMP NULL,
    cooldown_seconds INT DEFAULT 5,
    -- Foreign keys and indexes...
);
```

## 📁 Modified Files

### Core Changes
- **`src/events/interactionCreate.js`** - Modified purchase confirmation logic
- **`src/index.js`** - Added message reaction event handler
- **`src/utils/kitDeliveryHandler.js`** - New kit delivery system logic

### Database
- **`sql/create_kit_queue_table.sql`** - New table schema
- **`deploy_kit_delivery_system.js`** - Deployment and management script

## 🚀 Deployment Steps

### 1. Create Database Table
```bash
node deploy_kit_delivery_system.js
```

### 2. Restart Bot
```bash
pm2 restart zentro-bot
```

### 3. Test the System
1. Purchase a kit with quantity > 1
2. Verify the queue message appears with 📦 reaction
3. React with 📦 to claim one kit
4. Verify in-game delivery and embed updates

## 🧹 Maintenance

### Cleanup Old Entries
```bash
node deploy_kit_delivery_system.js --cleanup
```

### Monitor Queue Status
```sql
SELECT 
    kdq.display_name, 
    kdq.remaining_quantity, 
    kdq.created_at, 
    p.ign, 
    rs.nickname
FROM kit_delivery_queue kdq
JOIN players p ON kdq.player_id = p.id
JOIN rust_servers rs ON kdq.server_id = rs.id
ORDER BY kdq.created_at DESC;
```

## 🎮 User Instructions

### For Players
1. **Purchase kits** through `/shop` as normal
2. **Look for queue messages** with 📦 reactions for multi-kit purchases
3. **React with 📦** to claim one kit at a time
4. **Wait 5 seconds** between claims (anti-spam)
5. **Watch embed updates** to see remaining kits

### For Admins
- Monitor kit deliveries in admin feed
- Use cleanup script weekly to maintain performance
- Queue entries auto-expire after 7 days
- All deliveries are logged for audit purposes

## ⚠️ Important Notes

### What Changed
- **Multi-kit purchases** now use the queue system
- **Single kits** and **all items** work exactly as before
- **No impact** on existing functionality

### Compatibility
- ✅ Works with existing shop categories and permissions
- ✅ Compatible with VIP/Elite kit systems
- ✅ Maintains all cooldown and timer functionality
- ✅ Preserves admin feed logging

### Performance
- Minimal database impact (one table, efficient queries)
- Automatic cleanup prevents data buildup
- Indexed for fast lookups
- No impact on RCON performance

## 🔧 Troubleshooting

### Common Issues

**Queue message not appearing:**
- Check bot has reaction permissions in channel
- Verify kit quantity is > 1
- Check database connection

**Reactions not working:**
- Ensure bot can add/remove reactions
- Verify user is the kit owner
- Check cooldown status (5 seconds)

**Kits not delivering in-game:**
- Verify RCON connection to server
- Check kit name matches server configuration
- Ensure player is online and linked

### Debug Commands
```bash
# Check active queue entries
node -e "const pool = require('./src/db'); pool.query('SELECT * FROM kit_delivery_queue').then(([rows]) => { console.log(rows); process.exit(0); });"

# Manual cleanup
node deploy_kit_delivery_system.js --cleanup

# Test database connection
node -e "const pool = require('./src/db'); pool.query('SELECT 1').then(() => { console.log('Database OK'); process.exit(0); });"
```

## 📈 Future Enhancements

### Planned Features
- 📊 Queue statistics and analytics
- 🎯 Custom emote reactions per kit type
- ⏰ Scheduled kit deliveries
- 📱 Mobile app integration
- 🎮 In-game queue management commands

### Possible Improvements
- Bulk delivery options for admins
- Queue priority system
- Gift kit functionality
- Queue transfer between players

---

## 🎉 Success!

The Kit Delivery System successfully solves Rust's quantity limitation issue while maintaining a smooth user experience. Players can now purchase multiple kits and claim them one-at-a-time through Discord reactions, ensuring they receive everything they paid for.

**Happy kit delivering! 📦✨**
