const pool = require('./src/db');

async function preventiveMaintenance() {
  console.log('🔧 Running preventive maintenance checks...\n');
  
  const issues = [];
  
  try {
    // 1. Check for ZORP zones with invalid data
    const [invalidZorps] = await pool.query(`
      SELECT COUNT(*) as count FROM zorp_zones 
      WHERE server_id IS NULL 
      OR color_online NOT REGEXP '^[0-9]+,[0-9]+,[0-9]+$'
      OR color_offline NOT REGEXP '^[0-9]+,[0-9]+,[0-9]+$'
    `);
    
    if (invalidZorps[0].count > 0) {
      issues.push(`❌ ${invalidZorps[0].count} ZORP zones have invalid data`);
    } else {
      console.log('✅ All ZORP zones have valid data');
    }
    
    // 2. Check for servers in wrong guilds
    const [serverGuildMismatches] = await pool.query(`
      SELECT rs.nickname, rs.guild_id, g.discord_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      WHERE g.discord_id NOT IN ('1391149977434329230', '1385691441967267953', '1342235198175182921', '1391209638308872254', '1379533411009560626')
    `);
    
    if (serverGuildMismatches.length > 0) {
      issues.push(`❌ ${serverGuildMismatches.length} servers may be in wrong guilds`);
    } else {
      console.log('✅ All servers are in correct guilds');
    }
    
    // 3. Check for missing database columns
    const [channelColumns] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'zentro_bot' AND TABLE_NAME = 'channel_settings'
      AND COLUMN_NAME = 'original_name'
    `);
    
    if (channelColumns.length === 0) {
      issues.push('❌ channel_settings missing original_name column');
    } else {
      console.log('✅ channel_settings has all required columns');
    }
    
    // 4. Check for orphaned records
    const [orphanedEconomy] = await pool.query(`
      SELECT COUNT(*) as count FROM economy e
      LEFT JOIN players p ON e.player_id = p.id
      WHERE p.id IS NULL
    `);
    
    if (orphanedEconomy[0].count > 0) {
      issues.push(`❌ ${orphanedEconomy[0].count} orphaned economy records`);
    } else {
      console.log('✅ No orphaned economy records');
    }
    
    // 5. Check for duplicate players
    const [duplicatePlayers] = await pool.query(`
      SELECT COUNT(*) as count FROM (
        SELECT guild_id, server_id, discord_id, ign, COUNT(*) as cnt
        FROM players 
        WHERE is_active = true
        GROUP BY guild_id, server_id, discord_id, ign
        HAVING COUNT(*) > 1
      ) as duplicates
    `);
    
    if (duplicatePlayers[0].count > 0) {
      issues.push(`❌ ${duplicatePlayers[0].count} duplicate player records`);
    } else {
      console.log('✅ No duplicate player records');
    }
    
    // Summary
    console.log('\n📊 Maintenance Summary:');
    if (issues.length === 0) {
      console.log('🎉 All systems healthy - no issues detected!');
    } else {
      console.log('⚠️  Issues detected:');
      issues.forEach(issue => console.log(`  ${issue}`));
      console.log('\n💡 Run the appropriate fix scripts to resolve these issues.');
    }
    
    console.log('\n🔄 Recommended: Run this check weekly to prevent future issues.');
    
  } catch (error) {
    console.error('❌ Error during maintenance check:', error);
  } finally {
    await pool.end();
  }
}

preventiveMaintenance();