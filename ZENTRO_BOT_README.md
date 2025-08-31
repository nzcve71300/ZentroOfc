# Zentro Bot - Complete Rust Server Management Solution

## Overview

Zentro Bot is a comprehensive Discord bot designed specifically for Rust server management, offering an extensive suite of features that streamline server administration and enhance player experience. With over 78 commands spanning economy systems, teleportation, clan management, automated kits, and real-time server monitoring, Zentro Bot transforms your Discord server into a powerful Rust server management hub.

## Key Features

### 🎮 **Multi-Server Support**
- Manage up to 10 Rust servers from a single Discord server
- Independent configurations for each server
- Seamless server switching and management

### 💰 **Advanced Economy System**
- Custom currency with server-specific configurations
- Casino games (Blackjack, Coinflip) with configurable limits
- Daily rewards, kill rewards, and bounty systems
- Player balance management and transfers

### 🏠 **Teleportation System**
- 8-directional teleportation (North, Northeast, East, Southeast, South, Southwest, West, Northwest)
- Configurable cooldowns, delays, and kit integration
- Home teleportation with automatic setup
- Book-a-Ride system for vehicle teleportation

### ⚔️ **Clan Management**
- Complete clan system with roles and permissions
- Clan creation, editing, invitations, and management
- Clan leaderboards and statistics

### 🎯 **Automated Systems**
- Smart kit distribution with cooldowns and authorization
- Real-time killfeed with customizable formats
- Event notifications (Bradley, Helicopter)
- Automated player feeds and admin notifications

### 📊 **Analytics & Monitoring**
- Real-time server status monitoring
- Player statistics and leaderboards
- Server performance tracking
- Comprehensive logging and debugging

---

## Admin Commands

### 🛠️ **Server Management**

#### `/setup-command`
**Purpose:** Initial server setup and configuration
**Usage:** Configure your first Rust server with the bot
**Features:**
- Server connection setup (IP, port, RCON password)
- Guild association
- Initial database configuration
- Channel setup for feeds and notifications

#### `/add-server`
**Purpose:** Add additional Rust servers to your Discord
**Usage:** Expand your bot to manage multiple servers
**Features:**
- Server registration with unique identifiers
- Automatic guild association
- Independent configuration management

#### `/remove-server`
**Purpose:** Remove servers from bot management
**Usage:** Clean up unused or decommissioned servers
**Features:**
- Safe server removal with data cleanup
- Configuration preservation options
- Channel cleanup

#### `/change-server`
**Purpose:** Modify existing server configurations
**Usage:** Update server details without removing and re-adding
**Features:**
- IP/port updates
- RCON password changes
- Server nickname modifications

#### `/list-servers`
**Purpose:** View all configured servers
**Usage:** Get an overview of all managed servers
**Features:**
- Server status overview
- Configuration summary
- Quick access to server management

### ⚙️ **Configuration System**

#### `/set` (Comprehensive Configuration Command)
**Purpose:** Master configuration command for all server settings
**Usage:** Configure economy, teleports, events, and more

**Economy Configurations:**
- `BLACKJACK-TOGGLE` - Enable/disable blackjack game
- `COINFLIP-TOGGLE` - Enable/disable coinflip game
- `DAILY-AMOUNT` - Set daily reward amount
- `STARTING-BALANCE` - Set new player starting balance
- `PLAYERKILLS-AMOUNT` - Set player kill rewards
- `MISCKILLS-AMOUNT` - Set scientist kill rewards
- `BOUNTY-TOGGLE` - Enable/disable bounty system
- `BOUNTY-REWARDS` - Set bounty reward amounts
- `BLACKJACK-MIN/MAX` - Set betting limits
- `COINFLIP-MIN/MAX` - Set betting limits

**Killfeed Configurations:**
- `KILLFEEDGAME` - Enable/disable custom killfeed
- `KILLFEED-SETUP` - Set killfeed format string
- `KILLFEED-RANDOMIZER` - Enable/disable kill phrase randomizer

