const pool = require('./src/db');

async function investigateDiscordIdIssue() {
  console.log('🔍 Investigating Discord ID Issue');
  console.log('==================================\n');

  try {
    // Step 1: Check for triggers
    console.log('📋 Step 1: Checking for triggers on players table...');
    const [triggers] = await pool.query(`
      SELECT 
        TRIGGER_NAME,
        EVENT_MANIPULATION,
        ACTION_TIMING,
        ACTION_STATEMENT
      FROM information_schema.triggers 
      WHERE EVENT_OBJECT_TABLE = 'players'
    `);
    
    console.log(`Found ${triggers.length} triggers on players table:`);
    triggers.forEach(trigger => {
      console.log(`   - ${trigger.TRIGGER_NAME}: ${trigger.EVENT_MANIPULATION} ${trigger.ACTION_TIMING}`);
      console.log(`     Statement: ${trigger.ACTION_STATEMENT}`);
    });

    // Step 2: Check for all constraints (including foreign keys)
    console.log('\n📋 Step 2: Checking for ALL constraints on players table...');
    const [allConstraints] = await pool.query(`
      SELECT 
        tc.CONSTRAINT_NAME,
        tc.CONSTRAINT_TYPE,
        tc.TABLE_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = 'players'
      ORDER BY tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME
    `);
    
    console.log(`Found ${allConstraints.length} constraints on players table:`);
    allConstraints.forEach(constraint => {
      console.log(`   - ${constraint.CONSTRAINT_NAME} (${constraint.CONSTRAINT_TYPE})`);
      if (constraint.COLUMN_NAME) {
        console.log(`     Column: ${constraint.COLUMN_NAME}`);
      }
      if (constraint.REFERENCED_TABLE_NAME) {
        console.log(`     References: ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
      }
    });

    // Step 3: Check for check constraints specifically
    console.log('\n📋 Step 3: Checking for remaining check constraints...');
    const [checkConstraints] = await pool.query(`
      SELECT 
        tc.CONSTRAINT_NAME,
        cc.CHECK_CLAUSE
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.check_constraints cc 
        ON tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = 'players' 
      AND tc.CONSTRAINT_TYPE = 'CHECK'
    `);
    
    console.log(`Found ${checkConstraints.length} check constraints:`);
    checkConstraints.forEach(constraint => {
      console.log(`   - ${constraint.CONSTRAINT_NAME}: ${constraint.CHECK_CLAUSE}`);
    });

    // Step 4: Try a different approach - check if there's a default value issue
    console.log('\n📋 Step 4: Checking column definition details...');
    const [columnDetails] = await pool.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COLUMN_TYPE,
        EXTRA
      FROM information_schema.columns 
      WHERE TABLE_NAME = 'players' 
      AND COLUMN_NAME = 'discord_id'
    `);
    
    if (columnDetails.length > 0) {
      const column = columnDetails[0];
      console.log(`📋 Discord ID column details:`);
      console.log(`   Column: ${column.COLUMN_NAME}`);
      console.log(`   Type: ${column.DATA_TYPE}`);
      console.log(`   Nullable: ${column.IS_NULLABLE}`);
      console.log(`   Default: ${column.COLUMN_DEFAULT}`);
      console.log(`   Column Type: ${column.COLUMN_TYPE}`);
      console.log(`   Extra: ${column.EXTRA}`);
    }

    // Step 5: Try to insert with explicit NULL
    console.log('\n📋 Step 5: Testing direct NULL insertion...');
    try {
      const [testGuild] = await pool.query('SELECT id FROM guilds LIMIT 1');
      const [testServer] = await pool.query('SELECT id FROM rust_servers LIMIT 1');
      
      if (testGuild.length > 0 && testServer.length > 0) {
        const testGuildId = testGuild[0].id;
        const testServerId = testServer[0].id;
        const testPlayerName = 'TestDirectNull_' + Date.now();
        
        console.log(`Testing direct NULL insertion...`);
        
        // Try with explicit NULL
        const [testResult] = await pool.query(
          'INSERT INTO players (guild_id, server_id, discord_id, ign, is_active) VALUES (?, ?, ?, ?, 1)',
          [testGuildId, testServerId, null, testPlayerName]
        );
        
        console.log(`✅ Successfully created test player record with ID: ${testResult.insertId}`);
        
        // Clean up test record
        await pool.query('DELETE FROM players WHERE id = ?', [testResult.insertId]);
        console.log('✅ Cleaned up test record');
      }
    } catch (error) {
      console.error('❌ Direct NULL test failed:', error.message);
      console.error('Full error:', error);
    }

    // Step 6: Check if there are any application-level constraints
    console.log('\n📋 Step 6: Checking for application-level issues...');
    
    // Check if there's a unique constraint that might be causing issues
    const [uniqueConstraints] = await pool.query(`
      SELECT 
        tc.CONSTRAINT_NAME,
        kcu.COLUMN_NAME
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = 'players' 
      AND tc.CONSTRAINT_TYPE = 'UNIQUE'
      AND kcu.COLUMN_NAME = 'discord_id'
    `);
    
    console.log(`Found ${uniqueConstraints.length} unique constraints on discord_id:`);
    uniqueConstraints.forEach(constraint => {
      console.log(`   - ${constraint.CONSTRAINT_NAME} on ${constraint.COLUMN_NAME}`);
    });

    console.log('\n📋 Investigation completed!');

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

// Run the investigation
if (require.main === module) {
  investigateDiscordIdIssue()
    .then(() => {
      console.log('\n🎉 Investigation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = { investigateDiscordIdIssue };
