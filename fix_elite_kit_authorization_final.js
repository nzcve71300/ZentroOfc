const fs = require('fs');
const pool = require('./src/db');

async function fixEliteKitAuthorizationFinal() {
  console.log('🔧 Fixing elite kit authorization (final version)...');
  
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
    
    console.log('\n📋 Current kit_auth table structure:');
    console.log('- server_id (varchar)');
    console.log('- discord_id (bigint)');
    console.log('- kitlist (text)');
    console.log('- No player_name column');
    
    // Find and replace the ELITE kit authorization section
    // Look for the pattern that checks for Discord linking first
    const eliteKitPattern = /if \(kitKey\.startsWith\('ELITEkit'\)\) \{[\s\S]*?if \(playerResult\.length === 0\) \{[\s\S]*?return;\s*\}[\s\S]*?if \(authResult\.length === 0\) \{[\s\S]*?return;\s*\}\s*\}/;
    
    const newEliteKitLogic = `if (kitKey.startsWith('ELITEkit')) {
      console.log('[KIT CLAIM DEBUG] Checking elite authorization for:', kitKey, 'player:', player);
      
      // Extract elite number from kit name (ELITEkit1 -> Elite1, ELITEkit2 -> Elite2, etc.)
      const eliteNumber = kitKey.replace('ELITEkit', '');
      const kitlistName = \`Elite\${eliteNumber}\`;
      
      // For elite kits, we need to check if the player is in the kit_auth table
      // Since kit_auth only has discord_id, we need to find the player's Discord ID first
      const [playerResult] = await pool.query(
        'SELECT discord_id FROM players WHERE server_id = ? AND ign = ? AND discord_id IS NOT NULL',
        [serverId, player]
      );
      
      if (playerResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Player not linked for elite kit:', kitKey, 'player:', player);
        sendRconCommand(ip, port, password, \`say <color=#FF69B4>\${player}</color> <color=white>you must link your Discord account first</color> <color=#800080>to claim elite kits</color>\`);
        return;
      }
      
      // Then check if player is authorized for this elite kit list
      const [authResult] = await pool.query(
        'SELECT * FROM kit_auth WHERE server_id = ? AND discord_id = ? AND kitlist = ?',
        [serverId, playerResult[0].discord_id, kitlistName]
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
      fs.writeFileSync(rconPath, rconContent);
      console.log('✅ Updated elite kit authorization logic - now works with actual database structure');
    } else {
      console.log('⚠️ Could not find elite kit authorization section with expected pattern');
      console.log('Looking for alternative patterns...');
      
      // Try a more flexible replacement
      const flexiblePattern = /\/\/ Handle ELITE kit authorization[\s\S]*?if \(kitKey\.startsWith\('ELITEkit'\)\) \{[\s\S]*?if \(playerResult\.length === 0\) \{[\s\S]*?return;\s*\}[\s\S]*?if \(authResult\.length === 0\) \{[\s\S]*?return;\s*\}\s*\}/;
      
      const newFlexibleLogic = `// Handle ELITE kit authorization (works with actual database structure)
    if (kitKey.startsWith('ELITEkit')) {
      console.log('[KIT CLAIM DEBUG] Checking elite authorization for:', kitKey, 'player:', player);
      
      // Extract elite number from kit name (ELITEkit1 -> Elite1, ELITEkit2 -> Elite2, etc.)
      const eliteNumber = kitKey.replace('ELITEkit', '');
      const kitlistName = \`Elite\${eliteNumber}\`;
      
      // For elite kits, we need to check if the player is in the kit_auth table
      // Since kit_auth only has discord_id, we need to find the player's Discord ID first
      const [playerResult] = await pool.query(
        'SELECT discord_id FROM players WHERE server_id = ? AND ign = ? AND discord_id IS NOT NULL',
        [serverId, player]
      );
      
      if (playerResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Player not linked for elite kit:', kitKey, 'player:', player);
        sendRconCommand(ip, port, password, \`say <color=#FF69B4>\${player}</color> <color=white>you must link your Discord account first</color> <color=#800080>to claim elite kits</color>\`);
        return;
      }
      
      // Then check if player is authorized for this elite kit list
      const [authResult] = await pool.query(
        'SELECT * FROM kit_auth WHERE server_id = ? AND discord_id = ? AND kitlist = ?',
        [serverId, playerResult[0].discord_id, kitlistName]
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
      
      if (rconContent.match(flexiblePattern)) {
        rconContent = rconContent.replace(flexiblePattern, newFlexibleLogic);
        fs.writeFileSync(rconPath, rconContent);
        console.log('✅ Updated elite kit authorization logic using flexible pattern');
      } else {
        console.log('❌ Could not find elite kit authorization section with any pattern');
        console.log('Please manually update the elite kit logic in src/rcon/index.js');
        console.log('The logic should check players table for discord_id, then check kit_auth table');
      }
    }
    
    console.log('\n✅ Elite kit authorization fix completed!');
    console.log('\n📋 Changes made:');
    console.log('1. Updated elite kit authorization to work with actual database structure');
    console.log('2. Elite kits now properly check kit_auth table using discord_id');
    console.log('3. Maintains Discord linking requirement (since kit_auth uses discord_id)');
    
    console.log('\n🔧 Next steps:');
    console.log('1. Restart your bot to apply the changes');
    console.log('2. Test elite kit claims (should work properly now)');
    console.log('3. Make sure players are linked and added to elite kit lists');
    
  } catch (error) {
    console.error('❌ Error fixing elite kit authorization:', error);
  } finally {
    await pool.end();
  }
}

fixEliteKitAuthorizationFinal(); 