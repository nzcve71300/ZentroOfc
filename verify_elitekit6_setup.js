const pool = require('./src/db');
const fs = require('fs');

async function verifyELITEkit6Setup() {
  console.log('🔧 Verifying ELITEkit6 Setup...\n');
  
  try {
    // 1. Check RCON emote mapping
    console.log('📋 Step 1: Checking RCON emote mapping...');
    const rconContent = fs.readFileSync('./src/rcon/index.js', 'utf8');
    
    if (rconContent.includes('ELITEkit6: \'d11_quick_chat_i_have_phrase_format hatchet\'')) {
      console.log('✅ ELITEkit6 emote mapping found: d11_quick_chat_i_have_phrase_format hatchet');
    } else {
      console.log('❌ ELITEkit6 emote mapping NOT found in RCON');
      return;
    }
    
    // 2. Check kit authorization logic
    if (rconContent.includes('kitKey.startsWith(\'ELITEkit\')')) {
      console.log('✅ ELITE kit authorization logic found (handles ELITEkit6)');
    } else {
      console.log('❌ ELITE kit authorization logic NOT found');
      return;
    }
    
    // 3. Check command files
    const commandFiles = [
      './src/commands/admin/addToKitList.js',
      './src/commands/admin/removeFromKitList.js', 
      './src/commands/admin/viewKitListPlayers.js',
      './src/commands/admin/wipeKitClaims.js',
      './src/commands/admin/autokitsSetup.js',
      './src/commands/admin/viewAutokitsConfigs.js'
    ];
    
    console.log('\n📋 Step 2: Checking Discord commands...');
    
    for (const file of commandFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const fileName = file.split('/').pop();
      
      if (content.includes('Elite List 6') || content.includes('ELITEkit6')) {
        console.log(`✅ ${fileName}: Elite List 6/ELITEkit6 option found`);
      } else if (fileName === 'viewAutokitsConfigs.js' && content.includes('ELITEkit5', 'ELITEkit6')) {
        console.log(`✅ ${fileName}: ELITEkit6 in expectedKits array found`);
      } else {
        console.log(`❌ ${fileName}: Elite List 6/ELITEkit6 option NOT found`);
      }
    }
    
    // 4. Test database connection and show example queries
    console.log('\n📋 Step 3: Testing database queries...');
    
    // Check if any servers have ELITEkit6 configured
    const [autokitResult] = await pool.query(
      'SELECT rs.nickname, a.enabled, a.cooldown, a.game_name FROM autokits a JOIN rust_servers rs ON a.server_id = rs.id WHERE a.kit_name = ?',
      ['ELITEkit6']
    );
    
    if (autokitResult.length > 0) {
      console.log(`✅ Found ${autokitResult.length} server(s) with ELITEkit6 configured:`);
      autokitResult.forEach(server => {
        console.log(`   - ${server.nickname}: ${server.enabled ? 'Enabled' : 'Disabled'}, ${server.cooldown}min cooldown, game name: ${server.game_name}`);
      });
    } else {
      console.log('⚠️  No servers have ELITEkit6 configured yet');
      console.log('💡 Use /autokits-setup to configure ELITEkit6 on your servers');
    }
    
    // Check if any players are authorized for Elite6
    const [authResult] = await pool.query(
      'SELECT COUNT(*) as count FROM kit_auth WHERE kitlist = ?',
      ['Elite6']
    );
    
    if (authResult[0].count > 0) {
      console.log(`✅ ${authResult[0].count} player(s) authorized for Elite6 list`);
    } else {
      console.log('⚠️  No players authorized for Elite6 list yet');
      console.log('💡 Use /add-to-kit-list to add players to Elite List 6');
    }
    
    // 5. Show testing instructions
    console.log('\n🎯 Testing Instructions:');
    console.log('1. Configure ELITEkit6 on a server:');
    console.log('   /autokits-setup server:[server] setup:ELITEkit6 option:toggle value:on');
    console.log('   /autokits-setup server:[server] setup:ELITEkit6 option:cooldown value:120');
    console.log('   /autokits-setup server:[server] setup:ELITEkit6 option:name value:ELITEkit6');
    console.log('');
    console.log('2. Add a player to Elite List 6:');
    console.log('   /add-to-kit-list server:[server] name:[player] kitlist:Elite6');
    console.log('');
    console.log('3. Test in-game:');
    console.log('   Have the authorized player send the emote: d11_quick_chat_i_have_phrase_format hatchet');
    console.log('   Expected RCON log: [CHAT LOCAL] PlayerName : d11_quick_chat_i_have_phrase_format hatchet');
    console.log('   Expected result: Player receives ELITEkit6 and sees success message');
    console.log('');
    console.log('4. Verify in logs:');
    console.log('   pm2 logs zentro-bot | grep ELITEkit6');
    
    console.log('\n✅ ELITEkit6 setup verification complete!');
    console.log('🚀 Restart the bot to apply all changes: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await pool.end();
  }
}

verifyELITEkit6Setup();