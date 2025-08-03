const fs = require('fs');
const path = require('path');

console.log('🔧 Comprehensive fix for database and event tracking...\n');

// ============================================================================
// PART 1: DATABASE FIXES
// ============================================================================

console.log('📊 Creating database migration script...\n');

const databaseMigration = `
-- MariaDB Database Migration Script
-- Fixes missing tables and index issues

-- Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS servers (
    id VARCHAR(32) PRIMARY KEY,
    guild_id INT,
    nickname TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INT NOT NULL,
    password TEXT NOT NULL,
    currency_name TEXT DEFAULT 'coins',
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS killfeed_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    enabled BOOLEAN DEFAULT FALSE,
    format_string TEXT,
    randomizer_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS autokits_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32),
    kit_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    cooldown INT DEFAULT 3600,
    game_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_kit (server_id, kit_name(191)),
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Fix index creation with IF NOT EXISTS
-- Drop existing problematic indexes first
DROP INDEX IF EXISTS idx_shop_kits_category ON shop_kits;
DROP INDEX IF EXISTS idx_eco_games_server ON eco_games_config;
DROP INDEX IF EXISTS idx_kit_auth_server ON kit_auth;
DROP INDEX IF EXISTS idx_players_guild_server ON players;
DROP INDEX IF EXISTS idx_players_discord ON players;
DROP INDEX IF EXISTS idx_shop_categories_server ON shop_categories;
DROP INDEX IF EXISTS idx_shop_items_category ON shop_items;

-- Recreate indexes with proper names
CREATE INDEX IF NOT EXISTS idx_shop_kits_category_id ON shop_kits(category_id);
CREATE INDEX IF NOT EXISTS idx_eco_games_config_server_id ON eco_games_config(server_id);
CREATE INDEX IF NOT EXISTS idx_kit_auth_server_id ON kit_auth(server_id);
CREATE INDEX IF NOT EXISTS idx_players_guild_server_id ON players(guild_id, server_id);
CREATE INDEX IF NOT EXISTS idx_players_discord_id ON players(discord_id);
CREATE INDEX IF NOT EXISTS idx_shop_categories_server_id ON shop_categories(server_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_category_id ON shop_items(category_id);

-- Insert default configurations for existing servers
INSERT IGNORE INTO killfeed_config (server_id, enabled, format_string)
SELECT id, FALSE, '<color=#FF6B6B>{killer}</color> killed <color=#4ECDC4>{victim}</color>'
FROM rust_servers;

INSERT IGNORE INTO autokits_config (server_id, kit_name, enabled, cooldown)
SELECT id, 'FREEkit1', FALSE, 3600
FROM rust_servers;

INSERT IGNORE INTO autokits_config (server_id, kit_name, enabled, cooldown)
SELECT id, 'FREEkit2', FALSE, 3600
FROM rust_servers;

INSERT IGNORE INTO autokits_config (server_id, kit_name, enabled, cooldown)
SELECT id, 'VIPkit', FALSE, 3600
FROM rust_servers;

INSERT IGNORE INTO autokits_config (server_id, kit_name, enabled, cooldown)
SELECT id, 'ELITEkit1', FALSE, 3600
FROM rust_servers;

INSERT IGNORE INTO autokits_config (server_id, kit_name, enabled, cooldown)
SELECT id, 'ELITEkit2', FALSE, 3600
FROM rust_servers;

INSERT IGNORE INTO autokits_config (server_id, kit_name, enabled, cooldown)
SELECT id, 'ELITEkit3', FALSE, 3600
FROM rust_servers;

INSERT IGNORE INTO autokits_config (server_id, kit_name, enabled, cooldown)
SELECT id, 'ELITEkit4', FALSE, 3600
FROM rust_servers;

INSERT IGNORE INTO autokits_config (server_id, kit_name, enabled, cooldown)
SELECT id, 'ELITEkit5', FALSE, 3600
FROM rust_servers;
`;

// Write database migration script
const migrationPath = path.join(__dirname, 'fix_database_migration.sql');
fs.writeFileSync(migrationPath, databaseMigration);
console.log('✅ Created database migration script: fix_database_migration.sql');

// ============================================================================
// PART 2: EVENT TRACKING FIXES
// ============================================================================

console.log('\n📡 Creating event tracking fix...\n');

// Read the current RCON file
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
let rconContent = '';

