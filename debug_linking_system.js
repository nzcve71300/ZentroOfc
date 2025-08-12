const pool = require('./src/db');

async function debugLinkingSystem() {
  try {
    console.log('🔍 Debugging linking system issues...');
    
    // Check the specific case mentioned
    console.log('\n📋 Step 1: Checking "kushstreet27" case...');
    const [kushstreetRecords] = await pool.query(`
      SELECT p.*, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign = 'kushstreet27'
      ORDER BY s.nickname, p.linked_at DESC
    `);
    
    console.log(`Found ${kushstreetRecords.length} records for "kushstreet27":`);
    kushstreetRecords.forEach((record, index) => {
      console.log(`\n${index + 1}. Record:`);
      console.log(`   ID: ${record.id}`);
      console.log(`   Server: ${record.server_name} (${record.server_id})`);
      console.log(`   Discord ID: ${record.discord_id || 'NULL'}`);
      console.log(`   Linked at: ${record.linked_at || 'NULL'}`);
      console.log(`   Is Active: ${record.is_active}`);
    });
    
    // Check what the bot's linking logic sees
    console.log('\n📋 Step 2: Simulating bot linking logic for "kushstreet27"...');
    
    // Simulate the exact query the bot uses when checking for existing links
    const [existingLinks] = await pool.query(`
      SELECT p.*, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign = 'kushstreet27'
      AND p.discord_id IS NOT NULL
      AND p.discord_id != ''
      AND p.is_active = 1
    `);
    
    console.log(`Active linked records for "kushstreet27": ${existingLinks.length}`);
    existingLinks.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.ign} on ${record.server_name} (Discord: ${record.discord_id})`);
    });
    
    // Check for any inactive records that might be causing issues
    console.log('\n📋 Step 3: Checking inactive records for "kushstreet27"...');
    const [inactiveRecords] = await pool.query(`
      SELECT p.*, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign = 'kushstreet27'
      AND (p.is_active = 0 OR p.is_active IS NULL)
    `);
    
    console.log(`Inactive records for "kushstreet27": ${inactiveRecords.length}`);
    inactiveRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.ign} on ${record.server_name} (Active: ${record.is_active})`);
    });
    
    // Check the bot's linking code logic
    console.log('\n📋 Step 4: Checking bot linking logic...');
    
    // Simulate the guild lookup
    const guildDiscordId = '1348735121481535548'; // BLOODRUST guild
    const [guildResult] = await pool.query(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [guildDiscordId]
    );
    
    if (guildResult.length > 0) {
      const guildId = guildResult[0].id;
      console.log(`✅ Found guild ID: ${guildId} for Discord ID: ${guildDiscordId}`);
      
      // Simulate the exact query the bot uses
      const [botQueryResult] = await pool.query(`
        SELECT p.id, p.is_active 
        FROM players p 
        WHERE p.guild_id = ? 
        AND p.server_id = (SELECT id FROM rust_servers WHERE nickname = 'BLOODRUST' AND guild_id = ? LIMIT 1)
        AND LOWER(p.ign) = LOWER('kushstreet27')
      `, [guildId, guildId]);
      
      console.log(`Bot query result for "kushstreet27": ${botQueryResult.length} records`);
      botQueryResult.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}, Active: ${record.is_active}`);
      });
    } else {
      console.log(`❌ Guild not found for Discord ID: ${guildDiscordId}`);
    }
    
    // Check for any database inconsistencies
    console.log('\n📋 Step 5: Checking for database inconsistencies...');
    
    // Check for records with NULL is_active
    const [nullActiveRecords] = await pool.query(`
      SELECT COUNT(*) as count FROM players WHERE is_active IS NULL
    `);
    console.log(`Records with NULL is_active: ${nullActiveRecords[0].count}`);
    
    // Check for records with empty discord_id but linked_at timestamp
    const [inconsistentRecords] = await pool.query(`
      SELECT COUNT(*) as count FROM players 
      WHERE (discord_id IS NULL OR discord_id = '') 
      AND linked_at IS NOT NULL
    `);
    console.log(`Records with linked_at but no discord_id: ${inconsistentRecords[0].count}`);
    
    // Check for records with discord_id but no linked_at
    const [inconsistentRecords2] = await pool.query(`
      SELECT COUNT(*) as count FROM players 
      WHERE discord_id IS NOT NULL 
      AND discord_id != '' 
      AND linked_at IS NULL
    `);
    console.log(`Records with discord_id but no linked_at: ${inconsistentRecords2[0].count}`);
    
    console.log('\n🎯 DIAGNOSIS COMPLETE!');
    console.log('Check the bot logs for the exact error message when linking fails.');
    console.log('The issue might be in the bot\'s linking logic or database state.');
    
  } catch (error) {
    console.error('❌ Error debugging linking system:', error);
  } finally {
    await pool.end();
  }
}

debugLinkingSystem();