**Teleport Configurations:**
- `TPN-USE` through `TPNW-USE` - Enable/disable teleports
- `TPN-TIME` through `TPNW-TIME` - Set cooldowns
- `TPN-DELAYTIME` through `TPNW-DELAYTIME` - Set delays
- `TPN-NAME` through `TPNW-NAME` - Set display names
- `TPN-COORDINATES` through `TPNW-COORDINATES` - Set locations
- `TPN-USE-KIT` through `TPNW-USE-KIT` - Enable kit integration
- `TPN-KITNAME` through `TPNW-KITNAME` - Set kit names

**Event Configurations:**
- `BRADLEY-SCOUT` - Enable/disable Bradley notifications
- `BRADLEY-KILLMSG` - Set Bradley kill message
- `BRADLEY-RESPAWNMSG` - Set Bradley respawn message
- `HELICOPTER-SCOUT` - Enable/disable Helicopter notifications
- `HELICOPTER-KILLMSG` - Set Helicopter kill message
- `HELICOPTER-RESPAWNMSG` - Set Helicopter respawn message

**Book-a-Ride Configurations:**
- `BAR-USE` - Enable/disable Book-a-Ride system
- `BAR-COOLDOWN` - Set cooldown in minutes

#### `/channel-set`
**Purpose:** Configure Discord channels for various feeds
**Usage:** Set up channels for notifications and feeds
**Features:**
- Admin feed channels
- Player feed channels
- Killfeed channels
- Note feed channels
- Player count Voice channels
- Zorp feed channels
- Event feed channels

#### `/set-currency`
**Purpose:** Configure server-specific currency
**Usage:** Set currency name and symbol for each server
**Features:**
- Custom currency names
- Currency symbols
- Server-specific configurations

#### `/set-scheduler`
**Purpose:** Configure automated message scheduling
**Usage:** Set up recurring messages and announcements
**Features:**
- Scheduled announcements
- Automated reminders
- Custom message timing

### 💰 **Economy Management**

#### `/add-currency-server`
**Purpose:** Add currency to all players on a server
**Usage:** Server-wide currency distribution
**Features:**
- Bulk currency addition
- Server-specific targeting
- Transaction logging

#### `/add-currency-player`
**Purpose:** Add currency to specific players
**Usage:** Individual player currency management
**Features:**
- Targeted currency addition
- Player-specific transactions
- Balance verification

#### `/remove-currency-server`
**Purpose:** Remove currency from all players on a server
**Usage:** Server-wide currency reduction
**Features:**
- Bulk currency removal
- Safety confirmations
- Transaction logging

#### `/remove-currency-player`
**Purpose:** Remove currency from specific players
**Usage:** Individual player currency reduction
**Features:**
- Targeted currency removal
- Player-specific transactions
- Balance verification

#### `/view-balance`
**Purpose:** View player balances
**Usage:** Check individual or server-wide balances
**Features:**
- Individual player balance lookup
- Server-wide balance overview
- Balance history

#### `/top-balances`
**Purpose:** View richest players
**Usage:** Display wealth leaderboards
**Features:**
- Server-specific rankings
- Global rankings
- Balance thresholds

### 🎮 **Kit Management**

#### `/autokits-setup`
**Purpose:** Configure automated kit systems
**Usage:** Set up automatic kit distribution
**Features:**
- Kit cooldown configuration
- Authorization settings
- Server-specific setups

#### `/add-to-kit-list`
**Purpose:** Add players to kit authorization lists
**Usage:** Grant kit access to specific players
**Features:**
- Individual player authorization
- Kit-specific permissions
- Temporary or permanent access

#### `/remove-from-kit-list`
**Purpose:** Remove players from kit authorization lists
**Usage:** Revoke kit access from specific players
**Features:**
- Individual player removal
- Kit-specific permissions
- Access verification

#### `/view-kit-list-players`
**Purpose:** View authorized players for kits
**Usage:** Check kit authorization status
**Features:**
- Kit-specific player lists
- Authorization status
- Player management overview

#### `/view-autokits-configs`
**Purpose:** View autokit configurations
**Usage:** Check current autokit settings
**Features:**
- Configuration overview
- Cooldown settings
- Authorization status

#### `/wipe-kit-claims`
**Purpose:** Reset kit claim cooldowns
**Usage:** Clear all kit claim timers
**Features:**
- Server-wide cooldown reset
- Individual player reset
- Cooldown verification

