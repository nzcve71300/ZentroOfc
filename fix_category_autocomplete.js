const fs = require('fs');

console.log('🔧 Fixing category autocomplete functions...');

// Function to fix category autocomplete queries
function fixCategoryAutocomplete(content) {
  let fixed = content;
  
  // Fix the old pattern: JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ?
  fixed = fixed.replace(
    /JOIN guilds g ON rs\.guild_id = g\.id WHERE g\.discord_id = \?/g,
    'WHERE rs.guild_id = ?'
  );
  
  // Fix server autocomplete
  fixed = fixed.replace(
    /'SELECT nickname FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g,
    "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?'"
  );
  
  return fixed;
}

// List of files that might have category autocomplete
const filesToCheck = [
  'src/commands/admin/addShopItem.js',
  'src/commands/admin/editShopItem.js',
  'src/commands/admin/removeShopItem.js',
  'src/commands/admin/addShopKit.js',
  'src/commands/admin/editShopKit.js',
  'src/commands/admin/removeShopKit.js',
  'src/commands/admin/editShopCategory.js',
  'src/commands/admin/removeShopCategory.js'
];

let fixedCount = 0;

filesToCheck.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Check if file has autocomplete and old guild lookup
      if (content.includes('autocomplete') && (content.includes('JOIN guilds') || content.includes('SELECT id FROM guilds'))) {
        console.log(`🔧 Fixing ${filePath}...`);
        
        // Fix category autocomplete
        content = fixCategoryAutocomplete(content);
        
        // If content changed, write it back
        if (content !== originalContent) {
          fs.writeFileSync(filePath, content);
          console.log(`✅ Fixed ${filePath}`);
          fixedCount++;
        } else {
          console.log(`ℹ️ No changes needed for ${filePath}`);
        }
      } else {
        console.log(`ℹ️ Skipping ${filePath} (no autocomplete or already fixed)`);
      }
    } else {
      console.log(`⚠️ File not found: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
});

console.log(`\n🎉 Category autocomplete fix completed!`);
console.log(`✅ Fixed ${fixedCount} files`);
console.log(`✅ Category autocomplete should now work properly!`); 