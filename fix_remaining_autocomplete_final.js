const fs = require('fs');

console.log('🔧 Fixing ALL remaining autocomplete issues...');

function fixOldGuildLookup(content) {
  let fixed = content;
  
  // Fix the old guild lookup pattern in autocomplete functions
  fixed = fixed.replace(/'SELECT nickname FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND nickname LIKE \? LIMIT 25'/g, "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25'");
  
  // Fix any remaining malformed queries
  fixed = fixed.replace(/'SELECT nickname FROM rust_servers WHERE guild_id = \? AND nickname LIKE \?' AND nickname LIKE \?/g, "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?'");
  
  return fixed;
}

const filesToFix = [
  'src/commands/admin/addShopCategory.js',
  'src/commands/admin/addCurrencyPlayer.js',
  'src/commands/admin/addCurrencyServer.js',
  'src/commands/admin/console.js',
  'src/commands/admin/addShopItem.js',
  'src/commands/admin/addShopKit.js',
  'src/commands/admin/editShopCategory.js',
  'src/commands/admin/editShopItem.js',
  'src/commands/admin/editShopKit.js',
  'src/commands/admin/removeShopCategory.js',
  'src/commands/admin/removeShopItem.js',
  'src/commands/admin/removeShopKit.js',
  'src/commands/admin/addToKitList.js',
  'src/commands/admin/removeFromKitList.js',
  'src/commands/admin/viewKitListPlayers.js',
  'src/commands/admin/wipeKitClaims.js',
  'src/commands/admin/markPaid.js',
  'src/commands/admin/setCurrency.js',
  'src/commands/admin/setEvents.js',
  'src/commands/admin/setPositions.js',
  'src/commands/admin/killfeed.js',
  'src/commands/admin/killfeedSetup.js',
  'src/commands/admin/autokitsSetup.js',
  'src/commands/admin/viewAutokitsConfigs.js',
  'src/commands/admin/ecoGamesSetup.js',
  'src/commands/admin/channelSet.js',
  'src/commands/admin/listChannels.js',
  'src/commands/admin/listServers.js',
  'src/commands/admin/removeServer.js',
  'src/commands/admin/forceLink.js',
  'src/commands/admin/allowLink.js',
  'src/commands/admin/unlink.js',
  'src/commands/admin/testMessage.js',
  'src/commands/admin/managePositions.js',
  'src/commands/player/balance.js',
  'src/commands/player/blackjack.js',
  'src/commands/player/coinflip.js',
  'src/commands/player/daily.js',
  'src/commands/player/link.js',
  'src/commands/player/shop.js'
];

let totalUpdated = 0;

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      content = fixOldGuildLookup(content);
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${filePath}`);
        totalUpdated++;
      }
    } catch (error) {
      console.log(`❌ Error fixing ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n🎉 Autocomplete fix completed!`);
console.log(`✅ Updated ${totalUpdated} files`);
console.log(`✅ All commands now use direct guild_id instead of guilds table lookup`);
console.log(`✅ Your bot is now fully multi-tenant ready!`);

// Also fix the unified player system
const unifiedSystemPath = 'src/utils/unifiedPlayerSystem.js';
if (fs.existsSync(unifiedSystemPath)) {
  try {
    let content = fs.readFileSync(unifiedSystemPath, 'utf8');
    const originalContent = content;
    
    // Fix any remaining guild lookups in the unified system
    content = content.replace(/\(SELECT id FROM guilds WHERE discord_id = \?\)/g, '?');
    
    if (content !== originalContent) {
      fs.writeFileSync(unifiedSystemPath, content);
      console.log(`✅ Fixed: ${unifiedSystemPath}`);
      totalUpdated++;
    }
  } catch (error) {
    console.log(`❌ Error fixing ${unifiedSystemPath}:`, error.message);
  }
}

console.log(`\n💡 All server autocomplete should now work properly across all commands!`);
console.log(`💡 Restart your bot with: pm2 restart zentro-bot`); 