### 🏪 **Shop Management**

#### `/add-shop-category`
**Purpose:** Create shop categories
**Usage:** Organize shop items into categories
**Features:**
- Category creation
- Description management
- Server-specific categories

#### `/add-shop-item`
**Purpose:** Add items to the shop
**Usage:** Create purchasable items
**Features:**
- Item pricing
- Category assignment
- Description management

#### `/add-shop-kit`
**Purpose:** Add kits to the shop
**Usage:** Create purchasable kits
**Features:**
- Kit pricing
- Category assignment
- Kit description

#### `/edit-shop-category`
**Purpose:** Modify shop categories
**Usage:** Update category information
**Features:**
- Name updates
- Description changes
- Category reorganization

#### `/edit-shop-item`
**Purpose:** Modify shop items
**Usage:** Update item information and pricing
**Features:**
- Price updates
- Description changes
- Category reassignment

#### `/edit-shop-kit`
**Purpose:** Modify shop kits
**Usage:** Update kit information and pricing
**Features:**
- Price updates
- Description changes
- Category reassignment

#### `/remove-shop-category`
**Purpose:** Remove shop categories
**Usage:** Delete unused categories
**Features:**
- Safe category removal
- Item reassignment options
- Confirmation prompts

#### `/remove-shop-item`
**Purpose:** Remove shop items
**Usage:** Delete items from shop
**Features:**
- Item removal
- Inventory cleanup
- Confirmation prompts

#### `/remove-shop-kit`
**Purpose:** Remove shop kits
**Usage:** Delete kits from shop
**Features:**
- Kit removal
- Authorization cleanup
- Confirmation prompts

#### `/open-shop`
**Purpose:** Open the shop interface
**Usage:** Access shop management
**Features:**
- Shop overview
- Item management
- Category navigation

### 👥 **Player Management**



#### `/unlink`
**Purpose:** Unlink player accounts
**Usage:** Remove account associations
**Features:**
- Safe account unlinking
- Data preservation options
- Confirmation prompts

#### `/allow-link`
**Purpose:** Enable/disable account linking
**Usage:** Control player linking permissions
**Features:**
- Server-wide linking control
- Individual player permissions
- Link status management

#### `/add-player-whitelist`
**Purpose:** Add players to whitelist
**Usage:** Grant special permissions
**Features:**
- Individual whitelist addition
- Permission management
- Whitelist verification

#### `/remove-player-whitelist`
**Purpose:** Remove players from whitelist
**Usage:** Revoke special permissions
**Features:**
- Individual whitelist removal
- Permission revocation
- Confirmation prompts

#### `/view-whitelist-players`
**Purpose:** View whitelisted players
**Usage:** Check whitelist status
**Features:**
- Whitelist overview
- Player status
- Permission management

### 📊 **Statistics & Analytics**

#### `/leaderboard`
**Purpose:** View player leaderboards
**Usage:** Display player rankings
**Features:**
- Multiple ranking categories
- Server-specific rankings
- Global rankings

#### `/servers-leaderboard`
**Purpose:** View server leaderboards
**Usage:** Compare server statistics
**Features:**
- Server performance metrics
- Player count rankings
- Activity comparisons

#### `/clear-stats`
**Purpose:** Clear player statistics
**Usage:** Reset player data
**Features:**
- Individual player reset
- Server-wide reset
- Selective data clearing

#### `/test-leaderboard`
**Purpose:** Test leaderboard functionality
**Usage:** Verify leaderboard systems
**Features:**
- System testing
- Data verification
- Performance monitoring

### 🎯 **Event Management**

#### `/view-events`
**Purpose:** View event configurations
**Usage:** Check event settings
**Features:**
- Event status overview
- Configuration verification
- Event management

#### `/vote-skip-night`
**Purpose:** Initiate night skip voting
**Usage:** Allow players to vote for night skip
**Features:**
- Voting system
- Threshold management
- Automatic execution

### 🏠 **Home Teleportation**

#### `/setup-home-tp`
**Purpose:** Configure home teleportation
**Usage:** Set up player home teleports
**Features:**
- Home location setup
- Teleport configuration
- Player management

### 🎲 **Playtime Rewards**

