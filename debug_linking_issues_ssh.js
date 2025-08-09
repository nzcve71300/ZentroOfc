const pool = require('./src/db');

async function debugLinkingIssues() {
  try {
    console.log('🔍 SSH: Debugging Linking Issues...');

    // Test data
    const testGuildId = '1379533411009560626'; // Snowy Billiards 2x
    const testPlayer = 'CrashPompano643';
    const testDiscordId = '1252993829007528086';

    console.log(`\n🧪 Testing with:`);
    console.log(`   Guild ID: ${testGuildId}`);
    console.log(`   Player: ${testPlayer}`);
    console.log(`   Discord ID: ${testDiscordId}`);

    // Issue 1: Check /unlink problem
    console.log('\n📋 Issue 1: /unlink not finding players...');
    
    // Check if player exists in database
    const [playerCheck] = await pool.query(
      `SELECT id, discord_id, ign, is_active, server_id 
       FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(ign) = LOWER(?)`,
      [testGuildId, testPlayer]
    );

    console.log(`Found ${playerCheck.length} player record(s) for "${testPlayer}":`);
    if (playerCheck.length === 0) {
      console.log('❌ ISSUE: No player records found - this is why /unlink fails');
      console.log('   The player might have been force-linked but not properly recorded');
    } else {
      playerCheck.forEach((player, index) => {
        console.log(`   ${index + 1}. ID: ${player.id}, Discord: ${player.discord_id}, IGN: ${player.ign}, Active: ${player.is_active}, Server: ${player.server_id}`);
      });
      
      // Check if any are active
      const activeRecords = playerCheck.filter(p => p.is_active);
      if (activeRecords.length === 0) {
        console.log('❌ ISSUE: Player records exist but none are active (is_active = false)');
      } else {
        console.log(`✅ Found ${activeRecords.length} active record(s)`);
      }
    }

    // Issue 2: Check regular /link problem
    console.log('\n📋 Issue 2: Regular /link failing...');
    
    // Simulate the link confirmation process
    console.log('🔄 Simulating link confirmation process...');
    
    // Get all servers for this guild (same query as link confirmation)
    const [servers] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [testGuildId]
    );
    
    console.log(`Found ${servers.length} server(s) for linking:`);
    servers.forEach(server => {
      console.log(`   - ${server.nickname} (ID: ${server.id})`);
    });

    if (servers.length === 0) {
      console.log('❌ ISSUE: No servers found - this would cause link to fail');
      return;
    }

    // Test linking process for each server
    let linkedServers = [];
    let errorMessage = null;

    for (const server of servers) {
      console.log(`\n🔄 Testing link for server: ${server.nickname}`);
      
      try {
        // Check if exact link already exists (active) - same query as link confirmation
        const [existingExactLink] = await pool.query(
          'SELECT id, is_active FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND discord_id = ? AND LOWER(ign) = LOWER(?)',
          [testGuildId, server.id, testDiscordId, testPlayer]
        );

        if (existingExactLink.length > 0) {
          const existing = existingExactLink[0];
          if (existing.is_active) {
            console.log('⚠️  Player already linked and active - would reactivate');
            linkedServers.push(server.nickname);
          } else {
            console.log('🔄 Player exists but inactive - would reactivate');
            linkedServers.push(server.nickname);
          }
        } else {
          console.log('✅ No existing link - would create new player record');
          
          // Test if the INSERT would work (without actually inserting)
          try {
            // Just test the guild lookup part
            const [guildTest] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [testGuildId]);
            if (guildTest.length === 0) {
              console.log('❌ ISSUE: Guild not found in database!');
              errorMessage = 'Guild not found';
              break;
            } else {
              console.log(`✅ Guild found: ID ${guildTest[0].id}`);
              linkedServers.push(server.nickname);
            }
          } catch (testError) {
            console.log('❌ ISSUE: Database error during linking test:', testError.message);
            errorMessage = testError.message;
            break;
          }
        }
      } catch (error) {
        console.log('❌ ERROR linking to server:', error.message);
        if (error.message.includes('already linked')) {
          errorMessage = error.message;
          break;
        }
      }
    }

    console.log(`\n📊 Link simulation results:`);
    console.log(`   Linked servers: ${linkedServers.length}`);
    console.log(`   Error message: ${errorMessage || 'None'}`);
    
    if (errorMessage) {
      console.log('❌ ISSUE: Link would fail with error message');
    } else if (linkedServers.length === 0) {
      console.log('❌ ISSUE: Link would fail with "Failed to link account to any servers"');
    } else {
      console.log('✅ Link should succeed');
    }

    // Check for common issues
    console.log('\n🔍 Checking for common issues...');
    
    // Check if guilds table has the right guild
    const [guildCheck] = await pool.query('SELECT id, discord_id, name FROM guilds WHERE discord_id = ?', [testGuildId]);
    if (guildCheck.length === 0) {
      console.log('❌ CRITICAL: Guild not found in guilds table!');
      console.log('   This would cause both /link and /unlink to fail');
      console.log('   Fix: Ensure guild exists in guilds table');
    } else {
      console.log(`✅ Guild exists: ID ${guildCheck[0].id}, Name: ${guildCheck[0].name}`);
    }

    // Check for duplicate players
    const [duplicateCheck] = await pool.query(
      `SELECT discord_id, ign, COUNT(*) as count 
       FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND is_active = true
       GROUP BY discord_id, ign 
       HAVING COUNT(*) > 1`,
      [testGuildId]
    );

    if (duplicateCheck.length > 0) {
      console.log(`⚠️  Found ${duplicateCheck.length} duplicate active player record(s):`);
      duplicateCheck.forEach(dup => {
        console.log(`   Discord: ${dup.discord_id}, IGN: ${dup.ign}, Count: ${dup.count}`);
      });
    }

    console.log('\n🔧 Recommended fixes:');
    console.log('1. For /unlink issue: Check if players are properly recorded with is_active = true');
    console.log('2. For /link issue: Check error logs during link confirmation for specific errors');
    console.log('3. Ensure guilds table has correct entries');
    console.log('4. Check for database connection issues during linking');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugLinkingIssues().catch(console.error);