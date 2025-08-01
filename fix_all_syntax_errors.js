const fs = require('fs');

console.log('🔧 Fixing ALL syntax errors in autocomplete queries...');

// Function to fix malformed queries
function fixMalformedQuery(content) {
  // Fix the specific malformed pattern
  return content.replace(
    /'SELECT nickname FROM rust_servers WHERE guild_id = \? AND nickname LIKE \?' AND nickname LIKE \? LIMIT 25'/g,
    "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25'"
  );
}

// List of all command files that might have this issue
const filesToCheck = [
  'src/commands/admin/addCurrencyPlayer.js',
  'src/commands/admin/addCurrencyServer.js',
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
  'src/commands/admin/setPositions.js',
  'src/commands/player/blackjack.js',
  'src/commands/player/shop.js'
];

let fixedCount = 0;

filesToCheck.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Fix malformed queries
      content = fixMalformedQuery(content);
      
      // If content changed, write it back
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed ${filePath}`);
        fixedCount++;
      } else {
        console.log(`ℹ️ No changes needed for ${filePath}`);
      }
    } else {
      console.log(`⚠️ File not found: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
});

console.log(`\n🎉 Syntax error fix completed!`);
console.log(`✅ Fixed ${fixedCount} files`);
console.log(`✅ All malformed queries should now be fixed!`); 