#### `/playtime-rewards`
**Purpose:** Configure playtime-based rewards
**Usage:** Set up automatic playtime rewards
**Features:**
- Time-based rewards
- Reward thresholds
- Automatic distribution

### 📱 **Communication**

#### `/console`
**Purpose:** Send console commands
**Usage:** Execute server commands
**Features:**
- RCON command execution
- Server management
- Command logging

#### `/test-message`
**Purpose:** Test message systems
**Usage:** Verify communication channels
**Features:**
- Channel testing
- Message verification
- System diagnostics

#### `/test-modal`
**Purpose:** Test modal interfaces
**Usage:** Verify UI components
**Features:**
- Interface testing
- Component verification
- User experience testing

### 🗺️ **Zorp Zone Management**

#### `/edit-zorp`
**Purpose:** Configure Zorp zones
**Usage:** Set up zone-based systems
**Features:**
- Zone configuration
- Area management
- System integration

#### `/list-zones`
**Purpose:** View configured zones
**Usage:** Check zone status
**Features:**
- Zone overview
- Configuration status
- Area management

#### `/wipe-zorps`
**Purpose:** Reset Zorp configurations
**Usage:** Clear zone settings
**Features:**
- Configuration reset
- Data cleanup
- System restart

#### `/delete-zorp`
**Purpose:** Remove specific Zorp zones
**Usage:** Delete individual zones
**Features:**
- Zone removal
- Configuration cleanup
- Confirmation prompts

### 📍 **Position Management**

#### `/manage-positions`
**Purpose:** Manage teleport positions
**Usage:** Configure teleport locations
**Features:**
- Position setting
- Coordinate management
- Location verification

### 📋 **List Management**

#### `/add-to-list`
**Purpose:** Add items to various lists
**Usage:** Manage player lists
**Features:**
- List management
- Item addition
- List verification

### 🏛️ **Clan Administration**

#### `/setup-clan`
**Purpose:** Configure clan system
**Usage:** Set up clan management
**Features:**
- Clan system setup
- Permission configuration
- Role management

#### `/list-clans`
**Purpose:** View all clans
**Usage:** Check clan status
**Features:**
- Clan overview
- Member management
- Statistics display

#### `/purge-clans`
**Purpose:** Remove all clans
**Usage:** Reset clan system
**Features:**
- Complete clan removal
- Data cleanup
- System reset

### 📈 **Status Monitoring**

#### `/status`
**Purpose:** View detailed server status
**Usage:** Monitor server performance
**Features:**
- Real-time monitoring
- Performance metrics
- Health indicators

#### `/status-simple`
**Purpose:** View simplified server status
**Usage:** Quick server check
**Features:**
- Basic status overview
- Quick health check
- Performance summary

### 🔗 **Nivaro Integration**

#### `/nivaro-link` (Coming Soon)
**Purpose:** Link Nivaro store accounts
**Usage:** Connect store systems
**Features:**
- Store integration
- Account linking
- Purchase verification

### 💳 **Payment Management**

#### `/mark-paid`
**Purpose:** Mark payments as completed
**Usage:** Process payment confirmations
**Features:**
- Payment verification
- Transaction processing
- Receipt generation

---

## Player Commands

### 💰 **Economy & Gaming**

#### `/balance`
**Purpose:** Check your currency balance
**Usage:** View your current balance across all servers
**Features:**
- Multi-server balance display
- Currency conversion
- Balance history

#### `/daily`
**Purpose:** Claim daily rewards
**Usage:** Collect your daily currency bonus
**Features:**
- Daily reward system
- Cooldown management
- Reward tracking

#### `/blackjack`
**Purpose:** Play blackjack with your currency
**Usage:** Bet and play against the house
**Features:**
- Interactive blackjack game
- Configurable betting limits
- Win/loss tracking

#### `/coinflip`
**Purpose:** Play coinflip with your currency
**Usage:** Simple 50/50 betting game
**Features:**
- Quick betting game
- Configurable limits
- Instant results

#### `/transfer`
**Purpose:** Transfer currency to other players
**Usage:** Send money to friends or clan members
**Features:**
- Player-to-player transfers
- Transaction verification
- Transfer limits

