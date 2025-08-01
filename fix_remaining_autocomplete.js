const fs = require('fs');

console.log('🔧 Fixing remaining autocomplete functions...');

// Function to fix old guild lookup pattern
function fixOldGuildLookup(content) {
  let fixed = content;
  
  // Fix the old pattern: (SELECT id FROM guilds WHERE discord_id = ?)
  fixed = fixed.replace(
    /'SELECT.*?FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g,
    "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?'"
  );
  
  // Fix malformed queries that might have been created
  fixed = fixed.replace(
    /'SELECT nickname FROM rust_servers WHERE guild_id = \? AND nickname LIKE \?' AND nickname LIKE \?/g,
    "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?'"
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
    
    // Check if file has autocomplete and old guild lookup
    if (content.includes('autocomplete') && content.includes('SELECT id FROM guilds WHERE discord_id = ?')) {
      console.log(`🔧 Fixing ${filePath}...`);
      
      // Fix old guild lookup
      content = fixOldGuildLookup(content);
      
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
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
});

// Also fix unifiedPlayerSystem.js
const unifiedPath = 'src/utils/unifiedPlayerSystem.js';
try {
  if (fs.existsSync(unifiedPath)) {
    let content = fs.readFileSync(unifiedPath, 'utf8');
    const originalContent = content;
    
    // Fix all functions that use the old guild lookup
    if (content.includes("SELECT id FROM guilds WHERE discord_id = ?")) {
      console.log(`🔧 Fixing ${unifiedPath}...`);
      
      // Fix all the old patterns
      content = content.replace(
        /WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g,
        'WHERE guild_id = ?'
      );
      
      content = content.replace(
        /VALUES \(\(SELECT id FROM guilds WHERE discord_id = \?\), \?, \?, \?, CURRENT_TIMESTAMP, true\)/g,
        'VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, true)'
      );
      
      if (content !== originalContent) {
        fs.writeFileSync(unifiedPath, content);
        console.log(`✅ Fixed ${unifiedPath}`);
        fixedCount++;
      }
    }
  }
} catch (error) {
  console.error(`❌ Error fixing ${unifiedPath}:`, error.message);
}

console.log(`\n🎉 Remaining autocomplete fix completed!`);
console.log(`✅ Fixed ${fixedCount} files`);
console.log(`✅ All commands should now work properly!`); 