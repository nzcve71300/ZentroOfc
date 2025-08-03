const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Elite authorization order...\n');

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

// Find the Elite authorization section and move it after kitName definition
const lines = rconContent.split('\n');
let eliteAuthStart = -1;
let eliteAuthEnd = -1;
let kitNameLine = -1;

// Find where kitName is defined
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const kitName = kitConfig.game_name || kitKey;')) {
    kitNameLine = i;
    break;
  }
}

// Find the Elite authorization section
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Handle ELITE kit authorization')) {
    eliteAuthStart = i;
  }
  if (eliteAuthStart !== -1 && lines[i].includes('}') && i > eliteAuthStart + 10) {
    // Look for the end of the Elite authorization block
    let braceCount = 0;
    for (let j = eliteAuthStart; j <= i; j++) {
      if (lines[j].includes('{')) braceCount++;
      if (lines[j].includes('}')) braceCount--;
      if (braceCount === 0 && j > eliteAuthStart) {
        eliteAuthEnd = j;
        break;
      }
    }
    break;
  }
}

if (eliteAuthStart === -1 || eliteAuthEnd === -1 || kitNameLine === -1) {
  console.log('❌ Could not find Elite authorization section or kitName definition');
  process.exit(1);
}

console.log(`✅ Found Elite authorization at lines ${eliteAuthStart + 1}-${eliteAuthEnd + 1}`);
console.log(`✅ Found kitName definition at line ${kitNameLine + 1}`);

// Extract the Elite authorization code
const eliteAuthCode = lines.slice(eliteAuthStart, eliteAuthEnd + 1);

// Remove the Elite authorization from its current position
lines.splice(eliteAuthStart, eliteAuthEnd - eliteAuthStart + 1);

// Insert the Elite authorization after kitName definition
lines.splice(kitNameLine + 1, 0, ...eliteAuthCode);

// Create backup
const backupPath = rconPath + '.backup38';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the fixed content
const fixedContent = lines.join('\n');
fs.writeFileSync(rconPath, fixedContent);
console.log('✅ Fixed Elite authorization order in src/rcon/index.js');

console.log('\n✅ Elite authorization moved to after kitName definition!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test Elite kit authorization');
console.log('3. Check bot logs for any remaining issues'); 