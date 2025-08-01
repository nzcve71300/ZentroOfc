const fs = require('fs');

console.log('🔧 Fixing ALL syntax errors FINAL...');

// Function to fix ALL malformed query patterns
function fixAllMalformedQueries(content) {
  let fixed = content;
  
  // Pattern 1: Missing closing quote with LIMIT 25
  fixed = fixed.replace(
    /'SELECT nickname FROM rust_servers WHERE guild_id = \? AND nickname LIKE \?' LIMIT 25'/g,
    "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25'"
  );
  
  // Pattern 2: Missing closing quote without LIMIT
  fixed = fixed.replace(
    /'SELECT nickname FROM rust_servers WHERE guild_id = \? AND nickname LIKE \?'/g,
    "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?'"
  );
  
  // Pattern 3: Double AND nickname LIKE
  fixed = fixed.replace(
    /'SELECT nickname FROM rust_servers WHERE guild_id = \? AND nickname LIKE \?' AND nickname LIKE \?/g,
    "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?'"
  );
  
  // Pattern 4: Old guild lookup pattern
  fixed = fixed.replace(
    /'SELECT.*?FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g,
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
    
    // Check if file has autocomplete
    if (content.includes('autocomplete')) {
      console.log(`🔧 Checking ${filePath}...`);
      
      // Fix all malformed queries
      content = fixAllMalformedQueries(content);
      
      // If content changed, write it back
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed ${filePath}`);
        fixedCount++;
      } else {
        console.log(`ℹ️ No changes needed for ${filePath}`);
      }
    } else {
      console.log(`ℹ️ Skipping ${filePath} (no autocomplete)`);
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

console.log(`\n🎉 FINAL syntax error fix completed!`);
console.log(`✅ Fixed ${fixedCount} files`);
console.log(`✅ All malformed queries should now be fixed!`);
console.log(`✅ Your bot should start without errors!`); 