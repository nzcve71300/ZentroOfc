const fs = require('fs');
const pool = require('./src/db');

async function fixVipKitAuthorizationFinal() {
  console.log('🔧 Fixing VIP kit authorization (final version)...');
  
  try {
    // First, let's check the actual kit_auth table structure
    console.log('\n📋 Checking kit_auth table structure...');
    const [structure] = await pool.query('DESCRIBE kit_auth');
    console.log('kit_auth columns:', structure.map(col => col.Field));
    
    // Check sample records
    const [samples] = await pool.query('SELECT * FROM kit_auth LIMIT 3');
    console.log('Sample kit_auth records:', samples);
    
    // Read the RCON file
    const rconPath = './src/rcon/index.js';
    let rconContent = fs.readFileSync(rconPath, 'utf8');
    
    // Create backup
    const backupPath = './src/rcon/index.js.backup';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(rconPath, backupPath);
      console.log('✅ Created backup of RCON file');
    }
    
    // Find and replace the VIP kit authorization section
    // Look for the pattern that checks for Discord linking
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
      fs.writeFileSync(rconPath, rconContent);
      console.log('✅ Updated VIP kit authorization logic - removed Discord linking requirement');
    } else {
      console.log('⚠️ Could not find VIP kit authorization section with expected pattern');
      console.log('Looking for alternative patterns...');
      
      // Try a simpler replacement
      const simplePattern = /if \(kitKey === 'VIPkit'\) \{[\s\S]*?if \(playerResult\.length === 0\) \{[\s\S]*?return;\s*\}[\s\S]*?if \(authResult\.length === 0\) \{[\s\S]*?return;\s*\}\s*\}/;
      
      const newSimpleLogic = `if (kitKey === 'VIPkit') {
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
      
      if (rconContent.match(simplePattern)) {
        rconContent = rconContent.replace(simplePattern, newSimpleLogic);
        fs.writeFileSync(rconPath, rconContent);
        console.log('✅ Updated VIP kit authorization logic using simple pattern');
      } else {
        console.log('❌ Could not find VIP kit authorization section with any pattern');
        console.log('Please manually update the VIP kit logic in src/rcon/index.js');
        console.log('Look for the section that handles VIPkit and remove the Discord linking check');
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
    console.log('2. VIP kits now check kit_auth table directly');
    console.log('3. Updated addToKitList command to allow VIP kits without Discord linking');
    
    console.log('\n🔧 Next steps:');
    console.log('1. Restart your bot to apply the changes');
    console.log('2. Test VIP kit claims (should work without Discord linking)');
    console.log('3. Use /add-to-kit-list to add players to VIP kits without requiring Discord linking');
    
  } catch (error) {
    console.error('❌ Error fixing VIP kit authorization:', error);
  } finally {
    await pool.end();
  }
}

fixVipKitAuthorizationFinal(); 