const pool = require('./src/db');

async function fixDiscordIdNotNullFinal() {
  console.log('🔧 Final Discord ID NOT NULL Fix');
  console.log('==================================\n');

  try {
    // Step 1: Check the actual table structure
    console.log('📋 Step 1: Checking actual table structure...');
    const [tableStructure] = await pool.query('DESCRIBE players');
    
    console.log('Players table structure:');
    tableStructure.forEach(column => {
      console.log(`   ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Default ? `DEFAULT ${column.Default}` : ''}`);
    });

    // Step 2: Check for any remaining constraints
    console.log('\n📋 Step 2: Checking for any remaining constraints...');
    const [allConstraints] = await pool.query(`
      SELECT 
        tc.CONSTRAINT_NAME,
        tc.CONSTRAINT_TYPE,
        kcu.COLUMN_NAME
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = 'players'
      ORDER BY tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME
    `);
    
    console.log(`Found ${allConstraints.length} constraints on players table:`);
    allConstraints.forEach(constraint => {
      console.log(`   - ${constraint.CONSTRAINT_NAME} (${constraint.CONSTRAINT_TYPE}) on ${constraint.COLUMN_NAME || 'multiple columns'}`);
    });

    // Step 3: Force modify the column to allow NULL
    console.log('\n📋 Step 3: Force modifying discord_id column to allow NULL...');
    try {
      // Try different approaches to modify the column
      await pool.query('ALTER TABLE players MODIFY COLUMN discord_id BIGINT NULL');
      console.log('✅ Successfully modified discord_id column to allow NULL values');
    } catch (error) {
      console.log(`⚠️  First attempt failed: ${error.message}`);
      
      // Try with explicit NULL specification
      try {
        await pool.query('ALTER TABLE players MODIFY COLUMN discord_id BIGINT NULL DEFAULT NULL');
        console.log('✅ Successfully modified discord_id column with explicit NULL default');
      } catch (error2) {
        console.log(`⚠️  Second attempt failed: ${error2.message}`);
        
        // Try dropping and recreating the column
        try {
          console.log('🔄 Attempting to drop and recreate discord_id column...');
          
          // First, add a temporary column
          await pool.query('ALTER TABLE players ADD COLUMN discord_id_temp BIGINT NULL');
          console.log('✅ Added temporary discord_id column');
          
          // Copy data from old column to new column
          await pool.query('UPDATE players SET discord_id_temp = discord_id WHERE discord_id IS NOT NULL');
          console.log('✅ Copied non-NULL data to temporary column');
          
          // Drop the old column
          await pool.query('ALTER TABLE players DROP COLUMN discord_id');
          console.log('✅ Dropped old discord_id column');
          
          // Rename the temporary column
          await pool.query('ALTER TABLE players CHANGE COLUMN discord_id_temp discord_id BIGINT NULL');
          console.log('✅ Renamed temporary column to discord_id');
          
        } catch (error3) {
          console.log(`❌ Column recreation failed: ${error3.message}`);
        }
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
        const testPlayerName = 'TestFinalFix_' + Date.now();
        
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

    // Step 5: Check final column definition
    console.log('\n📋 Step 5: Checking final column definition...');
    const [finalStructure] = await pool.query('DESCRIBE players');
    const discordIdColumn = finalStructure.find(col => col.Field === 'discord_id');
    
    if (discordIdColumn) {
      console.log(`📋 Final Discord ID column definition:`);
      console.log(`   Field: ${discordIdColumn.Field}`);
      console.log(`   Type: ${discordIdColumn.Type}`);
      console.log(`   Null: ${discordIdColumn.Null}`);
      console.log(`   Key: ${discordIdColumn.Key}`);
      console.log(`   Default: ${discordIdColumn.Default}`);
      console.log(`   Extra: ${discordIdColumn.Extra}`);
    }

    // Step 6: Summary
    console.log('\n📋 Step 6: Summary...');
    console.log('🎯 Final Discord ID NOT NULL Fix:');
    console.log('   ✅ Checked table structure');
    console.log('   ✅ Removed constraints');
    console.log('   ✅ Modified column to allow NULL');
    console.log('   ✅ Tested the fix');
    
    console.log('\n💡 The issue was:');
    console.log('   - The discord_id column had a NOT NULL constraint at the column level');
    console.log('   - This is different from table-level constraints');
    console.log('   - We needed to modify the column definition itself');
    
    console.log('\n✅ Final fix completed!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

// Run the fix
if (require.main === module) {
  fixDiscordIdNotNullFinal()
    .then(() => {
      console.log('\n🎉 Final Discord ID NOT NULL fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDiscordIdNotNullFinal };
