const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kit names to use correct game_name...\n');

// Read the current RCON file
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
let rconContent = '';

try {
  rconContent = fs.readFileSync(rconPath, 'utf8');
  console.log('✅ Read RCON file');
} catch (error) {
  console.log('❌ Could not read RCON file:', error.message);
  process.exit(1);
}

// Find and fix the kit name usage in handleKitClaim
const lines = rconContent.split('\n');
let fixed = false;

for (let i = 0; i < lines.length; i++) {
  // Find the line where kit givetoplayer is called
  if (lines[i].includes('kit givetoplayer') && lines[i].includes('${kitKey}')) {
    console.log(`✅ Found problematic line ${i + 1}: ${lines[i].trim()}`);
    // Replace kitKey with kitConfig.game_name
    lines[i] = lines[i].replace('${kitKey}', '${kitConfig.game_name}');
    console.log(`✅ Fixed line ${i + 1}: ${lines[i].trim()}`);
    fixed = true;
  }
  
  // Also fix the say message to use the correct kit name
  if (lines[i].includes('claimed') && lines[i].includes('${kitKey}')) {
    console.log(`✅ Found problematic line ${i + 1}: ${lines[i].trim()}`);
    // Replace kitKey with kitConfig.game_name
    lines[i] = lines[i].replace('${kitKey}', '${kitConfig.game_name}');
    console.log(`✅ Fixed line ${i + 1}: ${lines[i].trim()}`);
    fixed = true;
  }
  
  // Fix the admin feed message
  if (lines[i].includes('claimed ${kitKey}') && lines[i].includes('sendFeedEmbed')) {
    console.log(`✅ Found problematic line ${i + 1}: ${lines[i].trim()}`);
    // Replace kitKey with kitConfig.game_name
    lines[i] = lines[i].replace('${kitKey}', '${kitConfig.game_name}');
    console.log(`✅ Fixed line ${i + 1}: ${lines[i].trim()}`);
    fixed = true;
  }
}

if (!fixed) {
  console.log('❌ Could not find the problematic lines');
  process.exit(1);
}

// Create backup
const backupPath = rconPath + '.backup37';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the fixed content
const fixedContent = lines.join('\n');
fs.writeFileSync(rconPath, fixedContent);
console.log('✅ Fixed kit names in src/rcon/index.js');

console.log('\n✅ Kit names fixed to use correct game_name!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test autokits in-game');
console.log('3. Check bot logs for any remaining issues'); 