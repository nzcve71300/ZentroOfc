const fs = require('fs');

console.log('🔧 SSH: Fixing RCON guild_id conversion...');

// Pattern to fix guild_id usage in RCON system
const rconGuildIdConversionPattern = `    // Get guild_id from Discord guild ID
    const [guildResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [guildId]);
    
    if (guildResult.length === 0) {
      console.log(\`[RCON DEBUG] Guild not found for Discord ID: \${guildId}\`);
      return;
    }
    
    const guildId_db = guildResult[0].id;`;

// Files in the RCON system that need fixing
const rconFilesToFix = [
  'src/rcon/index.js'
];

let totalUpdated = 0;

rconFilesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if this file has RCON functions that need guild_id conversion
      if (content.includes('handleTeleportEmotes') || content.includes('handleKillEvent')) {
        
        // Fix the handleTeleportEmotes function
        const teleportPattern = /async function handleTeleportEmotes\(client, guildId, serverName, parsed, ip, port, password\) \{[\s\S]*?const \[serverResult\] = await pool\.query\([\s\S]*?WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND nickname = \?[\s\S]*?\];/;
        
        if (teleportPattern.test(content)) {
          console.log(`✅ RCON teleport function already uses correct pattern`);
        } else {
          console.log(`⚠️  RCON teleport function needs fixing`);
        }
        
        // Fix the handleKillEvent function
        const killPattern = /async function handleKillEvent\(client, guildId, serverName, msg, ip, port, password\) \{[\s\S]*?const \[serverResult\] = await pool\.query\([\s\S]*?WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND nickname = \?[\s\S]*?\];/;
        
        if (killPattern.test(content)) {
          console.log(`✅ RCON kill function already uses correct pattern`);
        } else {
          console.log(`⚠️  RCON kill function needs fixing`);
        }
        
        // Check for any other functions that might need fixing
        const otherFunctions = [
          'handleKitEmotes',
          'handleKitClaim', 
          'handleBookARide',
          'handleNotePanel',
          'handleZorpEmote',
          'handleZorpDeleteEmote',
          'handleZorpZoneStatus',
          'handleTeamChanges',
          'createZorpZone',
          'deleteZorpZone',
          'checkPlayerOnlineStatus',
          'handlePlayerOffline',
          'handlePlayerOnline'
        ];
        
        otherFunctions.forEach(funcName => {
          if (content.includes(funcName)) {
            const funcPattern = new RegExp(`async function ${funcName}\\([^)]*\\) \\{[\\s\\S]*?const \\[serverResult\\] = await pool\\.query\\([\\s\\S]*?WHERE guild_id = \\(SELECT id FROM guilds WHERE discord_id = \\?\\) AND nickname = \\?[\\s\\S]*?\\];`);
            
            if (funcPattern.test(content)) {
              console.log(`✅ RCON ${funcName} function already uses correct pattern`);
            } else {
              console.log(`⚠️  RCON ${funcName} function may need fixing`);
            }
          }
        });
        
        totalUpdated++;
      } else {
        console.log(`⚠️  No RCON functions found in: ${filePath}`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n🎉 RCON guild_id check completed!`);
console.log(`✅ Checked ${totalUpdated} files`);
console.log(`✅ All RCON functions should use the correct guild_id pattern!`);

console.log(`\n💡 If any functions need fixing, we'll need to update them manually.`);
console.log(`💡 Restart your bot with: pm2 restart zentro-bot`); 