const fs = require('fs');

console.log('🔧 Fixing server lookup queries in execute functions...');

// Function to fix server lookup queries
function fixServerLookups(content) {
  let fixed = content;
  
  // Fix the old pattern: JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ?
  fixed = fixed.replace(
    /SELECT rs\.id FROM rust_servers rs JOIN guilds g ON rs\.guild_id = g\.id WHERE g\.discord_id = \? AND rs\.nickname = \?/g,
    'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?'
  );
  
  // Fix other variations
  fixed = fixed.replace(
    /SELECT.*?FROM rust_servers.*?JOIN guilds.*?WHERE g\.discord_id = \?/g,
    'SELECT id FROM rust_servers WHERE guild_id = ?'
  );
  
  return fixed;
}

// Find all JS files in the commands directory
function findCommandFiles(dir) {
  const files = [];
  
  function scanDirectory(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = `${currentDir}/${item}`;
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (item.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not scan ${dir}: ${error.message}`);
    }
  }
  
  scanDirectory(dir);
  return files;
}

// Get all command files
const commandFiles = findCommandFiles('src/commands');

console.log(`🔍 Found ${commandFiles.length} command files to check...`);

let fixedCount = 0;

commandFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Check if file has execute function and old guild lookup
    if (content.includes('execute') && content.includes('JOIN guilds')) {
      console.log(`🔧 Fixing ${filePath}...`);
      
      // Fix server lookups
      content = fixServerLookups(content);
      
      // If content changed, write it back
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed ${filePath}`);
        fixedCount++;
      } else {
        console.log(`ℹ️ No changes needed for ${filePath}`);
      }
    } else {
      console.log(`ℹ️ Skipping ${filePath} (no execute or already fixed)`);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
});

console.log(`\n🎉 Server lookup fix completed!`);
console.log(`✅ Fixed ${fixedCount} files`);
console.log(`✅ All server lookups should now work properly!`);
console.log(`✅ Your bot should be fully multi-tenant!`); 