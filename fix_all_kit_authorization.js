const fs = require('fs');
const pool = require('./src/db');

async function fixAllKitAuthorization() {
  console.log('🔧 Fixing all kit authorization to remove Discord linking requirements...');
  
  try {
    // Read the RCON file
    const rconPath = './src/rcon/index.js';
    let rconContent = fs.readFileSync(rconPath, 'utf8');
    
    // Create backup
    const backupPath = './src/rcon/index.js.backup';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(rconPath, backupPath);
      console.log('✅ Created backup of RCON file');
    }
    
    console.log('\n📋 Step 1: Fixing VIP kit authorization...');
    
    // Fix VIP kit authorization
    const vipKitPattern = /\/\/ Handle VIP kit authorization[\s\S]*?if \(kitKey === 'VIPkit'\) \{[\s\S]*?if \(playerResult\.length === 0\) \{[\s\S]*?return;\s*\}[\s\S]*?if \(authResult\.length === 0\) \{[\s\S]*?return;\s*\}\s*\}/;
    
    const newVipKitLogic = `// Handle VIP kit authorization (no Discord linking required)
    if (kitKey === 'VIPkit') {
      console.log('[KIT CLAIM DEBUG] Checking VIP authorization for player:', player);
      
      // For VIP kits, we only need to check if the player is in the kit_auth table
      // No Discord linking requirement - check by player name directly
      const [authResult] = await pool.query(
        'SELECT * FROM kit_auth WHERE server_id = ? AND discord_id = (SELECT discord_id FROM players WHERE server_id = ? AND ign = ? AND discord_id IS NOT NULL LIMIT 1) AND kitlist = ?',
        [serverId, serverId, player, 'VIPkit']
      );
      
      console.log('[KIT CLAIM DEBUG] VIP auth result:', authResult);
      console.log('[KIT CLAIM DEBUG] Server ID used:', serverId);
      console.log('[KIT CLAIM DEBUG] Player name used:', player);
      
      if (authResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Not authorized for VIP kit, player:', player);
        sendRconCommand(ip, port, password, \`say <color=#FF69B4>\${player}</color> <color=white>you need to be added to VIP list to claim</color> <color=#800080>VIP kits</color>\`);
        return;
      }
    }`;
    
    if (rconContent.match(vipKitPattern)) {
      rconContent = rconContent.replace(vipKitPattern, newVipKitLogic);
      console.log('✅ Updated VIP kit authorization logic');
    } else {
      console.log('⚠️ Could not find VIP kit authorization section');
    }
    
    console.log('\n📋 Step 2: Fixing elite kit authorization...');
    
    // Fix elite kit authorization
    const eliteKitPattern = /\/\/ Handle ELITE kit authorization[\s\S]*?if \(kitKey\.startsWith\('ELITEkit'\)\) \{[\s\S]*?if \(playerResult\.length === 0\) \{[\s\S]*?return;\s*\}[\s\S]*?if \(authResult\.length === 0\) \{[\s\S]*?return;\s*\}\s*\}/;
    
    const newEliteKitLogic = `// Handle ELITE kit authorization (no Discord linking required)
    if (kitKey.startsWith('ELITEkit')) {
      console.log('[KIT CLAIM DEBUG] Checking elite authorization for:', kitKey, 'player:', player);
      
      // Extract elite number from kit name (ELITEkit1 -> Elite1, ELITEkit2 -> Elite2, etc.)
      const eliteNumber = kitKey.replace('ELITEkit', '');
      const kitlistName = \`Elite\${eliteNumber}\`;
      
      // For elite kits, we only need to check if the player is in the kit_auth table
      // No Discord linking requirement - check by player name directly
      const [authResult] = await pool.query(
        'SELECT * FROM kit_auth WHERE server_id = ? AND discord_id = (SELECT discord_id FROM players WHERE server_id = ? AND ign = ? AND discord_id IS NOT NULL LIMIT 1) AND kitlist = ?',
        [serverId, serverId, player, kitlistName]
      );
      
      console.log('[KIT CLAIM DEBUG] Elite auth result for', kitlistName, ':', authResult);
      console.log('[KIT CLAIM DEBUG] Server ID used:', serverId);
      console.log('[KIT CLAIM DEBUG] Player name used:', player);
      
      if (authResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Not authorized for elite kit', kitKey, 'player:', player);
        sendRconCommand(ip, port, password, \`say <color=#FF69B4>\${player}</color> <color=white>you are not authorized for</color> <color=#800080>\${kitName}</color>\`);
        return;
      }
    }`;
    
    if (rconContent.match(eliteKitPattern)) {
      rconContent = rconContent.replace(eliteKitPattern, newEliteKitLogic);
      console.log('✅ Updated elite kit authorization logic');
    } else {
      console.log('⚠️ Could not find elite kit authorization section');
    }
    
    // Save the updated RCON file
    fs.writeFileSync(rconPath, rconContent);
    console.log('✅ Saved updated RCON file');
    
    console.log('\n📋 Step 3: Updating addToKitList command...');
    
    // Update the addToKitList command
    const addToKitListPath = './src/commands/admin/addToKitList.js';
    if (fs.existsSync(addToKitListPath)) {
      let addToKitListContent = fs.readFileSync(addToKitListPath, 'utf8');
      
      // Find and replace the Discord link check for all kits
      const linkCheckPattern = /if \(!player\.discord_id\) \{[\s\S]*?embeds: \[errorEmbed\('No Discord Link'[\s\S]*?\]\)\]\);/;
      
      const newLinkCheckLogic = `if (!player.discord_id && kitlist !== 'VIPkit' && !kitlist.startsWith('Elite')) {
        return interaction.editReply({
          embeds: [errorEmbed('No Discord Link', \`\${player.ign || 'Player'} doesn't have a Discord account linked. They need to use \`/link <in-game-name>\` first.\`)]
        });
      }`;
      
      if (addToKitListContent.includes("if (!player.discord_id) {")) {
        addToKitListContent = addToKitListContent.replace(linkCheckPattern, newLinkCheckLogic);
        fs.writeFileSync(addToKitListPath, addToKitListContent);
        console.log('✅ Updated addToKitList command - VIP and elite kits no longer require Discord linking');
      } else {
        console.log('⚠️ Could not find Discord link check in addToKitList command');
      }
    }
    
    console.log('\n✅ All kit authorization fixes completed!');
    console.log('\n📋 Changes made:');
    console.log('1. Removed Discord linking requirement from VIP kit authorization');
    console.log('2. Removed Discord linking requirement from elite kit authorization');
    console.log('3. VIP and elite kits now check kit_auth table directly');
    console.log('4. Updated addToKitList command to allow VIP and elite kits without Discord linking');
    
    console.log('\n🔧 Next steps:');
    console.log('1. Restart your bot to apply the changes');
    console.log('2. Test VIP kit claims (should work without Discord linking)');
    console.log('3. Test elite kit claims (should work without Discord linking)');
    console.log('4. Use /add-to-kit-list to add players to VIP/elite kits without requiring Discord linking');
    
  } catch (error) {
    console.error('❌ Error fixing kit authorization:', error);
  } finally {
    await pool.end();
  }
}

fixAllKitAuthorization(); 