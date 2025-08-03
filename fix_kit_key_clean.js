const fs = require('fs');
const path = require('path');

console.log('🔧 Clean fix for kitKey scope issue...\n');

// Restore from a clean backup first
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
const backupOptions = [
  rconPath + '.backup29',
  rconPath + '.backup28', 
  rconPath + '.backup27',
  rconPath + '.backup26'
];

let restored = false;
for (const backup of backupOptions) {
  if (fs.existsSync(backup)) {
    console.log(`✅ Found clean backup, restoring from ${backup}...`);
    fs.copyFileSync(backup, rconPath);
    console.log('✅ Restored from clean backup');
    restored = true;
    break;
  }
}

if (!restored) {
  console.log('❌ No clean backup found, cannot proceed');
  process.exit(1);
}

// Read the restored file
let rconContent = '';
try {
  rconContent = fs.readFileSync(rconPath, 'utf8');
  console.log('✅ Read restored RCON file');
} catch (error) {
  console.log('❌ Could not read RCON file:', error.message);
  process.exit(1);
}

// Make ONLY the necessary change - rename the loop variable
let fixedContent = rconContent;

// Replace the for loop declaration
fixedContent = fixedContent.replace(
  'for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {',
  'for (const [kitKeyLoop, emote] of Object.entries(KIT_EMOTES)) {'
);

// Create new backup
const newBackupPath = rconPath + '.backup31';
fs.copyFileSync(rconPath, newBackupPath);
console.log('✅ Created new backup:', newBackupPath);

// Write the fixed content
fs.writeFileSync(rconPath, fixedContent);
console.log('✅ Fixed kitKey scope issue in src/rcon/index.js');

console.log('\n✅ KitKey scope issue fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test autokits in-game');
console.log('3. Check bot logs for any remaining issues'); 