# Command Deployment Scripts

This directory contains scripts for deploying Discord slash commands for the Zentro Bot. The scripts handle command registration efficiently, avoiding duplicates and providing detailed summaries of changes.

## 📁 Files

- `deploy-commands.js` - Global command deployment (production)
- `deploy-commands-guild.js` - Guild command deployment (testing)
- `deploy-commands.bat` - Windows batch file for global deployment
- `deploy-commands-guild.bat` - Windows batch file for guild deployment
- `package.json` - NPM scripts for easy deployment

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (version 18 or higher)
2. **Environment Variables** in `.env` file:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   TEST_GUILD_ID=your_test_guild_id_here  # For guild deployment only
   ```

### Global Deployment (Production)

Deploy commands globally to all servers where your bot is present:

```bash
# Using Node.js directly
node deploy-commands.js

# Using NPM script
npm run deploy-commands

# Using Windows batch file
deploy-commands.bat
```

### Guild Deployment (Testing)

Deploy commands to a specific guild for testing (instant updates):

```bash
# Using Node.js directly
node deploy-commands-guild.js

# Using NPM script
npm run deploy-commands-guild

# Using Windows batch file
deploy-commands-guild.bat
```

## 📊 Output Example

The scripts provide detailed output showing what changes were made:

```
🚀 ZENTRO BOT - COMMAND DEPLOYMENT

ℹ️  Loading commands from files...
ℹ️  Loaded command: koth
ℹ️  Loaded command: kothjoin
ℹ️  Loaded command: setupkoth
ℹ️  Found 45 commands in files

ℹ️  Fetching current commands from Discord...
ℹ️  Found 42 commands currently registered

🚀 CHANGES DETECTED
New commands (3):
  + koth
  + kothjoin
  + setupkoth

ℹ️  Deploying commands to Discord...
✅ Commands deployed successfully!

🚀 DEPLOYMENT SUMMARY
┌─────────────────────────────────────────┐
│                COMMAND SUMMARY           │
├─────────────────────────────────────────┤
│ New Commands:   3                       │
│   + koth                                │
│   + kothjoin                            │
│   + setupkoth                           │
├─────────────────────────────────────────┤
│ Total Commands: 45                      │
└─────────────────────────────────────────┘

ℹ️  Commands processed: 45
ℹ️  Commands unchanged: 42
✅ Commands deployed successfully!
ℹ️  Commands may take up to 1 hour to propagate globally
```

## 🔧 Features

### Smart Command Detection
- **Recursive Loading**: Automatically finds all command files in subdirectories
- **Validation**: Checks for required `data` and `execute` properties
- **Error Handling**: Gracefully handles malformed command files

### Change Detection
- **New Commands**: Commands that don't exist on Discord
- **Updated Commands**: Commands with modified properties
- **Deleted Commands**: Commands removed from files but still on Discord
- **Unchanged Commands**: Commands that remain the same

### Efficient Deployment
- **No Duplicates**: Only deploys commands that have changed
- **Batch Updates**: Updates all commands in a single API call
- **Error Recovery**: Handles API failures gracefully

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Your bot's token | ✅ Yes |
| `CLIENT_ID` | Your bot's client ID | ✅ Yes |
| `TEST_GUILD_ID` | Guild ID for testing | Guild only |

### Command Structure

Commands must be in the `src/commands/` directory with this structure:

```javascript
module.exports = {
  data: new SlashCommandBuilder()
    .setName('command-name')
    .setDescription('Command description'),
  async execute(interaction) {
    // Command logic
  }
};
```

## 🕐 Timing

### Global Commands
- **Deployment Time**: ~5-10 seconds
- **Propagation Time**: Up to 1 hour
- **Use Case**: Production deployment

### Guild Commands
- **Deployment Time**: ~2-5 seconds
- **Propagation Time**: Instant
- **Use Case**: Testing and development

## 🐛 Troubleshooting

### Common Issues

1. **"DISCORD_TOKEN is not set"**
   - Add your bot token to the `.env` file
   - Ensure the `.env` file is in the project root

2. **"CLIENT_ID is not set"**
   - Add your bot's client ID to the `.env` file
   - Find it in Discord Developer Portal > Application > General Information

3. **"TEST_GUILD_ID is not set"** (guild deployment only)
   - Add your test guild ID to the `.env` file
   - Right-click your server in Discord > Copy Server ID

4. **"Failed to deploy commands"**
   - Check your bot token is valid
   - Ensure your bot has the `applications.commands` scope
   - Verify your bot is in the target guild (for guild deployment)

### Debug Mode

For detailed debugging, you can modify the scripts to include more verbose logging:

```javascript
// Add this to see raw command data
console.log('Command data:', JSON.stringify(command, null, 2));
```

## 📝 Best Practices

1. **Test First**: Always use guild deployment for testing
2. **Version Control**: Commit command changes before deploying
3. **Backup**: Keep track of working command configurations
4. **Monitor**: Check Discord for command availability after deployment
5. **Clean Up**: Remove unused commands to avoid clutter

## 🔄 Workflow

### Development Workflow
1. Create/modify command files
2. Test with guild deployment: `npm run deploy-commands-guild`
3. Test commands in Discord
4. Deploy globally: `npm run deploy-commands`
5. Monitor for issues

### Production Workflow
1. Ensure all tests pass
2. Deploy globally: `npm run deploy-commands`
3. Wait for propagation (up to 1 hour)
4. Verify commands work across all servers

## 📞 Support

If you encounter issues with command deployment:

1. Check the troubleshooting section above
2. Verify your environment variables
3. Check Discord Developer Portal for bot permissions
4. Review the console output for specific error messages

## 🎯 KOTH Commands

The deployment scripts will automatically detect and deploy all KOTH-related commands:

- `/koth` - Main KOTH event management
- `/kothjoin` - Quick join KOTH event
- `/kothrestart` - Quick restart KOTH event
- `/kothview` - Quick view event status
- `/removekoth` - Quick remove KOTH event
- `/setupkoth` - Setup KOTH system for server
- `/startkothevent` - Start KOTH event manually
- `/teleportkoth` - Teleport player to KOTH gate

All commands are automatically loaded from the `src/commands/admin/` directory.
