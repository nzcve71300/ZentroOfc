# 🗄️ Database Configuration - CRITICAL REQUIREMENT

## ⚠️ CRITICAL: Website MUST Use Same Database as Discord Bot

**The website API MUST ALWAYS use the exact same database as the Discord bot. This is non-negotiable for data consistency and system integrity.**

## ✅ Current Configuration (Verified)

### Environment Variables
All components use the same environment variables for database connection:

```env
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=3306
```

### Components Using Shared Database

1. **Discord Bot** (`src/config.js`, `src/db/index.js`)
2. **Website API** (`src/api/unified-api.js`)
3. **All API Routes** (`src/api/routes/*.js`)
4. **Admin Commands** (`src/commands/admin/*.js`)
5. **Utility Systems** (`src/utils/*.js`)

### Database Connection Pattern

```javascript
// ✅ CORRECT: Use shared database connection
const pool = require('../../db/index');

// ❌ WRONG: Create separate database connection
const pool = mysql.createPool({...});
```

## 🔍 Verification

Run the verification script to ensure database consistency:

```bash
node verify-database-config.js
```

## 🚨 Why This Is Critical

1. **Data Consistency**: Both systems must see the same data
2. **No Conflicts**: Prevents data corruption from multiple connections
3. **Real-time Sync**: Changes in Discord bot immediately visible in website
4. **Single Source of Truth**: One database, one configuration

## 📋 Implementation Checklist

- [x] All API routes use `require('../../db/index')`
- [x] Discord bot uses `src/config.js` configuration
- [x] Website API uses shared database pool
- [x] Environment variables are consistent
- [x] No hardcoded database credentials
- [x] All components use same `.env` file

## 🛡️ Security Notes

- Database credentials are stored in `.env` file
- Never commit `.env` to version control
- Use environment variables for all database connections
- No hardcoded credentials in source code

## 🔄 Maintenance

When adding new components:

1. **ALWAYS** use `require('../../db/index')` for database access
2. **NEVER** create new database connections
3. **ALWAYS** use environment variables for configuration
4. **ALWAYS** test with verification script

---

**Remember: The website is a VIEW of the Discord bot's data, not a separate system!**
