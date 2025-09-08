const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPlayersView() {
  console.log('🔍 CHECKING PLAYERS VIEW');
  console.log('========================');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Check the players_unified view definition
    console.log('\n📋 View definition:');
    const [viewDef] = await connection.execute(`
      SELECT VIEW_DEFINITION
      FROM INFORMATION_SCHEMA.VIEWS 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'players_unified'
    `);
    
    if (viewDef.length > 0) {
      console.log('players_unified view definition:');
      console.log(viewDef[0].VIEW_DEFINITION);
    }

    // Check what the view returns for our player
    console.log('\n📋 What the view returns for ID 18508:');
    const [viewResult] = await connection.execute(`
      SELECT * FROM players_unified WHERE id = 18508
    `);
    
    if (viewResult.length > 0) {
      console.log('View result:');
      for (const [key, value] of Object.entries(viewResult[0])) {
        console.log(`  ${key}: ${value}`);
      }
    }

    // Check what the actual table returns
    console.log('\n📋 What the actual table returns for ID 18508:');
    const [tableResult] = await connection.execute(`
      SELECT * FROM players WHERE id = 18508
    `);
    
    if (tableResult.length > 0) {
      console.log('Table result:');
      for (const [key, value] of Object.entries(tableResult[0])) {
        console.log(`  ${key}: ${value}`);
      }
    }

    // Check if there are any triggers on the view
    console.log('\n📋 Checking for triggers on the view:');
    const [viewTriggers] = await connection.execute(`
      SELECT 
        TRIGGER_NAME,
        EVENT_MANIPULATION,
        ACTION_TIMING,
        ACTION_STATEMENT
      FROM INFORMATION_SCHEMA.TRIGGERS 
      WHERE EVENT_OBJECT_TABLE = 'players_unified'
      AND EVENT_OBJECT_SCHEMA = DATABASE()
    `);
    
    if (viewTriggers.length > 0) {
      console.log(`Found ${viewTriggers.length} triggers on the view:`);
      for (const trigger of viewTriggers) {
        console.log(`  📌 ${trigger.TRIGGER_NAME}`);
        console.log(`     Event: ${trigger.EVENT_MANIPULATION}`);
        console.log(`     Timing: ${trigger.ACTION_TIMING}`);
        console.log(`     Statement: ${trigger.ACTION_STATEMENT}`);
      }
    } else {
      console.log('✅ No triggers found on the view');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
if (require.main === module) {
  checkPlayersView()
    .then(() => {
      console.log('\n✅ View check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ View check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkPlayersView };
