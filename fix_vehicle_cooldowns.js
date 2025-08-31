const pool = require('./src/db');

async function fixVehicleCooldowns() {
  try {
    console.log('🔧 Fixing shop_cooldowns table to support vehicles...');
    
    await pool.query('ALTER TABLE shop_cooldowns MODIFY COLUMN item_type ENUM("item", "kit", "vehicle") NOT NULL');
    
    console.log('✅ shop_cooldowns table updated to support vehicles!');
    
  } catch (error) {
    console.error('❌ Error fixing shop_cooldowns table:', error);
  } finally {
    await pool.end();
  }
}

fixVehicleCooldowns();
