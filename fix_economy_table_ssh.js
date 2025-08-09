const pool = require('./src/db');

async function fixEconomyTable() {
  try {
    console.log('🔧 SSH: Fixing Economy Table Schema...');

    // First, check the current economy table structure
    console.log('\n📋 Current economy table structure:');
    const [columns] = await pool.query('DESCRIBE economy');
    columns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Check if guild_id column exists
    const hasGuildId = columns.some(col => col.Field === 'guild_id');
    
    if (!hasGuildId) {
      console.log('\n❌ guild_id column missing from economy table');
      console.log('🔧 Adding guild_id column...');
      
      // Add the guild_id column
      await pool.query('ALTER TABLE economy ADD COLUMN guild_id INT NOT NULL AFTER player_id');
      console.log('✅ Added guild_id column');
      
      // Add foreign key constraint
      await pool.query('ALTER TABLE economy ADD FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE');
      console.log('✅ Added foreign key constraint');
      
    } else {
      console.log('\n✅ guild_id column already exists');
    }

    // Now we need to populate existing economy records with correct guild_id
    console.log('\n🔄 Updating existing economy records with correct guild_id...');
    
    // Get all economy records that need guild_id populated
    const [economyRecords] = await pool.query(`
      SELECT e.id, e.player_id, p.guild_id 
      FROM economy e 
      JOIN players p ON e.player_id = p.id 
      WHERE e.guild_id IS NULL OR e.guild_id = 0
    `);
    
    console.log(`Found ${economyRecords.length} economy records to update`);
    
    for (const record of economyRecords) {
      await pool.query(
        'UPDATE economy SET guild_id = ? WHERE id = ?',
        [record.guild_id, record.id]
      );
    }
    
    console.log(`✅ Updated ${economyRecords.length} economy records`);

    // Verify the fix
    console.log('\n🔍 Verifying economy table structure:');
    const [newColumns] = await pool.query('DESCRIBE economy');
    newColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Test the INSERT that was failing
    console.log('\n🧪 Testing economy INSERT with guild_id...');
    
    // Get a sample player to test with
    const [samplePlayer] = await pool.query('SELECT id, guild_id FROM players LIMIT 1');
    
    if (samplePlayer.length > 0) {
      const testPlayerId = samplePlayer[0].id;
      const testGuildId = samplePlayer[0].guild_id;
      
      // Check if economy record already exists for this player
      const [existingEconomy] = await pool.query('SELECT id FROM economy WHERE player_id = ?', [testPlayerId]);
      
      if (existingEconomy.length === 0) {
        // Test the INSERT that was failing
        await pool.query('INSERT INTO economy (player_id, guild_id, balance) VALUES (?, ?, ?)', [testPlayerId, testGuildId, 0]);
        console.log('✅ Test INSERT successful');
        
        // Clean up test record
        await pool.query('DELETE FROM economy WHERE player_id = ? AND balance = 0', [testPlayerId]);
        console.log('✅ Test record cleaned up');
      } else {
        console.log('✅ Economy table structure is correct (player already has economy record)');
      }
    }

    console.log('\n🎉 Economy table fix completed!');
    console.log('💡 The /link command should now work completely');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixEconomyTable().catch(console.error);