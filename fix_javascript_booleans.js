const fs = require('fs');
const path = require('path');

function fixJavaScriptBooleans(content) {
  let fixedContent = content;
  
  // Fix JavaScript boolean values (but keep SQL TRUE/FALSE in queries)
  
  // Fix JavaScript return statements
  fixedContent = fixedContent.replace(/return TRUE;/g, 'return true;');
  fixedContent = fixedContent.replace(/return FALSE;/g, 'return false;');
  
  // Fix JavaScript variable assignments
  fixedContent = fixedContent.replace(/\bTRUE\b(?!\s*[=;])/g, 'true');
  fixedContent = fixedContent.replace(/\bFALSE\b(?!\s*[=;])/g, 'false');
  
  // Fix JavaScript function parameters
  fixedContent = fixedContent.replace(/ephemeral = TRUE/g, 'ephemeral = true');
  fixedContent = fixedContent.replace(/ephemeral = FALSE/g, 'ephemeral = false');
  
  // Fix JavaScript object properties
  fixedContent = fixedContent.replace(/inline: FALSE/g, 'inline: false');
  fixedContent = fixedContent.replace(/inline: TRUE/g, 'inline: true');
  
  // Fix JavaScript conditions
  fixedContent = fixedContent.replace(/if\s*\(\s*TRUE\s*\)/g, 'if (true)');
  fixedContent = fixedContent.replace(/if\s*\(\s*FALSE\s*\)/g, 'if (false)');
  
  // Fix JavaScript method calls
  fixedContent = fixedContent.replace(/\.setRequired\(TRUE\)/g, '.setRequired(true)');
  fixedContent = fixedContent.replace(/\.setRequired\(FALSE\)/g, '.setRequired(false)');
  
  return fixedContent;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fixedContent = fixJavaScriptBooleans(content);
    
    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      console.log(`✅ Fixed JavaScript booleans: ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️ No JavaScript boolean changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function findAndProcessFiles(dir, pattern) {
  const files = fs.readdirSync(dir);
  let processedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processedCount += findAndProcessFiles(filePath, pattern);
    } else if (file.endsWith('.js') && pattern.test(file)) {
      if (processFile(filePath)) {
        processedCount++;
      }
    }
  }
  
  return processedCount;
}

// Main execution
console.log('🔧 Fixing JavaScript boolean values...');

let totalProcessed = 0;

// Process specific files
const specificFiles = [
  'src/utils/permissions.js',
  'src/utils/economy.js',
  'src/utils/unifiedPlayerSystem.js',
  'src/utils/linking.js',
  'src/events/interactionCreate.js'
];

for (const file of specificFiles) {
  if (fs.existsSync(file)) {
    if (processFile(file)) {
      totalProcessed++;
    }
  }
}

// Process command directories
const commandDirs = [
  'src/commands/admin',
  'src/commands/player'
];

for (const dir of commandDirs) {
  if (fs.existsSync(dir)) {
    totalProcessed += findAndProcessFiles(dir, /\.js$/);
  }
}

console.log(`\n✅ JavaScript boolean fix complete! Processed ${totalProcessed} files.`);
console.log('\n📋 Summary of changes:');
console.log('- Reverted JavaScript TRUE/FALSE to true/false');
console.log('- Kept SQL TRUE/FALSE in database queries');
console.log('- Fixed return statements, variable assignments, and function parameters'); 