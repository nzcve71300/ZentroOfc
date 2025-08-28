const pool = require('./src/db');

async function removeFuelEnabledColumn() {
  try {
    console.log('🗑️ Removing fuel_enabled column from rider_config table...');
    
    // Check if the column exists first
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'rider_config' 
      AND COLUMN_NAME = 'fuel_enabled'
    `);
    
    if (columns.length === 0) {
      console.log('✅ fuel_enabled column does not exist, nothing to remove');
      return;
    }
    
    console.log('📋 fuel_enabled column found, removing...');
    
    // Remove the fuel_enabled column
    await pool.query('ALTER TABLE rider_config DROP COLUMN fuel_enabled');
    
    console.log('✅ Successfully removed fuel_enabled column from rider_config table');
    console.log('💡 Now fuel is controlled only by fuel_amount:');
    console.log('   - Set fuel_amount to 0 to disable fuel');
    console.log('   - Set fuel_amount to any positive number to give that amount of fuel');
    
  } catch (error) {
    console.error('❌ Error removing fuel_enabled column:', error);
  } finally {
    await pool.end();
  }
}

removeFuelEnabledColumn();