#### `/swap`
**Purpose:** Swap currency between servers
**Usage:** Move money between different Rust servers
**Features:**
- Cross-server transfers
- Exchange rates
- Transfer verification

### 🏪 **Shopping**

#### `/shop`
**Purpose:** Access the server shop
**Usage:** Browse and purchase items
**Features:**
- Item browsing
- Category navigation
- Purchase system

### 👤 **Account Management**

#### `/link`
**Purpose:** Link your Discord to your in-game account
**Usage:** Connect your Discord account to your Rust character
**Features:**
- Account association
- Verification system
- Link confirmation

#### `/profile`
**Purpose:** View your player profile
**Usage:** Check your statistics and information
**Features:**
- Player statistics
- Balance overview
- Achievement tracking

### 🏛️ **Clan System**

#### `/clan-create`
**Purpose:** Create a new clan
**Usage:** Start your own clan
**Features:**
- Clan creation
- Name and description setup
- Leader assignment

#### `/clan-view`
**Purpose:** View clan information
**Usage:** Check clan details and members
**Features:**
- Clan overview
- Member list
- Statistics display

#### `/clan-edit`
**Purpose:** Edit clan information
**Usage:** Modify clan details (leaders only)
**Features:**
- Name changes
- Description updates
- Settings modification

#### `/clan-invite`
**Purpose:** Invite players to your clan
**Usage:** Add new members to your clan
**Features:**
- Player invitations
- Role assignment
- Invitation management

#### `/clan-kick`
**Purpose:** Remove players from your clan
**Usage:** Kick members from your clan
**Features:**
- Member removal
- Role management
- Confirmation prompts

#### `/clan-promote`
**Purpose:** Promote clan members
**Usage:** Give members higher roles
**Features:**
- Role promotion
- Permission management
- Hierarchy system

#### `/clan-leave`
**Purpose:** Leave your current clan
**Usage:** Exit your clan membership
**Features:**
- Safe clan exit
- Role cleanup
- Confirmation prompts

#### `/clan-delete`
**Purpose:** Delete your clan
**Usage:** Disband your clan (leaders only)
**Features:**
- Clan deletion
- Member notification
- Data cleanup

---

## Technical Features

### 🔧 **Advanced Systems**

#### **Real-time RCON Integration**
- Direct server communication
- Instant command execution
- Live server monitoring


#### **Automated Logging**
- Comprehensive activity logs
- Error tracking
- Performance monitoring

#### **Scalable Architecture**
- Multi-server support
- Load balancing ready
- Performance optimization

### 🛡️ **Security Features**

#### **Permission System**
- Role-based access control
- Admin permission verification
- Secure command execution

#### **Data Protection**
- Encrypted connections
- Secure data storage
- Privacy compliance

#### **Anti-Abuse Systems**
- Rate limiting
- Cooldown management


#### **Real-time Statistics**
- Player activity tracking
- Server performance metrics
- Economic analytics


---

## Support & Maintenance

### **24/7 Support**
- Comprehensive documentation
- Active developer
- Community support channels in the discord.

### **Regular Updates**
- Feature enhancements
- Bug fixes
- Security updates
- Performance improvements


---

## Why Choose Zentro Bot?

### **Comprehensive Solution**
Zentro Bot isn't just another Discord bot - it's a complete Rust server management platform. With over 78 commands covering every aspect of server administration, from economy management to player engagement, Zentro Bot provides everything you need to run a successful Rust server.

### **Professional Quality**
Built with enterprise-grade technology, Zentro Bot offers reliability, scalability, and performance. The advanced design ensures easy maintenance and future expansion, while the comprehensive feature set reduces the need for super active admins, simply monitor anything and anyone from your discord.

### **Player Experience**
Beyond administration, Zentro Bot enhances player experience with engaging features like casino games, clan systems, and automated rewards. The intuitive interface and seamless integration make it easy for players to engage with your server.

### **Cost Effective**
Zentro Bot provides everything in one comprehensive solution. The time saved on administration and the increased player engagement more than justify the investment.

### **Future Proof**
With active development and regular updates, Zentro Bot continues to evolve with the latest Discord and Rust features. The advanced system design ensures easy updates and customizations as your server grows.

---

**Transform your Rust server management with Zentro Bot - the complete solution for modern Rust server administration.**
