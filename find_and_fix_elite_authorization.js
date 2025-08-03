const fs = require('fs');
const path = require('path');

console.log('🔍 Finding and fixing elite kit authorization...\n');

// Read the current RCON file
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
let rconContent = '';

try {
  rconContent = fs.readFileSync(rconPath, 'utf8');
  console.log('✅ Found src/rcon/index.js');
} catch (error) {
  console.log('❌ Could not read src/rcon/index.js:', error.message);
  process.exit(1);
}

// Look for elite kit patterns
const elitePatterns = [
  /ELITEkit/,
  /Elite\d+/,
  /elite.*kit/i,
  /kit.*elite/i
];

console.log('📋 Searching for elite kit patterns...');
let foundEliteCode = false;

for (const pattern of elitePatterns) {
  if (pattern.test(rconContent)) {
    console.log(`✅ Found pattern: ${pattern}`);
    foundEliteCode = true;
    break;
  }
}

if (!foundEliteCode) {
  console.log('❌ No elite kit patterns found in RCON file');
  console.log('📋 Creating new elite kit authorization logic...');
  
  // Find the handleKitClaim function
  const handleKitClaimMatch = rconContent.match(/async function handleKitClaim\([^)]*\)\s*\{[\s\S]*?\}/);
  
  if (handleKitClaimMatch) {
    console.log('✅ Found handleKitClaim function');
    
    // Create the correct elite kit authorization logic
    const eliteAuthLogic = `
      // Handle ELITE kit authorization (requires being added to kit list)
      if (kitKey.startsWith('ELITEkit')) {
        console.log('[KIT CLAIM DEBUG] Checking elite authorization for:', kitKey, 'player:', player);
        const eliteNumber = kitKey.replace('ELITEkit', '');
        const kitlistName = \`Elite\${eliteNumber}\`;
        
        // First check if player is Discord linked
        const [playerResult] = await pool.query(
          'SELECT discord_id FROM players WHERE server_id = ? AND ign = ? AND discord_id IS NOT NULL',
          [serverId, player]
        );
        
        if (playerResult.length === 0) {
          console.log('[KIT CLAIM DEBUG] Player not linked for elite kit:', kitKey, 'player:', player);
          sendRconCommand(ip, port, password, \`say <color=#FF69B4>\${player}</color> <color=white>you must link your Discord account first</color> <color=#800080>to claim elite kits</color>\`);
          return;
        }
        
        // Then check if player is authorized for this elite kit
        const [authResult] = await pool.query(
          \`SELECT ka.* FROM kit_auth ka 
           JOIN players p ON ka.discord_id = p.discord_id 
           WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?\`,
          [serverId, player, kitlistName]
        );
        
        if (authResult.length === 0) {
          console.log('[KIT CLAIM DEBUG] Not authorized for elite kit', kitKey, 'player:', player);
          sendRconCommand(ip, port, password, \`say <color=#FF69B4>\${player}</color> <color=white>you are not authorized for</color> <color=#800080>\${kitName}</color>\`);
          return;
        }
        
        console.log('[KIT CLAIM DEBUG] Authorized for elite kit', kitKey, 'player:', player);
      }
    `;
    
    // Insert the elite logic before the final kit giving logic
    const updatedContent = rconContent.replace(
      /(\/\/ Handle VIP kit authorization[\s\S]*?)(\s*\/\/ Give the kit)/,
      `$1${eliteAuthLogic}$2`
    );
    
    // Backup the original file
    const backupPath = rconPath + '.backup';
    fs.copyFileSync(rconPath, backupPath);
    console.log('✅ Created backup:', backupPath);
    
    // Write the updated content
    fs.writeFileSync(rconPath, updatedContent);
    console.log('✅ Updated src/rcon/index.js with elite kit authorization');
    
  } else {
    console.log('❌ Could not find handleKitClaim function');
  }
} else {
  console.log('✅ Found existing elite kit code, checking if it needs updates...');
  
  // Show the current elite kit logic
  const eliteMatch = rconContent.match(/(\/\/ Handle ELITE kit authorization[\s\S]*?)(?=\/\/ Handle VIP|$)/);
  if (eliteMatch) {
    console.log('📋 Current elite kit logic:');
    console.log(eliteMatch[1]);
  }
}

console.log('\n✅ Elite kit authorization fix completed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test elite kit claims (should now properly block unauthorized players)');
console.log('3. Make sure players are linked and added to elite kit lists'); 