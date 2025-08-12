# New Customer Setup Checklist

## When a new customer purchases the bot:

### 1. Get Customer Information
- [ ] Discord Guild ID (right-click server → Copy Server ID)
- [ ] Discord Server Name
- [ ] Rust Server IP
- [ ] RCON Port
- [ ] RCON Password
- [ ] Desired Server Nickname

### 2. Run Setup Script
```bash
# Edit the script with customer details
nano setup_new_customer_automation.js

# Update these lines:
const newCustomerGuildId = 'CUSTOMER_GUILD_ID_HERE';
const guildName = 'CUSTOMER_SERVER_NAME_HERE';

# Run the setup
node setup_new_customer_automation.js
```

### 3. Verify Setup
- [ ] Guild appears in database
- [ ] Server is associated with correct guild
- [ ] Server appears in autocomplete
- [ ] RCON connection works

### 4. Restart Bot
```bash
pm2 restart zentro-bot
```

### 5. Test Commands
- [ ] `/setup-server` works
- [ ] Server appears in autocomplete for all commands
- [ ] RCON commands work
- [ ] Economy system works

## Common Issues & Solutions

### Issue: Server not appearing in autocomplete
**Solution:** Guild not in database or server not associated with guild
```bash
node add_new_guild_and_server.js
```

### Issue: Wrong server nickname
**Solution:** Update server nickname
```bash
node fix_server_nickname.js
```

### Issue: RCON connection fails
**Solution:** Check server credentials and test connection
```bash
node test_rcon_connection.js
```

## Quick Setup Commands

For future reference, here are the key commands:

```bash
# 1. Add new guild and server
node add_new_guild_and_server.js

# 2. Fix server nickname if needed
node fix_server_nickname.js

# 3. Test RCON connection
node test_rcon_connection.js

# 4. Restart bot
pm2 restart zentro-bot
```

## Prevention Tips

1. **Always add the Discord guild first** before adding servers
2. **Use the customer's exact server nickname** from `/setup-server`
3. **Test RCON connection** before adding to database
4. **Verify autocomplete works** after setup
5. **Keep this checklist handy** for each new customer

## Database Tables to Check

- `guilds` - Discord servers
- `rust_servers` - Rust game servers
- Check `guild_id` associations between tables 