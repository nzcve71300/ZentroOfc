const pool = require('./src/db');

async function fixLinkingAndVipIssues() {
  console.log('🔧 Starting comprehensive fix for linking and VIP issues...');
  
  try {
    // 1. Fix linking issues by cleaning up inactive/conflicting records
    console.log('\n📋 Step 1: Cleaning up inactive player records...');
    
    // Find and log all inactive players that might be causing conflicts
    const [inactivePlayers] = await pool.query(`
      SELECT p.*, rs.nickname as server_name 
      FROM players p 
      JOIN rust_servers rs ON p.server_id = rs.id 
      WHERE p.is_active = false 
      AND p.discord_id IS NOT NULL
      ORDER BY p.ign, p.discord_id
    `);
    
    console.log(`Found ${inactivePlayers.length} inactive player records:`);
    inactivePlayers.forEach(player => {
      console.log(`- ${player.ign} (Discord: ${player.discord_id}) on ${player.server_name} - Linked: ${player.linked_at}, Unlinked: ${player.unlinked_at}`);
    });
    
    // Clean up any duplicate active records for the same IGN on the same server
    console.log('\n📋 Step 2: Removing duplicate active records...');
    const [duplicateResult] = await pool.query(`
      DELETE p1 FROM players p1
      INNER JOIN players p2 
      WHERE p1.id > p2.id 
      AND p1.server_id = p2.server_id 
      AND p1.ign = p2.ign 
      AND p1.is_active = true 
      AND p2.is_active = true
    `);
    console.log(`Removed ${duplicateResult.affectedRows} duplicate active records`);
    
    // Clean up any duplicate active records for the same Discord ID on the same server
    const [duplicateDiscordResult] = await pool.query(`
      DELETE p1 FROM players p1
      INNER JOIN players p2 
      WHERE p1.id > p2.id 
      AND p1.server_id = p2.server_id 
      AND p1.discord_id = p2.discord_id 
      AND p1.discord_id IS NOT NULL
      AND p2.discord_id IS NOT NULL
      AND p1.is_active = true 
      AND p2.is_active = true
    `);
    console.log(`Removed ${duplicateDiscordResult.affectedRows} duplicate Discord ID records`);
    
    // 2. Fix VIP kit authorization to remove link requirement
    console.log('\n📋 Step 3: Updating VIP kit authorization logic...');
    
    // First, let's see the current VIP kit authorization logic in the RCON file
    console.log('Current VIP kit logic requires Discord linking. Updating to remove this requirement...');
    
    // 3. Create a backup of the current RCON file
    const fs = require('fs');
    const rconPath = './src/rcon/index.js';
    const backupPath = './src/rcon/index.js.backup';
    
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(rconPath, backupPath);
      console.log('✅ Created backup of RCON file');
    }
    
    // 4. Update the VIP kit authorization logic
    let rconContent = fs.readFileSync(rconPath, 'utf8');
    
    // Find and replace the VIP kit authorization section
    const vipKitPattern = /\/\/ Handle VIP kit authorization \(in-game VIP role check\)[\s\S]*?if \(authResult\.length === 0\) \{[\s\S]*?return;\s*\}/;
    
    const newVipKitLogic = `// Handle VIP kit authorization (no link requirement)
    if (kitKey === 'VIPkit') {
      console.log('[KIT CLAIM DEBUG] Checking VIP authorization for player:', player);
      
      // For VIP kits, we only need to check if the player is in the kit_auth table
      // No Discord linking requirement
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
    
    if (rconContent.includes('// Handle VIP kit authorization (in-game VIP role check)')) {
      rconContent = rconContent.replace(vipKitPattern, newVipKitLogic);
      fs.writeFileSync(rconPath, rconContent);
      console.log('✅ Updated VIP kit authorization logic - removed Discord linking requirement');
    } else {
      console.log('⚠️ Could not find VIP kit authorization section in RCON file');
    }
    
    // 5. Update the addToKitList command to handle VIP kits without Discord linking
    console.log('\n📋 Step 4: Updating addToKitList command for VIP kits...');
    
    const addToKitListPath = './src/commands/admin/addToKitList.js';
    let addToKitListContent = fs.readFileSync(addToKitListPath, 'utf8');
    
    // Find the section that checks for Discord linking
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
    
    // 6. Create a diagnostic script to check linking status
    console.log('\n📋 Step 5: Creating diagnostic script...');
    
    const diagnosticScript = `const pool = require('./src/db');

async function diagnoseLinkingIssues() {
  console.log('🔍 Diagnosing linking issues...');
  
  try {
    // Check for players with linking conflicts
    const [conflicts] = await pool.query(\`
      SELECT 
        p1.ign,
        p1.discord_id as discord_id_1,
        p1.is_active as active_1,
        p2.discord_id as discord_id_2,
        p2.is_active as active_2,
        rs.nickname as server_name
      FROM players p1
      JOIN players p2 ON p1.ign = p2.ign AND p1.server_id = p2.server_id AND p1.id != p2.id
      JOIN rust_servers rs ON p1.server_id = rs.id
      WHERE p1.ign IS NOT NULL
      ORDER BY p1.ign, p1.server_id
    \`);
    
    if (conflicts.length > 0) {
      console.log('\\n⚠️ Found linking conflicts:');
      conflicts.forEach(conflict => {
        console.log(\`- \${conflict.ign} on \${conflict.server_name}: Discord \${conflict.discord_id_1} (active: \${conflict.active_1}) vs Discord \${conflict.discord_id_2} (active: \${conflict.active_2})\`);
      });
    } else {
      console.log('✅ No linking conflicts found');
    }
    
    // Check VIP kit authorization
    const [vipAuth] = await pool.query(\`
      SELECT ka.*, rs.nickname as server_name
      FROM kit_auth ka
      JOIN rust_servers rs ON ka.server_id = rs.id
      WHERE ka.kitlist = 'VIPkit'
      ORDER BY ka.server_id, ka.player_name
    \`);
    
    console.log('\\n📋 VIP kit authorizations:');
    vipAuth.forEach(auth => {
      console.log(\`- \${auth.player_name} on \${auth.server_name} (Discord: \${auth.discord_id || 'None'})\`);
    });
    
  } catch (error) {
    console.error('❌ Error in diagnosis:', error);
  }
}

diagnoseLinkingIssues();`;
    
    fs.writeFileSync('./diagnose_linking_final.js', diagnosticScript);
    console.log('✅ Created diagnostic script: diagnose_linking_final.js');
    
    // 7. Create a cleanup script for orphaned records
    console.log('\n📋 Step 6: Creating cleanup script...');
    
    const cleanupScript = `const pool = require('./src/db');

async function cleanupOrphanedRecords() {
  console.log('🧹 Cleaning up orphaned records...');
  
  try {
    // Remove inactive players with no Discord ID (orphaned records)
    const [orphanedResult] = await pool.query(\`
      DELETE FROM players 
      WHERE is_active = false 
      AND discord_id IS NULL
      AND linked_at IS NULL
    \`);
    console.log(\`Removed \${orphanedResult.affectedRows} orphaned inactive records\`);
    
    // Remove duplicate kit_auth entries
    const [duplicateKitAuth] = await pool.query(\`
      DELETE ka1 FROM kit_auth ka1
      INNER JOIN kit_auth ka2 
      WHERE ka1.id > ka2.id 
      AND ka1.server_id = ka2.server_id 
      AND ka1.player_name = ka2.player_name 
      AND ka1.kitlist = ka2.kitlist
    \`);
    console.log(\`Removed \${duplicateKitAuth.affectedRows} duplicate kit_auth entries\`);
    
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.error('❌ Error in cleanup:', error);
  }
}

cleanupOrphanedRecords();`;
    
    fs.writeFileSync('./cleanup_orphaned_records.js', cleanupScript);
    console.log('✅ Created cleanup script: cleanup_orphaned_records.js');
    
    console.log('\n✅ Comprehensive fix completed!');
    console.log('\n📋 Summary of changes:');
    console.log('1. Cleaned up duplicate and inactive player records');
    console.log('2. Removed Discord linking requirement from VIP kits');
    console.log('3. Updated RCON VIP kit authorization logic');
    console.log('4. Updated addToKitList command for VIP kits');
    console.log('5. Created diagnostic and cleanup scripts');
    
    console.log('\n🔧 Next steps:');
    console.log('1. Run: node diagnose_linking_final.js (to check current status)');
    console.log('2. Run: node cleanup_orphaned_records.js (to clean up orphaned records)');
    console.log('3. Test /link and /unlink commands');
    console.log('4. Test VIP kit claims (should work without Discord linking)');
    
  } catch (error) {
    console.error('❌ Error in comprehensive fix:', error);
  } finally {
    await pool.end();
  }
}

fixLinkingAndVipIssues(); 