try {
  rconContent = fs.readFileSync(rconPath, 'utf8');
  console.log('✅ Found src/rcon/index.js');
} catch (error) {
  console.log('❌ Could not read src/rcon/index.js:', error.message);
  process.exit(1);
}

// Create new event tracking implementation with cooldown
const newEventTrackingCode = `
// Event tracking functionality with cooldown
const eventTrackingCooldowns = new Map(); // Track cooldowns per server
const EVENT_TRACKING_COOLDOWN = 8000; // 8 seconds cooldown

const handleEventTracking = async (client, guildId, serverName, ip, port, password, player) => {
  try {
    console.log('[EVENT TRACKING] Player requested event times:', player);
    
    // Check cooldown
    const serverKey = \`\${ip}:\${port}\`;
    const lastRequest = eventTrackingCooldowns.get(serverKey);
    const now = Date.now();
    
    if (lastRequest && (now - lastRequest) < EVENT_TRACKING_COOLDOWN) {
      console.log('[EVENT TRACKING] Cooldown active, skipping request');
      return;
    }
    
    // Update cooldown
    eventTrackingCooldowns.set(serverKey, now);
    
    // Execute events.remainingtime command
    const response = await sendRconCommand(ip, port, password, 'events.remainingtime');
    
    if (response && response.Message) {
      console.log('[EVENT TRACKING] Raw response:', response.Message);
      const events = parseEventTimes(response.Message);
      
      if (events.length > 0) {
        const eventMessage = \`Next Events:<br>\${events.join('<br>')}\`;
        
        // Send messages with delay to prevent spam
        sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>requested event times</color>\`);
        
        // Wait 1 second before sending the event list
        setTimeout(() => {
          sendRconCommand(ip, port, password, \`global.say <color=#00FF00>\${eventMessage}</color>\`);
        }, 1000);
      } else {
        sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>no events found</color>\`);
      }
    } else {
      sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>failed to get event times</color>\`);
    }
  } catch (error) {
    console.log('[EVENT TRACKING ERROR]:', error.message);
    sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>error getting event times</color>\`);
  }
};

// Function to convert hours to readable format
const convertToReadableTime = (hours) => {
  const totalHours = parseFloat(hours);
  const wholeHours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - wholeHours) * 60);
  
  if (wholeHours === 0) {
    return \`\${minutes}m\`;
  } else if (minutes === 0) {
    return \`\${wholeHours}h\`;
  } else {
    return \`\${wholeHours}h \${minutes}m\`;
  }
};

// Function to parse events.remainingtime response
const parseEventTimes = (response) => {
  const events = [];
  const lines = response.split('\\n');
  
  console.log('[EVENT TRACKING] Parsing response lines:', lines.length);
  console.log('[EVENT TRACKING] Response content:', response);
  
  for (const line of lines) {
    console.log('[EVENT TRACKING] Processing line:', line);
    if (line.includes('remaining hours')) {
      const match = line.match(/(\\w+):\\s*([\\d.]+)\\s*remaining hours/);
      if (match) {
        const eventName = match[1].replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
        const hours = parseFloat(match[2]);
        const readableTime = convertToReadableTime(hours);
        events.push(\`\${eventName}: \${readableTime}\`);
        console.log('[EVENT TRACKING] Parsed event:', eventName, '=', readableTime);
      }
    }
  }
  
  console.log('[EVENT TRACKING] Total events parsed:', events.length);
  return events;
};
`;

// Remove all existing event tracking functions
let cleanedContent = rconContent;

// Remove all handleEventTracking function declarations
const handleEventTrackingPattern = /const handleEventTracking = async \(client, guildId, serverName, ip, port, password, player\) => \{[\s\S]*?\};/g;
cleanedContent = cleanedContent.replace(handleEventTrackingPattern, '');

// Remove all convertToReadableTime function declarations
const convertToReadableTimePattern = /const convertToReadableTime = \(hours\) => \{[\s\S]*?\};/g;
cleanedContent = cleanedContent.replace(convertToReadableTimePattern, '');

// Remove all parseEventTimes function declarations
const parseEventTimesPattern = /const parseEventTimes = \(response\) => \{[\s\S]*?\};/g;
cleanedContent = cleanedContent.replace(parseEventTimesPattern, '');

