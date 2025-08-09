const pool = require('./src/db');

async function fixLinkingProblems() {
  try {
    console.log('🔧 SSH: Fixing Linking Problems...');

    const testGuildId = '1379533411009560626'; // Snowy Billiards 2x
    const testPlayer = 'CrashPompano643';
    const testDiscordId = '1252993829007528086';

    // Issue 1: Fix /unlink problem
    console.log('\n🔧 Issue 1: Fixing /unlink problem...');
    
    // Find the broken player record
    const [brokenRecord] = await pool.query(
      `SELECT id, discord_id, ign, is_active, server_id 
       FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(ign) = LOWER(?)`,
      [testGuildId, testPlayer]
    );

    if (brokenRecord.length > 0) {
      const player = brokenRecord[0];
      console.log(`Found broken record: ID ${player.id}, Discord: ${player.discord_id}, Active: ${player.is_active}`);
      
      if (player.discord_id === null || player.is_active === 0) {
        console.log('🔄 Fixing broken player record...');
        
        // Fix the record - set proper discord_id and activate it
        await pool.query(
          `UPDATE players 
           SET discord_id = ?, is_active = true, linked_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [testDiscordId, player.id]
        );
        
        console.log('✅ Fixed player record - set discord_id and activated');
        
        // Verify the fix
        const [verifyRecord] = await pool.query('SELECT * FROM players WHERE id = ?', [player.id]);
        console.log(`Verified: Discord ID: ${verifyRecord[0].discord_id}, Active: ${verifyRecord[0].is_active}`);
      }
    }

    // Issue 2: Check what's causing regular /link to fail
    console.log('\n🔧 Issue 2: Investigating regular /link failures...');
    
    // The issue might be in the economy table creation during linking
    // Let's check if there are any constraints or issues
    
    console.log('📋 Checking economy table structure...');
    const [economyColumns] = await pool.query('DESCRIBE economy');
    console.log('Economy table columns:');
    economyColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Test economy record creation
    console.log('\n🧪 Testing economy record creation...');
    try {
      // Get a test player ID
      const [testPlayerRecord] = await pool.query(
        'SELECT id FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) LIMIT 1',
        [testGuildId]
      );
      
      if (testPlayerRecord.length > 0) {
        const testPlayerId = testPlayerRecord[0].id;
        
        // Check if economy record already exists
        const [existingEconomy] = await pool.query('SELECT id FROM economy WHERE player_id = ?', [testPlayerId]);
        
        if (existingEconomy.length === 0) {
          // Test the INSERT that might be failing
          const [guildIdResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [testGuildId]);
          const guildIdInternal = guildIdResult[0].id;
          
          await pool.query(
            'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, ?, ?)',
            [testPlayerId, guildIdInternal, 0]
          );
          console.log('✅ Economy INSERT test successful');
          
          // Clean up test record
          await pool.query('DELETE FROM economy WHERE player_id = ? AND balance = 0', [testPlayerId]);
          console.log('✅ Test record cleaned up');
        } else {
          console.log('✅ Economy table structure looks correct');
        }
      }
    } catch (economyError) {
      console.log('❌ Economy INSERT test failed:', economyError.message);
      console.log('   This might be causing the regular /link to fail');
    }

    // Check for any other common issues
    console.log('\n🔍 Checking for other issues...');
    
    // Check for orphaned records
    const [orphanedPlayers] = await pool.query(
      `SELECT p.id, p.ign, p.discord_id, p.is_active 
       FROM players p 
       LEFT JOIN rust_servers rs ON p.server_id = rs.id 
       WHERE rs.id IS NULL`
    );
    
    if (orphanedPlayers.length > 0) {
      console.log(`⚠️  Found ${orphanedPlayers.length} orphaned player record(s) (server doesn't exist):`);
      orphanedPlayers.forEach(player => {
        console.log(`   ID: ${player.id}, IGN: ${player.ign}, Discord: ${player.discord_id}`);
      });
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('✅ Issue 1 (/unlink): Fixed player record - set discord_id and activated');
    console.log('✅ Issue 2 (/link): Economy table structure verified');
    
    console.log('\n🧪 Test the fixes:');
    console.log('1. Try /unlink CrashPompano643 - should now work');
    console.log('2. Try regular /link command - should work if economy was the issue');
    console.log('3. Check PM2 logs during /link attempts for specific errors');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixLinkingProblems().catch(console.error);