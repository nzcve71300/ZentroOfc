const pool = require('./src/db');

async function fixGuildIdColumnWithFK() {
  try {
    console.log('🔧 Fixing guild_id column in rust_servers table...');
    
    // First, let's check what foreign key constraints exist
    const [constraints] = await pool.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'zentro_bot' 
      AND TABLE_NAME = 'rust_servers' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.log('Found foreign key constraints:', constraints);
    
    // Drop all foreign key constraints that reference guild_id
    for (const constraint of constraints) {
      if (constraint.COLUMN_NAME === 'guild_id') {
        console.log(`Dropping foreign key constraint: ${constraint.CONSTRAINT_NAME}`);
        await pool.query(`
          ALTER TABLE rust_servers 
          DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
        `);
      }
    }
    
    // Now modify the guild_id column
    console.log('Modifying guild_id column to BIGINT UNSIGNED...');
    await pool.query(`
      ALTER TABLE rust_servers 
      MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
    `);
    
    console.log('✅ Successfully updated guild_id column to BIGINT UNSIGNED');
    
    // Recreate the foreign key constraints
    for (const constraint of constraints) {
      if (constraint.COLUMN_NAME === 'guild_id') {
        console.log(`Recreating foreign key constraint: ${constraint.CONSTRAINT_NAME}`);
        await pool.query(`
          ALTER TABLE rust_servers 
          ADD CONSTRAINT ${constraint.CONSTRAINT_NAME} 
          FOREIGN KEY (guild_id) 
          REFERENCES ${constraint.REFERENCED_TABLE_NAME}(${constraint.REFERENCED_COLUMN_NAME})
        `);
      }
    }
    
    console.log('✅ Successfully recreated foreign key constraints');
    console.log('🎉 Discord guild IDs can now be stored properly!');
    
  } catch (error) {
    console.error('❌ Error fixing guild_id column:', error);
    
    // If there's an error, try a simpler approach
    if (error.code === 'ER_FK_COLUMN_CANNOT_CHANGE') {
      console.log('💡 Trying alternative approach...');
      
      try {
        // Try to modify the referenced table's column first
        await pool.query(`
          ALTER TABLE subscriptions 
          MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
        `);
        
        // Then modify the rust_servers table
        await pool.query(`
          ALTER TABLE rust_servers 
          MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
        `);
        
        console.log('✅ Successfully updated both columns to BIGINT UNSIGNED');
        console.log('🎉 Discord guild IDs can now be stored properly!');
        
      } catch (altError) {
        console.error('❌ Alternative approach also failed:', altError);
        console.log('💡 You may need to manually update the database schema');
      }
    }
  } finally {
    await pool.end();
  }
}

fixGuildIdColumnWithFK(); 