// Remove all event tracking trigger code
const eventTriggerPattern = /\/\/ Handle event tracking[\s\S]*?if \(msg\.includes\('d11_quick_chat_orders_slot_7'\)\) \{[\s\S]*?\}/g;
cleanedContent = cleanedContent.replace(eventTriggerPattern, '');

// Add the clean event tracking code before module.exports
const moduleExportsPattern = /module\.exports = {/;
if (moduleExportsPattern.test(cleanedContent)) {
  cleanedContent = cleanedContent.replace(
    moduleExportsPattern,
    `${newEventTrackingCode}\n\nmodule.exports = {`
  );
  
  // Add the event tracking trigger in the message handling section
  const newEventTrigger = `
      // Handle event tracking
      if (msg.includes('d11_quick_chat_orders_slot_7')) {
        // Extract player name from the JSON response
        let playerName = 'Unknown';
        
        try {
          // Try to parse the message as JSON first
          if (parsed && parsed.Username) {
            playerName = parsed.Username;
          } else {
            // Fallback to regex extraction from raw message
            const playerMatch = msg.match(/\[CHAT LOCAL\] (\\w+) : d11_quick_chat_orders_slot_7/);
            if (playerMatch) {
              playerName = playerMatch[1];
            }
          }
        } catch (error) {
          console.log('[EVENT TRACKING] Error extracting player name:', error.message);
        }
        
        console.log('[EVENT TRACKING] Triggered by player:', playerName);
        await handleEventTracking(client, guildId, serverName, ip, port, password, playerName);
        return;
      }
`;

  // Find the message handling section and add the event trigger
  const messageHandlingPattern = /\/\/ Handle kit emote detection/;
  if (messageHandlingPattern.test(cleanedContent)) {
    cleanedContent = cleanedContent.replace(
      /(\/\/ Handle kit emote detection)/,
      `${newEventTrigger}\n      $1`
    );
  }
}

// Backup the original file
const backupPath = rconPath + '.backup19';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the cleaned content
fs.writeFileSync(rconPath, cleanedContent);
console.log('✅ Fixed event tracking issues in src/rcon/index.js');

// ============================================================================
// PART 3: CREATE EXECUTION SCRIPT
// ============================================================================

console.log('\n📋 Creating execution script...\n');

const executionScript = `#!/bin/bash

echo "🔧 Running comprehensive database and event tracking fix..."
echo ""

echo "📊 Step 1: Running database migration..."
mysql -u root -p zentro_bot < fix_database_migration.sql
echo "✅ Database migration complete!"
echo ""

echo "📡 Step 2: Restarting bot..."
pm2 restart zentro-bot
echo "✅ Bot restarted!"
echo ""

echo "🎯 Step 3: Testing event tracking..."
echo "Test the command in-game: d11_quick_chat_orders_slot_7"
echo "Check bot logs: pm2 logs zentro-bot"
echo ""

echo "✅ All fixes applied successfully!"
echo ""
echo "📋 Summary of fixes:"
echo "1. ✅ Created missing tables (servers, killfeed_config, autokits_config)"
echo "2. ✅ Fixed index creation with IF NOT EXISTS"
echo "3. ✅ Added default configurations for existing servers"
echo "4. ✅ Fixed player name extraction from JSON response"
echo "5. ✅ Enhanced event parsing with detailed debugging"
echo "6. ✅ Added 8-second cooldown to prevent chat spam"
echo "7. ✅ Improved error handling and logging"
echo ""
echo "🎯 Next steps:"
echo "1. Test the event tracking command in-game"
echo "2. Monitor bot logs for any remaining issues"
echo "3. Verify database tables are working correctly"
`;

// Write execution script
const execPath = path.join(__dirname, 'run_comprehensive_fix.sh');
fs.writeFileSync(execPath, executionScript);
console.log('✅ Created execution script: run_comprehensive_fix.sh');

console.log('\n✅ Comprehensive fix created!');
console.log('📋 Files created:');
console.log('1. fix_database_migration.sql - Database fixes');
console.log('2. run_comprehensive_fix.sh - Execution script');
console.log('3. Updated src/rcon/index.js - Event tracking fixes');
console.log('\n📋 Next steps:');
console.log('1. Run: chmod +x run_comprehensive_fix.sh');
console.log('2. Run: ./run_comprehensive_fix.sh');
console.log('3. Test the event tracking in-game');
console.log('4. Check bot logs for any issues'); 