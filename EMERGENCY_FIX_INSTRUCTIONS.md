# 🚨 Emergency Fix Instructions

## What This Script Does

This script will fix all the player linking issues between DeadOps and USA-DeadOps servers:

1. **Links all players** - If someone is on DeadOps, they'll be linked to USA-DeadOps and vice versa
2. **Creates economy tables** - Ensures all players have economy records (preserves existing currency)
3. **Implements permanent fix** - Prevents this from happening again when new servers are added

## How to Run

### 1. Make sure you have the required packages
```bash
npm install mysql2 dotenv
```

### 2. Check your .env file has these variables:
```
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=3306
```

### 3. Run the script
```bash
node emergency_fix_all_servers.js
```

## What Happens

The script will:
- Find both DeadOps and USA-DeadOps servers
- Link all players between both servers
- Create economy tables for any missing players
- Set up automatic linking for future servers
- Verify everything is working

## After Running

✅ All players will be linked to both servers  
✅ All players will have economy tables  
✅ Players can use `/swap` between servers  
✅ This won't happen again with new servers  

## If Something Goes Wrong

The script will show detailed error messages. Common issues:
- Database connection problems (check .env file)
- Missing permissions (make sure your DB user has CREATE/INSERT/UPDATE permissions)
- Server names don't match exactly (should be "Dead-ops" and "USA-DeadOps")

## Support

If you get errors, the script will show exactly what went wrong. Run it and let me know what error messages you see.
