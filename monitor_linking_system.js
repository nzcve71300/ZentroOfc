const pool = require('./src/db');

async function monitorLinkingSystem() {
  console.log('🔍 Monitoring linking system for issues...\n');
  
  try {
    // Check for any active conflicts
    console.log('📋 Checking for active conflicts...');
    
    const [conflicts] = await pool.query(`
      SELECT 
        LOWER(TRIM(ign)) as normalized_ign,
        COUNT(*) as total_records,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_records,
        COUNT(DISTINCT discord_id) as unique_discord_ids,
        GROUP_CONCAT(DISTINCT ign) as ign_variations,
        GROUP_CONCAT(DISTINCT rs.nickname) as servers
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign IS NOT NULL
      GROUP BY LOWER(TRIM(ign))
      HAVING COUNT(*) > 1 OR COUNT(CASE WHEN is_active = true THEN 1 END) > 1
      ORDER BY total_records DESC
    `);
    
    if (conflicts.length === 0) {
      console.log('✅ No conflicts detected - linking system is healthy!');
    } else {
      console.log(`⚠️  Found ${conflicts.length} potential conflicts:`);
      
      for (const conflict of conflicts) {
        console.log(`\n🔍 IGN: "${conflict.normalized_ign}"`);
        console.log(`   Total records: ${conflict.total_records}`);
        console.log(`   Active records: ${conflict.active_records}`);
        console.log(`   Unique Discord IDs: ${conflict.unique_discord_ids}`);
        console.log(`   IGN variations: ${conflict.ign_variations}`);
        console.log(`   Servers: ${conflict.servers}`);
        
        if (conflict.active_records > 1) {
          console.log(`   ❌ CONFLICT: Multiple active records!`);
        }
      }
      
      // Auto-fix conflicts
      console.log('\n🔧 Auto-fixing conflicts...');
      let fixedCount = 0;
      
      for (const conflict of conflicts) {
        if (conflict.active_records > 1) {
          // Get all active records for this IGN
          const [activeRecords] = await pool.query(`
            SELECT p.*, rs.nickname
            FROM players p
            JOIN rust_servers rs ON p.server_id = rs.id
            WHERE LOWER(TRIM(p.ign)) = LOWER(TRIM(?))
            AND p.is_active = true
            ORDER BY p.linked_at DESC
          `, [conflict.normalized_ign]);
          
          // Keep the most recent, deactivate the rest
          if (activeRecords.length > 1) {
            const keepRecord = activeRecords[0];
            const deactivateRecords = activeRecords.slice(1);
            
            console.log(`   ✅ Keeping: "${keepRecord.ign}" (${keepRecord.nickname}) - Linked: ${keepRecord.linked_at}`);
            
            for (const deactivateRecord of deactivateRecords) {
              console.log(`   ❌ Deactivating: "${deactivateRecord.ign}" (${deactivateRecord.nickname}) - Linked: ${deactivateRecord.linked_at}`);
              
              await pool.query(
                'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP WHERE id = ?',
                [deactivateRecord.id]
              );
              fixedCount++;
            }
          }
        }
      }
      
      console.log(`\n✅ Auto-fixed ${fixedCount} conflicts`);
    }
    
    // Check for case sensitivity issues
    console.log('\n📋 Checking for case sensitivity issues...');
    
    const [caseIssues] = await pool.query(`
      SELECT 
        LOWER(TRIM(ign)) as normalized_ign,
        COUNT(DISTINCT ign) as case_variations,
        GROUP_CONCAT(DISTINCT ign) as variations
      FROM players
      WHERE ign IS NOT NULL
      GROUP BY LOWER(TRIM(ign))
      HAVING COUNT(DISTINCT ign) > 1
    `);
    
    if (caseIssues.length === 0) {
      console.log('✅ No case sensitivity issues detected');
    } else {
      console.log(`⚠️  Found ${caseIssues.length} case sensitivity issues:`);
      
      for (const issue of caseIssues) {
        console.log(`   IGN: "${issue.normalized_ign}" - Variations: ${issue.variations}`);
      }
      
      // Auto-fix case sensitivity
      console.log('\n🔧 Auto-fixing case sensitivity issues...');
      const [normalizeResult] = await pool.query(`
        UPDATE players 
        SET ign = LOWER(TRIM(ign))
        WHERE ign IS NOT NULL 
        AND ign != LOWER(TRIM(ign))
      `);
      
      console.log(`✅ Normalized ${normalizeResult.affectedRows} IGNs to lowercase`);
    }
    
    // Check for orphaned records
    console.log('\n📋 Checking for orphaned records...');
    
    const [orphanedRecords] = await pool.query(`
      SELECT COUNT(*) as count
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE rs.id IS NULL
    `);
    
    if (orphanedRecords[0].count === 0) {
      console.log('✅ No orphaned records detected');
    } else {
      console.log(`⚠️  Found ${orphanedRecords[0].count} orphaned records (server no longer exists)`);
      
      // Clean up orphaned records
      const [cleanupResult] = await pool.query(`
        DELETE p FROM players p
        LEFT JOIN rust_servers rs ON p.server_id = rs.id
        WHERE rs.id IS NULL
      `);
      
      console.log(`✅ Cleaned up ${cleanupResult.affectedRows} orphaned records`);
    }
    
    // Final health check
    console.log('\n📋 Final health check...');
    
    const [healthCheck] = await pool.query(`
      SELECT 
        COUNT(*) as total_players,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_players,
        COUNT(DISTINCT LOWER(TRIM(ign))) as unique_igns,
        COUNT(DISTINCT discord_id) as unique_discord_ids
      FROM players
      WHERE ign IS NOT NULL
    `);
    
    const stats = healthCheck[0];
    console.log(`📊 System Health:`);
    console.log(`   Total players: ${stats.total_players}`);
    console.log(`   Active players: ${stats.active_players}`);
    console.log(`   Unique IGNs: ${stats.unique_igns}`);
    console.log(`   Unique Discord IDs: ${stats.unique_discord_ids}`);
    
    if (stats.total_players === stats.unique_igns) {
      console.log('✅ System is healthy - no duplicates detected');
    } else {
      console.log(`⚠️  Potential duplicates: ${stats.total_players - stats.unique_igns}`);
    }
    
    console.log('\n🛡️  Linking system monitoring complete!');
    
  } catch (error) {
    console.error('❌ Error in monitoring:', error);
  } finally {
    await pool.end();
  }
}

// Run the monitoring
monitorLinkingSystem();
