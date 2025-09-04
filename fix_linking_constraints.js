const pool = require('./src/db');

async function fixLinkingConstraints() {
  console.log('🔧 Fixing /link command constraints...\n');
  
  try {
    // Step 1: Check for existing conflicts
    console.log('📋 Step 1: Checking for existing conflicts...');
    const [conflicts] = await pool.query(`
      SELECT 
        COUNT(*) as total_conflicts
      FROM (
        SELECT server_id, ign, COUNT(*) as count
        FROM players 
        WHERE is_active = 1
        GROUP BY server_id, ign
        HAVING COUNT(*) > 1
      ) conflicts
    `);
    
    if (conflicts[0].total_conflicts > 0) {
      console.log(`❌ Found ${conflicts[0].total_conflicts} conflicts! Cannot proceed safely.`);
      
      // Show conflict details
      const [conflictDetails] = await pool.query(`
        SELECT 
          p1.server_id,
          p1.ign,
          p1.discord_id as discord_id_1,
          p2.discord_id as discord_id_2,
          rs.nickname as server_name
        FROM players p1
        JOIN players p2 ON p1.server_id = p2.server_id 
          AND p1.ign = p2.ign 
          AND p1.id < p2.id
          AND p1.is_active = 1 
          AND p2.is_active = 1
        JOIN rust_servers rs ON p1.server_id = rs.id
        ORDER BY p1.server_id, p1.ign
        LIMIT 10
      `);
      
      console.log('\n📋 Conflict details (first 10):');
      conflictDetails.forEach(conflict => {
        console.log(`  Server: ${conflict.server_name} (${conflict.server_id})`);
        console.log(`  IGN: "${conflict.ign}"`);
        console.log(`  Discord IDs: ${conflict.discord_id_1} vs ${conflict.discord_id_2}\n`);
      });
      
      console.log('💡 To fix conflicts, you need to:');
      console.log('   1. Deactivate duplicate records (set is_active = 0)');
      console.log('   2. Or delete duplicate records');
      console.log('   3. Or merge the records');
      console.log('\n   Then run this script again.');
      
      return false;
    }
    
    console.log('✅ No conflicts found. Proceeding with constraint changes...\n');
    
    // Step 2: Remove the problematic constraint
    console.log('📋 Step 2: Removing problematic constraint...');
    try {
      await pool.query('ALTER TABLE players DROP INDEX players_unique_guild_server_ign');
      console.log('✅ Successfully removed players_unique_guild_server_ign constraint');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP') {
        console.log('⚠️  Constraint already removed or doesn\'t exist');
      } else {
        throw error;
      }
    }
    
    // Step 3: Add the new constraint
    console.log('📋 Step 3: Adding new constraint...');
    try {
      await pool.query(`
        ALTER TABLE players ADD CONSTRAINT unique_server_ign_active 
        UNIQUE (server_id, ign(191), is_active)
      `);
      console.log('✅ Successfully added unique_server_ign_active constraint');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Constraint already exists');
      } else {
        throw error;
      }
    }
    
    // Step 4: Add performance index
    console.log('📋 Step 4: Adding performance index...');
    try {
      await pool.query(`
        CREATE INDEX idx_players_server_ign_active ON players(server_id, ign(191), is_active)
      `);
      console.log('✅ Successfully added performance index');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Index already exists');
      } else {
        throw error;
      }
    }
    
    // Step 5: Verify the changes
    console.log('📋 Step 5: Verifying changes...');
    const [constraints] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'players' 
      AND CONSTRAINT_NAME LIKE '%ign%'
    `);
    
    console.log('\n📋 Current IGN-related constraints:');
    constraints.forEach(constraint => {
      console.log(`  ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME}`);
    });
    
    console.log('\n🎉 Constraint fix completed successfully!');
    console.log('\n💡 What this fixes:');
    console.log('   ✅ Same IGN can now be used across different servers within the same guild');
    console.log('   ✅ Different IGNs can be used on the same server');
    console.log('   ✅ Still prevents: Same IGN on the same server (active)');
    console.log('\n🧪 Test the /link command now - it should work without "name already in use" errors!');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error fixing constraints:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixLinkingConstraints().then(success => {
  process.exit(success ? 0 : 1);
});
