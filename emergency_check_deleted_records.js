const pool = require('./src/db');

async function emergencyCheckDeletedRecords() {
  try {
    console.log('🚨 EMERGENCY CHECK: Assessing Database Damage...\n');

    console.log('1. Checking current state of players table...');
    
    // Check how many records we have now
    const [currentCount] = await pool.query('SELECT COUNT(*) as count FROM players');
    console.log(`Current players table has ${currentCount[0].count} records`);

    // Check how many active records we have
    const [activeCount] = await pool.query('SELECT COUNT(*) as count FROM players WHERE is_active = true');
    console.log(`Current active players: ${activeCount[0].count} records`);

    // Check if there are any records with null Discord IDs (should be 0 after our fix)
    const [nullCount] = await pool.query('SELECT COUNT(*) as count FROM players WHERE discord_id IS NULL AND is_active = true');
    console.log(`Records with null Discord IDs: ${nullCount[0].count}`);

    console.log('\n2. Checking for any remaining corrupted records...');
    
    // Check for any other potential issues
    const [emptyIgnCount] = await pool.query('SELECT COUNT(*) as count FROM players WHERE (ign IS NULL OR ign = "") AND is_active = true');
    console.log(`Records with empty IGNs: ${emptyIgnCount[0].count}`);

    const [emptyServerCount] = await pool.query('SELECT COUNT(*) as count FROM players WHERE (server_id IS NULL OR server_id = "") AND is_active = true');
    console.log(`Records with empty server IDs: ${emptyServerCount[0].count}`);

    console.log('\n3. Checking recent activity...');
    
    // Check recent linking activity
    const [recentLinks] = await pool.query(`
      SELECT p.ign, p.discord_id, rs.nickname, p.linked_at
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.is_active = true
      ORDER BY p.linked_at DESC
      LIMIT 10
    `);

    console.log(`Recent 10 active links:`);
    recentLinks.forEach((link, index) => {
      console.log(`   ${index + 1}. IGN: "${link.ign}" (Discord ID: ${link.discord_id}) on ${link.nickname} - ${link.linked_at}`);
    });

    console.log('\n4. Checking if jokashro is still blocked...');
    
    // Check the jokashro case specifically
    const testIgn = 'jokashro';
    const testGuildId = '1403300500719538227';
    
    const [jokashroRecords] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?) 
      AND p.is_active = true
    `, [testGuildId, testIgn]);

    console.log(`IGN "${testIgn}" has ${jokashroRecords.length} active links in Mals Mayhem 1 guild:`);
    jokashroRecords.forEach(link => {
      console.log(`   - Discord ID: "${link.discord_id}" on ${link.nickname}`);
    });

    console.log('\n5. CRITICAL ASSESSMENT:');
    
    if (currentCount[0].count === 0) {
      console.log('🚨 CRITICAL: ALL RECORDS WERE DELETED!');
      console.log('   - This is a major disaster');
      console.log('   - We need to restore from backup immediately');
    } else if (currentCount[0].count < 10) {
      console.log('🚨 MAJOR ISSUE: Most records were deleted!');
      console.log('   - Only a few records remain');
      console.log('   - This suggests the deletion was too broad');
    } else if (nullCount[0].count === 0) {
      console.log('✅ GOOD: Null Discord ID fix worked correctly');
      console.log('   - No corrupted records remain');
      console.log('   - The fix was successful');
    } else {
      console.log('⚠️ PARTIAL: Some issues remain');
      console.log('   - Some corrupted records still exist');
    }

    console.log('\n6. IMMEDIATE ACTIONS NEEDED:');
    if (currentCount[0].count === 0 || currentCount[0].count < 10) {
      console.log('   🚨 RESTORE FROM BACKUP IMMEDIATELY');
      console.log('   🚨 Check if you have a recent database backup');
      console.log('   🚨 Contact your hosting provider for recovery options');
    } else {
      console.log('   ✅ Database appears to be in good condition');
      console.log('   ✅ The fix worked as intended');
      console.log('   ✅ Only corrupted records were removed');
    }

  } catch (error) {
    console.error('❌ Error in emergency check:', error);
  } finally {
    await pool.end();
  }
}

emergencyCheckDeletedRecords();
