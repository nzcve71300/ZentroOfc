# 🚀 ZentroLinked Role Deployment Guide

## What This Does
- Adds a new orange "ZentroLinked" role to players when they use `/link`
- Creates a script to add the role to all existing linked players
- Updates the success message to mention the new role

## Files Modified
1. `src/events/interactionCreate.js` - Added role assignment to `/link` command
2. `src/utils/permissions.js` - Added `ensureZentroLinkedRole` function
3. `deploy_zentro_linked_role.js` - Script to add role to existing players

## SSH Deployment Steps

### Step 1: Upload the modified files
```bash
# Upload the modified files to your server
scp src/events/interactionCreate.js user@your-server:/path/to/zentro-app/src/events/
scp src/utils/permissions.js user@your-server:/path/to/zentro-app/src/utils/
scp deploy_zentro_linked_role.js user@your-server:/path/to/zentro-app/
```

### Step 2: SSH into your server
```bash
ssh user@your-server
cd /path/to/zentro-app
```

### Step 3: Test the syntax
```bash
node -c src/events/interactionCreate.js
node -c src/utils/permissions.js
node -c deploy_zentro_linked_role.js
```

### Step 4: Test bot permissions (recommended)
```bash
# This will check if the bot has the right permissions for role management
node test_bot_permissions.js
```

### Step 5: Deploy to existing players (optional)
```bash
# This will add the ZentroLinked role to all existing linked players
node deploy_zentro_linked_role.js
```

### Step 6: Restart the bot
```bash
# If using PM2
pm2 restart zentro-bot

# Or if using systemd
sudo systemctl restart zentro-bot

# Or if running directly
# Stop the current process and restart with:
node src/index.js
```

## What Happens Now

### For New Players:
1. When a player uses `/link <ign>`, they get:
   - Their Discord nickname changed to `<ign> 🔗`
   - The orange "ZentroLinked" role added
   - A success message mentioning the new role

### For Existing Players:
- Run the deployment script to add the role to all existing linked players
- The script will create the role if it doesn't exist
- It will skip players who already have the role

## Testing
1. Try the `/link` command with a new player
2. Check that they get the orange ZentroLinked role
3. Verify the success message mentions the role

## Troubleshooting
- If the bot doesn't have permission to manage roles, it will log an error but continue
- If the bot doesn't have permission to manage nicknames, it will log an error but continue
- The linking process won't fail if role/nickname management fails
