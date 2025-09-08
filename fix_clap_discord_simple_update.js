const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixClapDiscordSimpleUpdate() {
  console.log('🔧 SIMPLE DISCORD ID UPDATE');
  console.log('===========================');

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

    // Step 1: Check current state
    console.log('\n📋 Current state:');
    const [current] = await connection.execute(`
      SELECT id, ign, discord_id, is_active
      FROM players 
      WHERE id = 18508
    `);
    
    if (current.length > 0) {
      console.log(`ID: ${current[0].id}, IGN: "${current[0].ign}", Discord: ${current[0].discord_id}, Active: ${current[0].is_active}`);
    }

    // Step 2: Try updating with a different approach - use a transaction
    console.log('\n📋 Updating with transaction...');
    
    await connection.execute('START TRANSACTION');
    
    try {
      // Update the Discord ID
      const result = await connection.execute(`
        UPDATE players 
        SET discord_id = 899414980355571712
        WHERE id = 18508
      `);
      
      console.log(`Update result: ${result[0].affectedRows} rows affected, ${result[0].changedRows} changed`);
      
      // Commit the transaction
      await connection.execute('COMMIT');
      console.log('✅ Transaction committed');
      
    } catch (error) {
      await connection.execute('ROLLBACK');
      console.log('❌ Transaction rolled back due to error:', error.message);
      throw error;
    }

    // Step 3: Check the result
    console.log('\n📋 Checking result:');
    const [updated] = await connection.execute(`
      SELECT id, ign, discord_id, is_active
      FROM players 
      WHERE id = 18508
    `);
    
    if (updated.length > 0) {
      console.log(`ID: ${updated[0].id}, IGN: "${updated[0].ign}", Discord: ${updated[0].discord_id}, Active: ${updated[0].is_active}`);
      
      if (updated[0].discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: Discord ID updated correctly!');
      } else {
        console.log('\n❌ Discord ID was not updated correctly');
        console.log(`Expected: 899414980355571712`);
        console.log(`Actual: ${updated[0].discord_id}`);
      }
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

// Run the fix
if (require.main === module) {
  fixClapDiscordSimpleUpdate()
    .then(() => {
      console.log('\n✅ Simple update completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Simple update failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordSimpleUpdate };
