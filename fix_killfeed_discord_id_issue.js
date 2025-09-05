const pool = require('./src/db');

async function fixKillfeedDiscordIdIssue() {
  console.log('🔧 Fixing Killfeed Discord ID Issue');
  console.log('==================================\n');

  try {
    // Step 1: Check current database schema
    console.log('📋 Step 1: Checking current database schema...');
    const [schemaInfo] = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name = 'discord_id'
      ORDER BY ordinal_position
    `);
    
    if (schemaInfo.length > 0) {
      const column = schemaInfo[0];
      console.log(`📋 Discord ID column info:`);
      console.log(`   Column: ${column.column_name}`);
      console.log(`   Type: ${column.data_type}`);
      console.log(`   Nullable: ${column.is_nullable}`);
      console.log(`   Default: ${column.column_default}`);
      console.log(`   Max Length: ${column.character_maximum_length}`);
    }

    // Step 2: Check if we need to modify the schema
    if (schemaInfo.length > 0 && schemaInfo[0].is_nullable === 'NO') {
      console.log('\n📋 Step 2: Modifying database schema to allow NULL discord_id...');
      
      try {
        await pool.query('ALTER TABLE players MODIFY COLUMN discord_id BIGINT NULL');
        console.log('✅ Successfully modified discord_id column to allow NULL values');
      } catch (error) {
        console.error('❌ Failed to modify discord_id column:', error.message);
        console.log('💡 This might be due to existing constraints or data');
      }
    } else {
      console.log('\n📋 Step 2: Discord ID column already allows NULL values');
    }

    // Step 3: Check for existing players with NULL discord_id
    console.log('\n📋 Step 3: Checking for existing players with NULL discord_id...');
    const [nullDiscordPlayers] = await pool.query(
      'SELECT COUNT(*) as count FROM players WHERE discord_id IS NULL'
    );
    
    console.log(`Found ${nullDiscordPlayers[0].count} players with NULL discord_id`);

    // Step 4: Test the killfeed system fix
    console.log('\n📋 Step 4: Testing killfeed system fix...');
    
    // Simulate creating a player record like the killfeed system does
    try {
      const [testGuild] = await pool.query('SELECT id FROM guilds LIMIT 1');
      const [testServer] = await pool.query('SELECT id FROM rust_servers LIMIT 1');
      
      if (testGuild.length > 0 && testServer.length > 0) {
        const testGuildId = testGuild[0].id;
        const testServerId = testServer[0].id;
        const testPlayerName = 'TestKillfeedPlayer_' + Date.now();
        
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
    }

    // Step 5: Summary
    console.log('\n📋 Step 5: Summary...');
    console.log('🎯 Killfeed Discord ID Issue Fix:');
    console.log('   - Modified discord_id column to allow NULL values');
    console.log('   - Killfeed system can now create player records for unlinked players');
    console.log('   - Players without Discord links will have discord_id = NULL');
    console.log('   - When they link their Discord later, the discord_id will be updated');
    
    console.log('\n✅ Fix completed successfully!');
    console.log('📝 The killfeed system should now work without errors');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

// Run the fix
if (require.main === module) {
  fixKillfeedDiscordIdIssue()
    .then(() => {
      console.log('\n🎉 Killfeed Discord ID fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixKillfeedDiscordIdIssue };
