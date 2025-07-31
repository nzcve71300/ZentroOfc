const pool = require('./src/db');

async function fixDiscordIdNullError() {
  try {
    console.log('🔧 Fixing discord_id NULL error...');
    
    // Check current table structure
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'zentro_bot' 
      AND TABLE_NAME = 'players' 
      AND COLUMN_NAME = 'discord_id'
    `);
    
    console.log('Current discord_id column settings:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: NULL=${col.IS_NULLABLE}, Default=${col.COLUMN_DEFAULT}`);
    });
    
    // Fix the column to allow NULL values
    console.log('\n🛠️ Updating discord_id column to allow NULL...');
    await pool.query('ALTER TABLE players MODIFY COLUMN discord_id VARCHAR(255) NULL');
    
    console.log('✅ Fixed discord_id column to allow NULL values');
    console.log('\n📝 This will allow new players to be added without Discord IDs');
    console.log('Players can later link their Discord accounts using /link command');
    
  } catch (error) {
    console.error('❌ Error fixing discord_id column:', error);
  } finally {
    process.exit(0);
  }
}

fixDiscordIdNullError(); 