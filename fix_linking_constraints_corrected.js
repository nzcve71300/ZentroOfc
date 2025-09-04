const pool = require('./src/db');

async function fixLinkingConstraintsCorrected() {
  console.log('🔧 Fixing /link command constraints (CORRECTED VERSION)...\n');
  console.log('💡 This will allow similar names but block exact duplicates\n');
  
  try {
    // Step 1: Check current constraints
    console.log('📋 Step 1: Checking current constraints...');
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
    
    console.log('📋 Current IGN-related constraints:');
    constraints.forEach(constraint => {
      console.log(`  ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME}`);
    });
    
    // Step 2: Check for any existing conflicts that would prevent the constraint change
    console.log('\n📋 Step 2: Checking for existing conflicts...');
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
    
    // Step 3: Remove the problematic guild-wide constraint
    console.log('📋 Step 3: Removing problematic guild-wide constraint...');
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
    
    // Step 4: Add the new constraint that only prevents exact duplicates on same server
    console.log('📋 Step 4: Adding new constraint for exact duplicates only...');
    try {
      await pool.query(`
        ALTER TABLE players ADD CONSTRAINT unique_server_exact_ign_active 
        UNIQUE (server_id, ign(191), is_active)
      `);
      console.log('✅ Successfully added unique_server_exact_ign_active constraint');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Constraint already exists');
      } else {
        throw error;
      }
    }
    
    // Step 5: Add performance indexes
    console.log('📋 Step 5: Adding performance indexes...');
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
    
    // Step 6: Verify the changes
    console.log('📋 Step 6: Verifying changes...');
    const [newConstraints] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'players' 
      AND CONSTRAINT_NAME LIKE '%ign%'
    `);
    
    console.log('\n📋 New IGN-related constraints:');
    newConstraints.forEach(constraint => {
      console.log(`  ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME}`);
    });
    
    console.log('\n🎉 Constraint fix completed successfully!');
    console.log('\n💡 What this fixes:');
    console.log('   ✅ Similar names are now allowed (e.g., "Rustgod1234" vs "Rustgod12345")');
    console.log('   ✅ Exact duplicates are still blocked on the same server');
    console.log('   ✅ Same IGN can be used across different servers in the same guild');
    console.log('   ✅ Better support for multi-server Discord guilds');
    console.log('\n🧪 Test the /link command now:');
    console.log('   - Try "Rustgod1234" (should work)');
    console.log('   - Try "Rustgod12345" (should work - different name)');
    console.log('   - Try exact same name that exists (should be blocked)');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error fixing constraints:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixLinkingConstraintsCorrected().then(success => {
  process.exit(success ? 0 : 1);
});
