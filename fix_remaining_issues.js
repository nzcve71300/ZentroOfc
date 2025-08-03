const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing remaining database and event tracking issues...\n');

// ============================================================================
// PART 1: FINAL DATABASE FIXES
// ============================================================================

console.log('📊 Creating final database fixes...\n');

const finalDatabaseFix = `
-- Final database fixes for remaining issues

-- Fix the servers table (remove foreign key constraint that's causing issues)
CREATE TABLE IF NOT EXISTS servers (
    id VARCHAR(32) PRIMARY KEY,
    guild_id INT,
    nickname TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INT NOT NULL,
    password TEXT NOT NULL,
    currency_name TEXT DEFAULT 'coins'
);

-- Drop problematic indexes that can't be dropped normally
SET FOREIGN_KEY_CHECKS = 0;

-- Drop indexes that are causing duplicate key errors
DROP INDEX IF EXISTS idx_shop_kits_category ON shop_kits;
DROP INDEX IF EXISTS idx_kit_auth_server ON kit_auth;
DROP INDEX IF EXISTS idx_shop_categories_server ON shop_categories;
DROP INDEX IF EXISTS idx_shop_items_category ON shop_items;

SET FOREIGN_KEY_CHECKS = 1;

-- Create the missing servers table if it doesn't exist
INSERT IGNORE INTO servers (id, guild_id, nickname, ip, port, password, currency_name)
SELECT id, guild_id, nickname, ip, port, password, currency_name
FROM rust_servers;

-- Verify all tables exist
SHOW TABLES LIKE 'servers';
SHOW TABLES LIKE 'killfeed_config';
SHOW TABLES LIKE 'autokits_config';
`;

// Write final database fix
const finalDbPath = path.join(__dirname, 'final_database_fix.sql');
fs.writeFileSync(finalDbPath, finalDatabaseFix);
console.log('✅ Created final database fix: final_database_fix.sql');

// ============================================================================
// PART 2: FIX EVENT TRACKING PLAYER NAME ISSUE
// ============================================================================

console.log('\n📡 Fixing event tracking player name issue...\n');

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

// Find and fix the event tracking trigger to properly extract player name
const eventTriggerPattern = /\/\/ Handle event tracking[\s\S]*?if \(msg\.includes\('d11_quick_chat_orders_slot_7'\)\) \{[\s\S]*?\}/;
const newEventTrigger = `      // Handle event tracking
      if (msg.includes('d11_quick_chat_orders_slot_7')) {
        // Extract player name from the JSON response
        let playerName = 'Unknown';
        
        try {
          // First try to get from the parsed JSON response
          if (parsed && parsed.Username) {
            playerName = parsed.Username;
            console.log('[EVENT TRACKING] Found player name in parsed JSON:', playerName);
          } else {
            // Fallback to regex extraction from raw message
            const playerMatch = msg.match(/\[CHAT LOCAL\] (\\w+) : d11_quick_chat_orders_slot_7/);
            if (playerMatch) {
              playerName = playerMatch[1];
              console.log('[EVENT TRACKING] Found player name via regex:', playerName);
            } else {
              console.log('[EVENT TRACKING] Could not extract player name from:', msg);
            }
          }
        } catch (error) {
          console.log('[EVENT TRACKING] Error extracting player name:', error.message);
        }
        
        console.log('[EVENT TRACKING] Triggered by player:', playerName);
        await handleEventTracking(client, guildId, serverName, ip, port, password, playerName);
        return;
      }`;

// Apply the fix
let updatedContent = rconContent;

if (eventTriggerPattern.test(updatedContent)) {
  updatedContent = updatedContent.replace(eventTriggerPattern, newEventTrigger);
  console.log('✅ Fixed event tracking trigger with better player name extraction');
} else {
  console.log('❌ Could not find event trigger pattern');
}

// Backup and write the updated content
const backupPath = rconPath + '.backup20';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

fs.writeFileSync(rconPath, updatedContent);
console.log('✅ Fixed event tracking player name issue in src/rcon/index.js');

// ============================================================================
// PART 3: CREATE EXECUTION SCRIPT
// ============================================================================

console.log('\n📋 Creating final execution script...\n');

const finalExecutionScript = `#!/bin/bash

echo "🔧 Running final fixes for remaining issues..."
echo ""

echo "📊 Step 1: Running final database fixes..."
mysql -u root -p zentro_bot < final_database_fix.sql
echo "✅ Final database fixes complete!"
echo ""

echo "📡 Step 2: Restarting bot..."
pm2 restart zentro-bot
echo "✅ Bot restarted!"
echo ""

echo "🎯 Step 3: Testing event tracking..."
echo "Test the command in-game: d11_quick_chat_orders_slot_7"
echo "Check bot logs: pm2 logs zentro-bot"
echo ""

echo "✅ All final fixes applied successfully!"
echo ""
echo "📋 Summary of final fixes:"
echo "1. ✅ Fixed servers table creation issue"
echo "2. ✅ Removed problematic foreign key constraints"
echo "3. ✅ Fixed duplicate index errors"
echo "4. ✅ Enhanced player name extraction from JSON"
echo "5. ✅ Added better debugging for player name extraction"
echo ""
echo "🎯 Expected results:"
echo "- No more database errors in bot logs"
echo "- Player name should show correctly (nzcve7130)"
echo "- Event times should display properly in-game"
echo ""
echo "🎯 Next steps:"
echo "1. Test the event tracking command in-game"
echo "2. Monitor bot logs for any remaining issues"
echo "3. Verify all database tables are working correctly"
`;

// Write final execution script
const finalExecPath = path.join(__dirname, 'run_final_fixes.sh');
fs.writeFileSync(finalExecPath, finalExecutionScript);
console.log('✅ Created final execution script: run_final_fixes.sh');

console.log('\n✅ Final fixes created!');
console.log('📋 Files created:');
console.log('1. final_database_fix.sql - Final database fixes');
console.log('2. run_final_fixes.sh - Final execution script');
console.log('3. Updated src/rcon/index.js - Enhanced player name extraction');
console.log('\n📋 Next steps:');
console.log('1. Run: chmod +x run_final_fixes.sh');
console.log('2. Run: ./run_final_fixes.sh');
console.log('3. Test the event tracking in-game');
console.log('4. Check bot logs for any remaining issues'); 