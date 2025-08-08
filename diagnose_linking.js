const pool = require('./src/db');

async function diagnoseLinkingSystem() {
  console.log('🔍 Diagnosing linking system...\n');
  
  try {
    // Check database structure
    console.log('📋 Checking database structure...');
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'zentro_bot' AND TABLE_NAME = 'players'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Players table structure:');
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''}`);
    });
    
    // Check for duplicate records
    console.log('\n🔍 Checking for duplicate records...');
    const [duplicates] = await pool.query(`
      SELECT 
        guild_id, server_id, discord_id, ign, COUNT(*) as count
      FROM players 
      WHERE is_active = true
      GROUP BY guild_id, server_id, discord_id, ign
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} duplicate active records:`);
      duplicates.forEach(dup => {
        console.log(`  - Guild: ${dup.guild_id}, Server: ${dup.server_id}, Discord: ${dup.discord_id}, IGN: ${dup.ign} (${dup.count} times)`);
      });
    } else {
      console.log('✅ No duplicate active records found');
    }
    
    // Check for conflicting links
    console.log('\n🔍 Checking for conflicting links...');
    const [conflicts] = await pool.query(`
      SELECT 
        p1.discord_id, p1.ign, p1.server_id,
        p2.discord_id as other_discord_id, p2.ign as other_ign
      FROM players p1
      JOIN players p2 ON p1.server_id = p2.server_id 
        AND p1.guild_id = p2.guild_id
        AND p1.id != p2.id
        AND p1.is_active = true 
        AND p2.is_active = true
      WHERE (p1.discord_id = p2.discord_id AND p1.ign != p2.ign)
         OR (p1.ign = p2.ign AND p1.discord_id != p2.discord_id)
    `);
    
    if (conflicts.length > 0) {
      console.log(`❌ Found ${conflicts.length} conflicting links:`);
      conflicts.forEach(conflict => {
        console.log(`  - Discord ${conflict.discord_id}: "${conflict.ign}" vs "${conflict.other_ign}" on server ${conflict.server_id}`);
      });
    } else {
      console.log('✅ No conflicting links found');
    }
    
    // Check economy records
    console.log('\n🔍 Checking economy records...');
    const [orphanedEconomy] = await pool.query(`
      SELECT e.player_id, e.balance
      FROM economy e
      LEFT JOIN players p ON e.player_id = p.id
      WHERE p.id IS NULL
    `);
    
    if (orphanedEconomy.length > 0) {
      console.log(`❌ Found ${orphanedEconomy.length} orphaned economy records`);
    } else {
      console.log('✅ No orphaned economy records found');
    }
    
    // Check missing economy records
    const [missingEconomy] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id
      FROM players p
      WHERE p.is_active = true
      AND NOT EXISTS (SELECT 1 FROM economy e WHERE e.player_id = p.id)
    `);
    
    if (missingEconomy.length > 0) {
      console.log(`❌ Found ${missingEconomy.length} active players without economy records:`);
      missingEconomy.forEach(player => {
        console.log(`  - ${player.ign} (Discord: ${player.discord_id})`);
      });
    } else {
      console.log('✅ All active players have economy records');
    }
    
    // Summary statistics
    console.log('\n📊 Summary Statistics:');
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_players,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_players,
        SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_players,
        COUNT(DISTINCT discord_id) as unique_discord_ids,
        COUNT(DISTINCT ign) as unique_igns
      FROM players
    `);
    
    const stat = stats[0];
    console.log(`  Total players: ${stat.total_players}`);
    console.log(`  Active players: ${stat.active_players}`);
    console.log(`  Inactive players: ${stat.inactive_players}`);
    console.log(`  Unique Discord IDs: ${stat.unique_discord_ids}`);
    console.log(`  Unique IGNs: ${stat.unique_igns}`);
    
    console.log('\n🎯 Recommendations:');
    if (duplicates.length > 0 || conflicts.length > 0) {
      console.log('  ❌ Run the linking fix script to clean up the database');
    } else {
      console.log('  ✅ Database looks clean - linking should work properly');
    }
    
    if (orphanedEconomy.length > 0 || missingEconomy.length > 0) {
      console.log('  ❌ Economy records need to be cleaned up');
    } else {
      console.log('  ✅ Economy records are properly linked');
    }
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await pool.end();
  }
}

diagnoseLinkingSystem(); 