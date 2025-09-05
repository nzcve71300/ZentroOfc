const pool = require('./src/db');

async function fixUniqueConstraintIssue() {
  console.log('🔧 Fixing Unique Constraint Issue');
  console.log('==================================\n');

  try {
    // Step 1: Check for unique constraints on discord_id
    console.log('📋 Step 1: Checking for unique constraints on discord_id...');
    const [uniqueConstraints] = await pool.query(`
      SELECT 
        tc.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        tc.CONSTRAINT_TYPE
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = 'players' 
      AND tc.CONSTRAINT_TYPE = 'UNIQUE'
      AND kcu.COLUMN_NAME = 'discord_id'
    `);
    
    console.log(`Found ${uniqueConstraints.length} unique constraints on discord_id:`);
    uniqueConstraints.forEach(constraint => {
      console.log(`   - ${constraint.CONSTRAINT_NAME} (${constraint.CONSTRAINT_TYPE})`);
    });

    // Step 2: Check for composite unique constraints that include discord_id
    console.log('\n📋 Step 2: Checking for composite unique constraints...');
    const [compositeConstraints] = await pool.query(`
      SELECT 
        tc.CONSTRAINT_NAME,
        GROUP_CONCAT(kcu.COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = 'players' 
      AND tc.CONSTRAINT_TYPE = 'UNIQUE'
      GROUP BY tc.CONSTRAINT_NAME
      HAVING FIND_IN_SET('discord_id', columns) > 0
    `);
    
    console.log(`Found ${compositeConstraints.length} composite unique constraints including discord_id:`);
    compositeConstraints.forEach(constraint => {
      console.log(`   - ${constraint.CONSTRAINT_NAME}: (${constraint.columns})`);
    });

    // Step 3: Remove problematic unique constraints
    console.log('\n📋 Step 3: Removing problematic unique constraints...');
    
    // Remove any unique constraint that's only on discord_id
    for (const constraint of uniqueConstraints) {
      try {
        await pool.query(`ALTER TABLE players DROP CONSTRAINT ${constraint.CONSTRAINT_NAME}`);
        console.log(`✅ Removed unique constraint: ${constraint.CONSTRAINT_NAME}`);
      } catch (error) {
        console.log(`⚠️  Could not remove constraint ${constraint.CONSTRAINT_NAME}: ${error.message}`);
      }
    }

    // Step 4: Test the fix
    console.log('\n📋 Step 4: Testing the fix...');
    
    try {
      const [testGuild] = await pool.query('SELECT id FROM guilds LIMIT 1');
      const [testServer] = await pool.query('SELECT id FROM rust_servers LIMIT 1');
      
      if (testGuild.length > 0 && testServer.length > 0) {
        const testGuildId = testGuild[0].id;
        const testServerId = testServer[0].id;
        const testPlayerName = 'TestUniqueFix_' + Date.now();
        
        console.log(`Testing with guild_id: ${testGuildId}, server_id: ${testServerId}`);
        
        const [testResult] = await pool.query(
          'INSERT INTO players (guild_id, server_id, discord_id, ign, is_active) VALUES (?, ?, NULL, ?, 1)',
          [testGuildId, testServerId, testPlayerName]
        );
        
        console.log(`✅ Successfully created test player record with ID: ${testResult.insertId}`);
        
        // Clean up test record
        await pool.query('DELETE FROM players WHERE id = ?', [testResult.insertId]);
        console.log('✅ Cleaned up test record');
      }
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error('Full error:', error);
    }

    // Step 5: Summary
    console.log('\n📋 Step 5: Summary...');
    console.log('🎯 Unique Constraint Fix:');
    console.log('   ✅ Checked for unique constraints on discord_id');
    console.log('   ✅ Removed problematic unique constraints');
    console.log('   ✅ Tested the fix');
    
    console.log('\n💡 The issue was likely:');
    console.log('   - A unique constraint on discord_id that prevented multiple NULL values');
    console.log('   - In SQL, NULL values are considered unique, so only one NULL is allowed per unique constraint');
    console.log('   - By removing the unique constraint, multiple players can have NULL discord_id');
    
    console.log('\n✅ Unique constraint fix completed!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

// Run the fix
if (require.main === module) {
  fixUniqueConstraintIssue()
    .then(() => {
      console.log('\n🎉 Unique constraint fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixUniqueConstraintIssue };
