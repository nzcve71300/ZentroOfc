const pool = require('./src/db');

async function checkDiscordIdCorruption() {
  try {
    console.log('🔍 Checking Discord ID Corruption...\n');

    // Check the database schema
    console.log('1. Checking database schema...');
    
    const [schemaInfo] = await pool.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'zentro_bot' 
      AND TABLE_NAME = 'players'
      AND COLUMN_NAME = 'discord_id'
    `);

    console.log('Discord ID column schema:');
    schemaInfo.forEach(col => {
      console.log(`   Column: ${col.COLUMN_NAME}`);
      console.log(`   Data Type: ${col.DATA_TYPE}`);
      console.log(`   Column Type: ${col.COLUMN_TYPE}`);
      console.log(`   Nullable: ${col.IS_NULLABLE}`);
      console.log(`   Default: ${col.COLUMN_DEFAULT}`);
      console.log(`   Max Length: ${col.CHARACTER_MAXIMUM_LENGTH}`);
    });

    // Check for the problematic Discord ID
    console.log('\n2. Checking the problematic Discord ID...');
    
    const problematicId = '1241672654193426434';
    
    const [problematicRecords] = await pool.query(`
      SELECT 
        p.*,
        rs.nickname,
        g.discord_id as guild_discord_id,
        HEX(p.discord_id) as hex_value,
        LENGTH(p.discord_id) as length,
        CAST(p.discord_id AS CHAR) as char_value
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id = ?
      ORDER BY p.linked_at DESC
    `, [problematicId]);

    console.log(`Found ${problematicRecords.length} records for Discord ID ${problematicId}:`);
    problematicRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. IGN: "${record.ign}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Discord ID (raw): ${record.discord_id}`);
      console.log(`      Discord ID (char): ${record.char_value}`);
      console.log(`      Discord ID (hex): ${record.hex_value}`);
      console.log(`      Discord ID (length): ${record.length}`);
      console.log(`      Linked: ${record.linked_at}`);
      console.log('');
    });

    // Check for any Discord IDs that might be getting truncated
    console.log('3. Checking for Discord ID truncation...');
    
    const [truncatedIds] = await pool.query(`
      SELECT 
        discord_id,
        LENGTH(discord_id) as length,
        COUNT(*) as count,
        GROUP_CONCAT(ign) as igns
      FROM players 
      WHERE discord_id IS NOT NULL 
      AND LENGTH(discord_id) < 17
      GROUP BY discord_id, LENGTH(discord_id)
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log(`Found ${truncatedIds.length} potentially truncated Discord IDs:`);
    truncatedIds.forEach(id => {
      console.log(`   Discord ID: "${id.discord_id}" (Length: ${id.length}) has ${id.count} records`);
      console.log(`   IGNs: ${id.igns}`);
    });

    // Check for any Discord IDs that might be getting corrupted during storage
    console.log('\n4. Checking for Discord ID corruption patterns...');
    
    const [corruptionTest] = await pool.query(`
      SELECT 
        discord_id,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT ign ORDER BY ign) as unique_igns,
        GROUP_CONCAT(DISTINCT guild_id ORDER BY guild_id) as guild_ids
      FROM players 
      WHERE discord_id IS NOT NULL 
      GROUP BY discord_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log(`Found ${corruptionTest.length} Discord IDs with multiple records:`);
    corruptionTest.forEach(id => {
      console.log(`   Discord ID: "${id.discord_id}" has ${id.count} records`);
      console.log(`   IGNs: ${id.unique_igns}`);
      console.log(`   Guild IDs: ${id.guild_ids}`);
      console.log('');
    });

    // Test Discord ID storage and retrieval
    console.log('5. Testing Discord ID storage and retrieval...');
    
    const testDiscordId = '1234567890123456789';
    const testIgn = 'TEST_USER_CORRUPTION_CHECK';
    
    // Try to insert a test record
    try {
      await pool.query(`
        INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
        VALUES (1, 'test_server', ?, ?, NOW(), true)
      `, [testDiscordId, testIgn]);
      
      console.log(`   ✅ Successfully inserted test record with Discord ID: ${testDiscordId}`);
      
      // Try to retrieve it
      const [retrievedRecord] = await pool.query(`
        SELECT discord_id, ign, LENGTH(discord_id) as length, HEX(discord_id) as hex_value
        FROM players 
        WHERE ign = ?
      `, [testIgn]);
      
      if (retrievedRecord.length > 0) {
        const record = retrievedRecord[0];
        console.log(`   ✅ Successfully retrieved test record:`);
        console.log(`      Discord ID: ${record.discord_id}`);
        console.log(`      IGN: ${record.ign}`);
        console.log(`      Length: ${record.length}`);
        console.log(`      Hex: ${record.hex_value}`);
        
        // Check if the Discord ID matches
        if (record.discord_id.toString() === testDiscordId) {
          console.log(`   ✅ Discord ID matches exactly`);
        } else {
          console.log(`   ❌ Discord ID mismatch! Expected: ${testDiscordId}, Got: ${record.discord_id}`);
        }
      }
      
      // Clean up test record
      await pool.query('DELETE FROM players WHERE ign = ?', [testIgn]);
      console.log(`   ✅ Cleaned up test record`);
      
    } catch (error) {
      console.log(`   ❌ Error testing Discord ID storage: ${error.message}`);
    }

    console.log('\n6. CRITICAL ANALYSIS:');
    console.log('   Based on the diagnostic results, the issue appears to be:');
    console.log('   - Different Discord users are being assigned the same Discord ID');
    console.log('   - This suggests either:');
    console.log('     1. Discord ID truncation during storage');
    console.log('     2. Database encoding issues');
    console.log('     3. Bot logic errors in Discord ID handling');
    console.log('     4. Race conditions during linking');
    console.log('     5. Invisible characters corrupting the Discord ID');
    
    console.log('\n7. RECOMMENDATIONS:');
    console.log('   - Check the Discord ID column type in the database');
    console.log('   - Verify Discord ID storage format');
    console.log('   - Add validation to ensure Discord IDs are unique');
    console.log('   - Check for any bot logic that might be corrupting Discord IDs');
    console.log('   - Add logging to track Discord ID changes');

  } catch (error) {
    console.error('❌ Error checking Discord ID corruption:', error);
  } finally {
    await pool.end();
  }
}

checkDiscordIdCorruption();
