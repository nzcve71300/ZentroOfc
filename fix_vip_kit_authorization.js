const fs = require('fs');
const pool = require('./src/db');

async function fixVipKitAuthorization() {
  console.log('🔧 Fixing VIP kit authorization to remove Discord linking requirement...');
  
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
    
    // Find the VIP kit authorization section and replace it
    const oldVipLogic = `// Handle VIP kit authorization (in-game VIP role check)
    if (kitKey === 'VIPkit') {
      console.log('[KIT CLAIM DEBUG] Checking VIP authorization for player:', player);
      
      // Debug: Check what's in kit_auth table
      const [debugKitAuth] = await pool.query(
        'SELECT * FROM kit_auth WHERE kitlist = ?',
        ['VIPkit']
      );
      console.log('[KIT CLAIM DEBUG] All VIP kit_auth entries:', debugKitAuth);
      
      // Debug: Check server ID format
      console.log('[KIT CLAIM DEBUG] Server ID type:', typeof serverId);
      console.log('[KIT CLAIM DEBUG] Server ID value:', serverId);
      
      // For VIP kits, we need to check if the player has been added to the VIP kit list
      // This is managed through the kit_auth table with kitlist = 'VIPkit'
      const [playerResult] = await pool.query(
        'SELECT discord_id FROM players WHERE server_id = ? AND ign = ? AND discord_id IS NOT NULL',
        [serverId, player]
      );
      
      console.log('[KIT CLAIM DEBUG] Player lookup result:', playerResult);
      
      if (playerResult.length === 0) {
        console.log('[KIT CLAIM DEBUG] Player not linked for VIP kit:', player);
        sendRconCommand(ip, port, password, \`say <color=#FF69B4>\${player}</color> <color=white>you must link your Discord account first</color> <color=#800080>to claim VIP kits</color>\`);
        return;
      }
      
      // Check if player is authorized for VIP kit
      const [authResult] = await pool.query(
        \`SELECT ka.* FROM kit_auth ka 
         JOIN players p ON ka.discord_id = p.discord_id 
         WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?\`,
        [serverId, player, 'VIPkit']
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
    
    const newVipLogic = `// Handle VIP kit authorization (no Discord linking required)
    if (kitKey === 'VIPkit') {
      console.log('[KIT CLAIM DEBUG] Checking VIP authorization for player:', player);
      
      // For VIP kits, we only need to check if the player is in the kit_auth table
      // No Discord linking requirement - just check player_name directly
      const [authResult] = await pool.query(
        'SELECT * FROM kit_auth WHERE server_id = ? AND player_name = ? AND kitlist = ?',
        [serverId, player, 'VIPkit']
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
    
    // Replace the old logic with the new logic
    if (rconContent.includes('// Handle VIP kit authorization (in-game VIP role check)')) {
      rconContent = rconContent.replace(oldVipLogic, newVipLogic);
      fs.writeFileSync(rconPath, rconContent);
      console.log('✅ Updated VIP kit authorization logic - removed Discord linking requirement');
    } else {
      console.log('⚠️ Could not find VIP kit authorization section in RCON file');
      console.log('Looking for alternative patterns...');
      
      // Try a more flexible replacement
      const flexiblePattern = /\/\/ Handle VIP kit authorization[\s\S]*?if \(kitKey === 'VIPkit'\) \{[\s\S]*?if \(playerResult\.length === 0\) \{[\s\S]*?return;\s*\}[\s\S]*?if \(authResult\.length === 0\) \{[\s\S]*?return;\s*\}\s*\}/;
      
      const newFlexibleLogic = `// Handle VIP kit authorization (no Discord linking required)
    if (kitKey === 'VIPkit') {
      console.log('[KIT CLAIM DEBUG] Checking VIP authorization for player:', player);
      
      // For VIP kits, we only need to check if the player is in the kit_auth table
      // No Discord linking requirement - just check player_name directly
      const [authResult] = await pool.query(
        'SELECT * FROM kit_auth WHERE server_id = ? AND player_name = ? AND kitlist = ?',
        [serverId, player, 'VIPkit']
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
      
      if (rconContent.match(flexiblePattern)) {
        rconContent = rconContent.replace(flexiblePattern, newFlexibleLogic);
        fs.writeFileSync(rconPath, rconContent);
        console.log('✅ Updated VIP kit authorization logic using flexible pattern');
      } else {
        console.log('❌ Could not find VIP kit authorization section with any pattern');
        console.log('Please manually update the VIP kit logic in src/rcon/index.js');
      }
    }
    
    // Also update the addToKitList command to allow VIP kits without Discord linking
    console.log('\n📋 Updating addToKitList command...');
    
    const addToKitListPath = './src/commands/admin/addToKitList.js';
    if (fs.existsSync(addToKitListPath)) {
      let addToKitListContent = fs.readFileSync(addToKitListPath, 'utf8');
      
      // Find and replace the Discord link check for VIP kits
      const linkCheckPattern = /if \(!player\.discord_id\) \{[\s\S]*?embeds: \[errorEmbed\('No Discord Link'[\s\S]*?\]\)\]\);/;
      
      const newLinkCheckLogic = `if (!player.discord_id && kitlist !== 'VIPkit') {
        return interaction.editReply({
          embeds: [errorEmbed('No Discord Link', \`\${player.ign || 'Player'} doesn't have a Discord account linked. They need to use \`/link <in-game-name>\` first.\`)]
        });
      }`;
      
      if (addToKitListContent.includes("if (!player.discord_id) {")) {
        addToKitListContent = addToKitListContent.replace(linkCheckPattern, newLinkCheckLogic);
        fs.writeFileSync(addToKitListPath, addToKitListContent);
        console.log('✅ Updated addToKitList command - VIP kits no longer require Discord linking');
      } else {
        console.log('⚠️ Could not find Discord link check in addToKitList command');
      }
    }
    
    console.log('\n✅ VIP kit authorization fix completed!');
    console.log('\n📋 Changes made:');
    console.log('1. Removed Discord linking requirement from VIP kit authorization');
    console.log('2. VIP kits now only check if player is in kit_auth table');
    console.log('3. Updated addToKitList command to allow VIP kits without Discord linking');
    
    console.log('\n🔧 Next steps:');
    console.log('1. Restart your bot to apply the changes');
    console.log('2. Test VIP kit claims (should work without Discord linking)');
    console.log('3. Use /add-to-kit-list to add players to VIP kits without requiring Discord linking');
    
  } catch (error) {
    console.error('❌ Error fixing VIP kit authorization:', error);
  }
}

fixVipKitAuthorization(); 