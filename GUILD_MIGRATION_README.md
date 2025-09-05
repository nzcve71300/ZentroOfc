# Zentro Bot Guild Migration Guide

This guide will help you migrate all bot data from one Discord server to another while keeping the Rust server configuration unchanged.

## Overview

**Migration Details:**
- **From Discord Server:** `1376431874699825216`
- **To Discord Server:** `1413335350742614067`
- **Rust Server:** Remains unchanged (same IP, port, RCON details)

## What Gets Migrated

The migration script will move all the following data:

### Core Data
- ✅ Guild record
- ✅ Rust server configurations
- ✅ Player accounts and links
- ✅ Economy balances
- ✅ Transaction history

### Shop System
- ✅ Shop categories
- ✅ Shop items
- ✅ Shop kits
- ✅ Auto-kits
- ✅ Kit authorization settings

### Additional Features
- ✅ Channel settings
- ✅ Position coordinates
- ✅ Zones
- ✅ Killfeed configurations
- ✅ Player statistics
- ✅ Home teleport data
- ✅ Player whitelists
- ✅ ZORP settings
- ✅ Bounty system data
- ✅ Prison system data
- ✅ Rider configuration
- ✅ Nivaro store data

## Prerequisites

1. **Bot Access:** Ensure the bot is added to the new Discord server (`1413335350742614067`)
2. **Database Access:** Make sure you have access to the MySQL database
3. **Backup:** The migration script creates automatic backups before proceeding

## Migration Steps

### Step 1: Run the Migration

```bash
node run_migration.js
```

The script will:
1. Ask for confirmation before proceeding
2. Create a backup of existing data
3. Migrate all data to the new guild
4. Verify the migration was successful

### Step 2: Verify Migration

After migration, test the following in the new Discord server:

1. **Player Commands:**
   - `/link` - Link Discord account to Rust player
   - `/balance` - Check economy balance
   - `/daily` - Claim daily rewards
   - `/shop` - Access shop system

2. **Admin Commands:**
   - `/addserver` - Verify server is still configured
   - `/serverlist` - Check server status
   - `/economy` - Manage player economy

3. **Additional Features:**
   - Test any custom features your server uses
   - Verify ZORP, home teleport, bounty system, etc.

## Rollback (If Needed)

If something goes wrong, you can rollback the migration:

```bash
node rollback_migration.js
```

This will move all data back to the original Discord server.

## Important Notes

### What Stays the Same
- ✅ Rust server IP and port
- ✅ RCON password and settings
- ✅ All player in-game data
- ✅ Server configuration files

### What Changes
- 🔄 Discord server ID in the database
- 🔄 Bot will respond to commands in the new Discord server
- 🔄 All Discord-specific settings move to new server

### After Migration
1. **Remove Bot from Old Server:** Once you've verified everything works, remove the bot from the old Discord server
2. **Update Documentation:** Update any documentation that references the old server ID
3. **Notify Players:** Let your community know about the Discord server change

## Troubleshooting

### Common Issues

**Bot not responding in new server:**
- Ensure the bot has proper permissions in the new Discord server
- Check that the bot is online and connected

**Player data missing:**
- Run the verification step in the migration script
- Check the database directly if needed

**Economy not working:**
- Verify player links are working with `/link` command
- Check that the economy table was migrated properly

### Database Queries for Verification

```sql
-- Check guild records
SELECT * FROM guilds WHERE discord_id IN ('1376431874699825216', '1413335350742614067');

-- Check servers
SELECT rs.*, g.discord_id as guild_discord_id 
FROM rust_servers rs 
JOIN guilds g ON rs.guild_id = g.id 
WHERE g.discord_id IN ('1376431874699825216', '1413335350742614067');

-- Check players
SELECT p.*, g.discord_id as guild_discord_id 
FROM players p 
JOIN guilds g ON p.guild_id = g.id 
WHERE g.discord_id IN ('1376431874699825216', '1413335350742614067');
```

## Support

If you encounter any issues during migration:

1. Check the console output for error messages
2. Verify database connectivity
3. Ensure all prerequisites are met
4. Use the rollback script if needed
5. Contact support with specific error messages

## Files Created

- `migrate_guild_data.js` - Main migration script
- `run_migration.js` - User-friendly migration runner
- `rollback_migration.js` - Rollback script
- `GUILD_MIGRATION_README.md` - This documentation

---

**⚠️ Important:** Always test the migration in a development environment first if possible, and ensure you have database backups before proceeding.
