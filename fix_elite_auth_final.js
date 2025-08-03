const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing elite kit authorization with correct column names...\n');

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

// First, let's remove any existing problematic elite authorization code
console.log('📋 Removing any existing problematic elite authorization code...');
const cleanedContent = rconContent.replace(
  /\/\/ Handle ELITE kit authorization[\s\S]*?console\.log\('\[KIT CLAIM DEBUG\] Authorized for elite kit', kitKey, 'player:', player\);\s*\}\s*/,
  ''
);

// Create the correct elite authorization logic using nickname column
const eliteAuthLogic = `
        // Handle ELITE kit authorization (requires being added to kit list)
        if (kitKey.startsWith('ELITEkit')) {
          console.log('[KIT CLAIM DEBUG] Checking elite authorization for:', kitKey, 'player:', player);
          const eliteNumber = kitKey.replace('ELITEkit', '');
          const kitlistName = \`Elite\${eliteNumber}\`;
          
          // Get server ID from server nickname
          const [serverResult] = await pool.query(
            'SELECT id FROM rust_servers WHERE nickname = ?',
            [serverName]
          );
          
          if (serverResult.length === 0) {
            console.log('[KIT CLAIM DEBUG] Server not found:', serverName);
            return;
          }
          
          const serverId = serverResult[0].id;
          
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

// Find the duplicate check pattern and insert elite authorization after it
const duplicateCheckPattern = /\[KIT CLAIM DEBUG\] Duplicate claim detected, skipping/;

if (duplicateCheckPattern.test(cleanedContent)) {
  console.log('✅ Found duplicate check pattern');
  
  // Insert the elite authorization after the duplicate check
  const updatedContent = cleanedContent.replace(
    /(\[KIT CLAIM DEBUG\] Duplicate claim detected, skipping[^\n]*\n)/,
    `$1${eliteAuthLogic}`
  );
  
  // Backup the original file
  const backupPath = rconPath + '.backup5';
  fs.copyFileSync(rconPath, backupPath);
  console.log('✅ Created backup:', backupPath);
  
  // Write the updated content
  fs.writeFileSync(rconPath, updatedContent);
  console.log('✅ Added elite kit authorization logic to src/rcon/index.js');
  
} else {
  console.log('❌ Could not find duplicate check pattern');
  console.log('📋 Manual intervention required - please check the handleKitClaim function structure');
}

console.log('\n✅ Elite kit authorization fix completed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test elite kit claims (should now properly block unauthorized players)');
console.log('3. Make sure players are linked and added to elite kit lists'); 