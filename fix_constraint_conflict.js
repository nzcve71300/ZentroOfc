const pool = require('./src/db');

async function fixConstraintConflict() {
  console.log('🔧 Fixing constraint conflict...');
  
  try {
    // Check if the old constraint exists
    const [constraints] = await pool.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'players' 
      AND CONSTRAINT_NAME = 'players_unique_guild_server_ign'
    `);
    
    if (constraints.length > 0) {
      console.log('❌ Found conflicting constraint: players_unique_guild_server_ign');
      console.log('🔧 Dropping old constraint...');
      
      await pool.query('ALTER TABLE players DROP INDEX players_unique_guild_server_ign');
      console.log('✅ Dropped players_unique_guild_server_ign constraint');
    } else {
      console.log('✅ players_unique_guild_server_ign constraint not found (already removed)');
    }
    
    // Also check for the other old constraint
    const [constraints2] = await pool.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'players' 
      AND CONSTRAINT_NAME = 'players_unique_guild_server_discord'
    `);
    
    if (constraints2.length > 0) {
      console.log('❌ Found conflicting constraint: players_unique_guild_server_discord');
      console.log('🔧 Dropping old constraint...');
      
      await pool.query('ALTER TABLE players DROP INDEX players_unique_guild_server_discord');
      console.log('✅ Dropped players_unique_guild_server_discord constraint');
    } else {
      console.log('✅ players_unique_guild_server_discord constraint not found (already removed)');
    }
    
    // Check for the other problematic constraint
    const [constraints3] = await pool.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'players' 
      AND CONSTRAINT_NAME = 'unique_server_exact_ign_active'
    `);
    
    if (constraints3.length > 0) {
      console.log('❌ Found conflicting constraint: unique_server_exact_ign_active');
      console.log('🔧 Dropping old constraint...');
      
      await pool.query('ALTER TABLE players DROP INDEX unique_server_exact_ign_active');
      console.log('✅ Dropped unique_server_exact_ign_active constraint');
    } else {
      console.log('✅ unique_server_exact_ign_active constraint not found (already removed)');
    }
    
    // Verify our new constraint is still there
    const [newConstraint] = await pool.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'players' 
      AND CONSTRAINT_NAME = 'ux_players_guild_normign'
    `);
    
    if (newConstraint.length > 0) {
      console.log('✅ New constraint ux_players_guild_normign is present');
    } else {
      console.log('❌ New constraint ux_players_guild_normign is missing!');
      console.log('🔧 Recreating new constraint...');
      
      await pool.query(`
        ALTER TABLE players 
        ADD CONSTRAINT ux_players_guild_normign 
        UNIQUE KEY (guild_id, normalized_ign)
      `);
      console.log('✅ Recreated ux_players_guild_normign constraint');
    }
    
    console.log('🎉 Constraint conflict resolution complete!');
    
  } catch (error) {
    console.error('❌ Error fixing constraint conflict:', error);
  }
  
  process.exit(0);
}

fixConstraintConflict();
