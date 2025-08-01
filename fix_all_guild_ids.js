const pool = require('./src/db');

async function fixAllGuildIds() {
  try {
    console.log('🔧 Fixing all guild_id columns across all tables...');
    
    // Step 1: Update the guilds table first (the referenced table)
    console.log('📋 Step 1: Updating guilds table...');
    await pool.query(`
      ALTER TABLE guilds 
      MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT
    `);
    console.log('✅ Updated guilds.id to BIGINT UNSIGNED');
    
    // Step 2: Update subscriptions table
    console.log('📋 Step 2: Updating subscriptions table...');
    await pool.query(`
      ALTER TABLE subscriptions 
      MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
    `);
    console.log('✅ Updated subscriptions.guild_id to BIGINT UNSIGNED');
    
    // Step 3: Update rust_servers table
    console.log('📋 Step 3: Updating rust_servers table...');
    await pool.query(`
      ALTER TABLE rust_servers 
      MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
    `);
    console.log('✅ Updated rust_servers.guild_id to BIGINT UNSIGNED');
    
    // Step 4: Update any other tables that might have guild_id
    const tablesToCheck = ['players', 'economy', 'transactions', 'eco_games', 'eco_games_config'];
    
    for (const table of tablesToCheck) {
      try {
        console.log(`📋 Checking ${table} table...`);
        const [columns] = await pool.query(`
          SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = 'zentro_bot' 
          AND TABLE_NAME = '${table}' 
          AND COLUMN_NAME = 'guild_id'
        `);
        
        if (columns.length > 0) {
          const column = columns[0];
          if (column.DATA_TYPE === 'int' || (column.DATA_TYPE === 'bigint' && parseInt(column.NUMERIC_PRECISION) < 20)) {
            await pool.query(`
              ALTER TABLE ${table} 
              MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
            `);
            console.log(`✅ Updated ${table}.guild_id to BIGINT UNSIGNED`);
          } else {
            console.log(`✅ ${table}.guild_id is already correct`);
          }
        } else {
          console.log(`ℹ️ ${table} table doesn't have guild_id column`);
        }
      } catch (error) {
        console.log(`⚠️ Could not update ${table}: ${error.message}`);
      }
    }
    
    // Step 5: Recreate foreign key constraints
    console.log('📋 Step 4: Recreating foreign key constraints...');
    
    // Drop existing foreign key constraints
    const [constraints] = await pool.query(`
      SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'zentro_bot' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
      AND COLUMN_NAME = 'guild_id'
    `);
    
    for (const constraint of constraints) {
      try {
        console.log(`Dropping constraint: ${constraint.CONSTRAINT_NAME}`);
        await pool.query(`
          ALTER TABLE ${constraint.TABLE_NAME} 
          DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
        `);
      } catch (error) {
        console.log(`⚠️ Could not drop ${constraint.CONSTRAINT_NAME}: ${error.message}`);
      }
    }
    
    // Recreate foreign key constraints
    console.log('Recreating foreign key constraints...');
    
    // rust_servers -> guilds
    try {
      await pool.query(`
        ALTER TABLE rust_servers 
        ADD CONSTRAINT rust_servers_ibfk_1 
        FOREIGN KEY (guild_id) REFERENCES guilds(id)
      `);
      console.log('✅ Recreated rust_servers foreign key');
    } catch (error) {
      console.log(`⚠️ Could not recreate rust_servers foreign key: ${error.message}`);
    }
    
    // subscriptions -> guilds
    try {
      await pool.query(`
        ALTER TABLE subscriptions 
        ADD CONSTRAINT subscriptions_ibfk_1 
        FOREIGN KEY (guild_id) REFERENCES guilds(id)
      `);
      console.log('✅ Recreated subscriptions foreign key');
    } catch (error) {
      console.log(`⚠️ Could not recreate subscriptions foreign key: ${error.message}`);
    }
    
    console.log('🎉 All guild_id columns have been updated to BIGINT UNSIGNED!');
    console.log('✅ Discord guild IDs can now be stored properly across all tables');
    
  } catch (error) {
    console.error('❌ Error fixing guild_id columns:', error);
  } finally {
    await pool.end();
  }
}

fixAllGuildIds(); 