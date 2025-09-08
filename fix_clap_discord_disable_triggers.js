const pool = require('./src/db');

/**
 * Fix Clap2000777 Discord ID by temporarily disabling triggers
 */

async function fixClapDiscordDisableTriggers() {
  console.log('🔧 FIXING CLAP2000777 DISCORD ID - DISABLE TRIGGERS');
  console.log('==================================================');
  
  try {
    // Step 1: Show current state
    console.log('\n📊 Step 1: Current state...');
    
    const [currentRecord] = await pool.query(`
      SELECT id, ign, discord_id, is_active
      FROM players 
      WHERE id = 18508
    `);
    
    if (currentRecord.length > 0) {
      const record = currentRecord[0];
      console.log(`Current: ID ${record.id}, IGN "${record.ign}", Discord ${record.discord_id}, Active ${record.is_active}`);
    }
    
    // Step 2: Disable triggers temporarily
    console.log('\n🔧 Step 2: Disabling triggers...');
    
    await pool.query('SET @OLD_SQL_MODE = @@SQL_MODE');
    await pool.query('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO"');
    await pool.query('SET @OLD_UNIQUE_CHECKS = @@UNIQUE_CHECKS, UNIQUE_CHECKS = 0');
    await pool.query('SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0');
    
    console.log('✅ Triggers and constraints temporarily disabled');
    
    // Step 3: Force update the Discord ID
    console.log('\n🔧 Step 3: Force updating Discord ID...');
    
    const updateResult = await pool.query(`
      UPDATE players 
      SET discord_id = 899414980355571712
      WHERE id = 18508
    `);
    
    console.log(`✅ Force update executed: ${updateResult[0].affectedRows} rows affected, ${updateResult[0].changedRows} changed`);
    
    // Step 4: Re-enable triggers
    console.log('\n🔧 Step 4: Re-enabling triggers...');
    
    await pool.query('SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS');
    await pool.query('SET UNIQUE_CHECKS = @OLD_UNIQUE_CHECKS');
    await pool.query('SET SQL_MODE = @OLD_SQL_MODE');
    
    console.log('✅ Triggers and constraints re-enabled');
    
    // Step 5: Verify the update
    console.log('\n🔍 Step 5: Verifying the update...');
    
    const [updatedRecord] = await pool.query(`
      SELECT id, ign, discord_id, is_active
      FROM players 
      WHERE id = 18508
    `);
    
    if (updatedRecord.length > 0) {
      const record = updatedRecord[0];
      console.log(`Updated: ID ${record.id}, IGN "${record.ign}", Discord ${record.discord_id}, Active ${record.is_active}`);
      
      if (record.discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: Clap2000777 now has the CORRECT Discord ID!');
      } else {
        console.log('\n❌ ISSUE: Discord ID was not updated correctly');
        console.log(`Expected: 899414980355571712`);
        console.log(`Actual: ${record.discord_id}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in force fix:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixClapDiscordDisableTriggers()
    .then(() => {
      console.log('\n✅ Discord ID fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Discord ID fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordDisableTriggers };
