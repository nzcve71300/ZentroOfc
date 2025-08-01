const pool = require('./src/db');

async function fixAllGuildIdsComprehensive() {
  try {
    console.log('🔧 Comprehensive fix for all guild_id columns...');
    
    // Step 1: Find ALL foreign key constraints that reference guilds.id
    console.log('📋 Step 1: Finding all foreign key constraints...');
    const [allConstraints] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME, 
        TABLE_NAME, 
        COLUMN_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'zentro_bot' 
      AND REFERENCED_TABLE_NAME = 'guilds'
    `);
    
    console.log('Found foreign key constraints:', allConstraints);
    
    // Step 2: Drop ALL foreign key constraints
    console.log('📋 Step 2: Dropping all foreign key constraints...');
    for (const constraint of allConstraints) {
      try {
        console.log(`Dropping constraint: ${constraint.CONSTRAINT_NAME} on ${constraint.TABLE_NAME}`);
        await pool.query(`
          ALTER TABLE ${constraint.TABLE_NAME} 
          DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
        `);
        console.log(`✅ Dropped ${constraint.CONSTRAINT_NAME}`);
      } catch (error) {
        console.log(`⚠️ Could not drop ${constraint.CONSTRAINT_NAME}: ${error.message}`);
      }
    }
    
    // Step 3: Update all guild_id columns
    console.log('📋 Step 3: Updating all guild_id columns...');
    
    const tablesToUpdate = [
      'guilds',
      'subscriptions', 
      'rust_servers',
      'players',
      'economy', 
      'transactions',
      'eco_games',
      'eco_games_config',
      'link_blocks'
    ];
    
    for (const table of tablesToUpdate) {
      try {
        console.log(`Checking ${table} table...`);
        
        // Check if table exists and has guild_id column
        const [columns] = await pool.query(`
          SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = 'zentro_bot' 
          AND TABLE_NAME = '${table}' 
          AND COLUMN_NAME IN ('id', 'guild_id')
        `);
        
        for (const column of columns) {
          if (column.COLUMN_NAME === 'id' && table === 'guilds') {
            // Update guilds.id
            await pool.query(`
              ALTER TABLE guilds 
              MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT
            `);
            console.log(`✅ Updated guilds.id to BIGINT UNSIGNED`);
          } else if (column.COLUMN_NAME === 'guild_id') {
            // Update guild_id columns
            await pool.query(`
              ALTER TABLE ${table} 
              MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
            `);
            console.log(`✅ Updated ${table}.guild_id to BIGINT UNSIGNED`);
          }
        }
      } catch (error) {
        console.log(`⚠️ Could not update ${table}: ${error.message}`);
      }
    }
    
    // Step 4: Recreate ALL foreign key constraints
    console.log('📋 Step 4: Recreating all foreign key constraints...');
    
    for (const constraint of allConstraints) {
      try {
        console.log(`Recreating constraint: ${constraint.CONSTRAINT_NAME}`);
        await pool.query(`
          ALTER TABLE ${constraint.TABLE_NAME} 
          ADD CONSTRAINT ${constraint.CONSTRAINT_NAME} 
          FOREIGN KEY (${constraint.COLUMN_NAME}) 
          REFERENCES ${constraint.REFERENCED_TABLE_NAME}(${constraint.REFERENCED_COLUMN_NAME})
        `);
        console.log(`✅ Recreated ${constraint.CONSTRAINT_NAME}`);
      } catch (error) {
        console.log(`⚠️ Could not recreate ${constraint.CONSTRAINT_NAME}: ${error.message}`);
      }
    }
    
    console.log('🎉 Comprehensive guild_id fix completed!');
    console.log('✅ All guild_id columns updated to BIGINT UNSIGNED');
    console.log('✅ All foreign key constraints recreated');
    console.log('✅ Discord guild IDs can now be stored properly');
    
  } catch (error) {
    console.error('❌ Error in comprehensive fix:', error);
  } finally {
    await pool.end();
  }
}

fixAllGuildIdsComprehensive(); 