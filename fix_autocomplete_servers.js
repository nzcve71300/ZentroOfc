const fs = require('fs');
const path = require('path');

// Function to update autocomplete queries
function updateAutocompleteQuery(oldQuery) {
  // Replace the old guild lookup with direct guild_id usage
  return oldQuery.replace(
    /WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g,
    'WHERE guild_id = ?'
  );
}

// Files that need autocomplete fixes
const filesToUpdate = [
  'src/commands/player/coinflip.js',
  'src/commands/player/blackjack.js',
  'src/commands/player/shop.js',
  'src/commands/admin/addCurrencyServer.js',
  'src/commands/admin/addCurrencyPlayer.js',
  'src/commands/admin/addShopKit.js',
  'src/commands/admin/console.js',
  'src/commands/admin/ecoGamesSetup.js',
  'src/commands/admin/edit-zorp.js',
  'src/commands/admin/channelSet.js',
  'src/commands/admin/editShopKit.js',
  'src/commands/admin/killfeed.js',
  'src/commands/admin/editShopItem.js',
  'src/commands/admin/listChannels.js',
  'src/commands/admin/managePositions.js',
  'src/commands/admin/killfeedSetup.js',
  'src/commands/admin/removeServer.js',
  'src/commands/admin/removeFromKitList.js',
  'src/commands/admin/removeShopKit.js',
  'src/commands/admin/removeShopItem.js',
  'src/commands/admin/viewEvents.js',
  'src/commands/admin/wipeKitClaims.js',
  'src/commands/admin/testMessage.js',
  'src/commands/admin/setCurrency.js',
  'src/commands/admin/setPositions.js'
];

console.log('🔧 Fixing autocomplete functions...');

filesToUpdate.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let updated = false;
      
      // Update autocomplete queries
      const oldPattern = /'SELECT.*?FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g;
      const newPattern = "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?'";
      
      if (content.includes("SELECT id FROM guilds WHERE discord_id = ?")) {
        content = content.replace(
          /'SELECT.*?FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g,
          "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?'"
        );
        
        // Update the query parameters
        content = content.replace(
          /\[guildId, `%\${focusedValue}%`\]/g,
          '[guildId, `%${focusedValue}%`]'
        );
        
        updated = true;
      }
      
      if (updated) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated ${filePath}`);
      } else {
        console.log(`ℹ️ No changes needed for ${filePath}`);
      }
    } else {
      console.log(`⚠️ File not found: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
});

// Also update the unifiedPlayerSystem.js file
const unifiedSystemPath = 'src/utils/unifiedPlayerSystem.js';
try {
  if (fs.existsSync(unifiedSystemPath)) {
    let content = fs.readFileSync(unifiedSystemPath, 'utf8');
    let updated = false;
    
    // Update getServersForGuild function
    if (content.includes("SELECT id FROM guilds WHERE discord_id = ?")) {
      content = content.replace(
        /'SELECT id, nickname FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) ORDER BY nickname'/g,
        "'SELECT id, nickname FROM rust_servers WHERE guild_id = ? ORDER BY nickname'"
      );
      
      // Update getServerByNickname function
      content = content.replace(
        /'SELECT \* FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND nickname = \?'/g,
        "'SELECT * FROM rust_servers WHERE guild_id = ? AND nickname = ?'"
      );
      
      updated = true;
    }
    
    if (updated) {
      fs.writeFileSync(unifiedSystemPath, content);
      console.log(`✅ Updated ${unifiedSystemPath}`);
    } else {
      console.log(`ℹ️ No changes needed for ${unifiedSystemPath}`);
    }
  }
} catch (error) {
  console.error(`❌ Error updating ${unifiedSystemPath}:`, error.message);
}

console.log('🎉 Autocomplete fix completed!');
console.log('💡 All autocomplete functions now use direct guild_id instead of guilds table lookup'); 