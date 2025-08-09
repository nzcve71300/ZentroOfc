const pool = require('./src/db');

async function fixKitAuthColumns() {
  try {
    console.log('🔧 SSH: Fixing kit_auth table columns...');

    // Check current structure
    console.log('\n📋 Current kit_auth table structure:');
    const [columns] = await pool.query('DESCRIBE kit_auth');
    columns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Check if discord_id column exists and is NOT NULL
    const discordIdColumn = columns.find(col => col.Field === 'discord_id');
    
    if (discordIdColumn && discordIdColumn.Null === 'NO') {
      console.log('\n🔧 Making discord_id column nullable...');
      await pool.query('ALTER TABLE kit_auth MODIFY COLUMN discord_id BIGINT NULL');
      console.log('✅ discord_id column is now nullable');
    } else if (discordIdColumn) {
      console.log('✅ discord_id column is already nullable');
    } else {
      console.log('✅ discord_id column does not exist');
    }

    // Check if kitlist column exists (old schema)
    const kitlistColumn = columns.find(col => col.Field === 'kitlist');
    
    if (kitlistColumn && kitlistColumn.Null === 'NO') {
      console.log('\n🔧 Making kitlist column nullable...');
      await pool.query('ALTER TABLE kit_auth MODIFY COLUMN kitlist TEXT NULL');
      console.log('✅ kitlist column is now nullable');
    } else if (kitlistColumn) {
      console.log('✅ kitlist column is already nullable');
    } else {
      console.log('✅ kitlist column does not exist');
    }

    // Verify the fix
    console.log('\n✅ Updated kit_auth table structure:');
    const [newColumns] = await pool.query('DESCRIBE kit_auth');
    newColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Test the INSERT that was failing
    console.log('\n🧪 Testing kit authorization INSERT...');
    const testServerId = '1754690822459_bxb3nuglj';
    const testKitName = 'ELITEkit1';
    const testPlayerName = 'nzcve7130';

    try {
      // Check if record already exists
      const [existing] = await pool.query(
        'SELECT id FROM kit_auth WHERE server_id = ? AND kit_name = ? AND LOWER(player_name) = LOWER(?)',
        [testServerId, testKitName, testPlayerName]
      );

      if (existing.length === 0) {
        // Test the INSERT
        await pool.query(
          'INSERT INTO kit_auth (server_id, kit_name, player_name) VALUES (?, ?, ?)',
          [testServerId, testKitName, testPlayerName]
        );
        console.log('✅ Test INSERT successful');

        // Clean up test record
        await pool.query(
          'DELETE FROM kit_auth WHERE server_id = ? AND kit_name = ? AND LOWER(player_name) = LOWER(?)',
          [testServerId, testKitName, testPlayerName]
        );
        console.log('✅ Test record cleaned up');
      } else {
        console.log('✅ Record already exists - INSERT would work');
      }
    } catch (testError) {
      console.log('❌ Test INSERT still failing:', testError.message);
    }

    console.log('\n🎉 kit_auth table fix completed!');
    console.log('💡 /add-to-kit-list should now work properly');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixKitAuthColumns().catch(console.error);