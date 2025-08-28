const pool = require('./src/db');

async function addHorseRhibColumns() {
  try {
    console.log('🔧 Adding horse_enabled and rhib_enabled columns to rider_config table...');
    
    // Check if the columns exist first
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'rider_config' 
      AND COLUMN_NAME IN ('horse_enabled', 'rhib_enabled')
    `);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    
    // Add horse_enabled column if it doesn't exist
    if (!existingColumns.includes('horse_enabled')) {
      console.log('📋 Adding horse_enabled column...');
      await pool.query('ALTER TABLE rider_config ADD COLUMN horse_enabled TINYINT(1) NOT NULL DEFAULT 1');
      console.log('✅ Added horse_enabled column');
    } else {
      console.log('✅ horse_enabled column already exists');
    }
    
    // Add rhib_enabled column if it doesn't exist
    if (!existingColumns.includes('rhib_enabled')) {
      console.log('📋 Adding rhib_enabled column...');
      await pool.query('ALTER TABLE rider_config ADD COLUMN rhib_enabled TINYINT(1) NOT NULL DEFAULT 1');
      console.log('✅ Added rhib_enabled column');
    } else {
      console.log('✅ rhib_enabled column already exists');
    }
    
    console.log('\n🎉 Migration completed!');
    console.log('💡 New BAR options available:');
    console.log('   /set BAR-HORSE on/off <server> - Enable/disable horse');
    console.log('   /set BAR-RHIB on/off <server> - Enable/disable rhib');
    console.log('   /set BAR-USE on/off <server> - Enable/disable all vehicles');
    
  } catch (error) {
    console.error('❌ Error adding horse/rhib columns:', error);
  } finally {
    await pool.end();
  }
}

addHorseRhibColumns();
