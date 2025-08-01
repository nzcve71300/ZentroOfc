const pool = require('./src/db');

async function fixGuildIdColumn() {
  try {
    console.log('🔧 Fixing guild_id column in rust_servers table...');
    
    // Update the column to BIGINT UNSIGNED
    await pool.query(`
      ALTER TABLE rust_servers 
      MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
    `);
    
    console.log('✅ Successfully updated guild_id column to BIGINT UNSIGNED');
    console.log('🎉 Discord guild IDs can now be stored properly!');
    
  } catch (error) {
    console.error('❌ Error fixing guild_id column:', error);
    console.log('💡 If the column is already correct, this error is expected');
  } finally {
    await pool.end();
  }
}

fixGuildIdColumn(); 