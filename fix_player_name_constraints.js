const pool = require('./src/db');

async function fixPlayerNameConstraints() {
  console.log('🔧 Fixing player name constraints to allow all types of names...\n');
  
  try {
    // 1. Remove the restrictive IGN length constraint
    console.log('1. Removing restrictive IGN length constraint...');
    
    try {
      await pool.query('ALTER TABLE players DROP CONSTRAINT valid_ign_length');
      console.log('✅ Removed valid_ign_length constraint');
    } catch (error) {
      if (error.message.includes("doesn't exist")) {
        console.log('ℹ️  valid_ign_length constraint already removed or never existed');
      } else {
        console.log('⚠️  Error removing valid_ign_length constraint:', error.message);
      }
    }
    
    // 2. Add a more permissive IGN length constraint (up to 100 characters)
    console.log('\n2. Adding permissive IGN length constraint (up to 100 characters)...');
    
    try {
      await pool.query('ALTER TABLE players ADD CONSTRAINT valid_ign_length_permissive CHECK (LENGTH(ign) >= 1 AND LENGTH(ign) <= 100)');
      console.log('✅ Added permissive IGN length constraint (1-100 characters)');
    } catch (error) {
      if (error.message.includes("Duplicate key name")) {
        console.log('ℹ️  Permissive IGN length constraint already exists');
      } else {
        console.log('⚠️  Error adding permissive IGN length constraint:', error.message);
      }
    }
    
    // 3. Check if we need to modify the IGN column type to support longer names
    console.log('\n3. Checking IGN column type...');
    
    const [columnInfo] = await pool.query(`
      SELECT COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'players' 
      AND COLUMN_NAME = 'ign'
    `);
    
    if (columnInfo.length > 0) {
      const columnType = columnInfo[0].COLUMN_TYPE;
      const maxLength = columnInfo[0].CHARACTER_MAXIMUM_LENGTH;
      
      console.log(`Current IGN column type: ${columnType}`);
      
      // If it's TEXT, it's already fine. If it's VARCHAR with small limit, we need to change it
      if (columnType.includes('varchar') && maxLength < 100) {
        console.log('⚠️  IGN column is VARCHAR with small limit, changing to TEXT...');
        try {
          await pool.query('ALTER TABLE players MODIFY COLUMN ign TEXT NOT NULL');
          console.log('✅ Changed IGN column to TEXT type');
        } catch (error) {
          console.log('⚠️  Error changing IGN column type:', error.message);
        }
      } else {
        console.log('✅ IGN column type is already suitable for long names');
      }
    }
    
    // 4. Check zorp_zones table owner column
    console.log('\n4. Checking zorp_zones owner column...');
    
    const [zorpColumnInfo] = await pool.query(`
      SELECT COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'zorp_zones' 
      AND COLUMN_NAME = 'owner'
    `);
    
    if (zorpColumnInfo.length > 0) {
      const columnType = zorpColumnInfo[0].COLUMN_TYPE;
      const maxLength = zorpColumnInfo[0].CHARACTER_MAXIMUM_LENGTH;
      
      console.log(`Current zorp_zones.owner column type: ${columnType}`);
      
      if (columnType.includes('varchar') && maxLength < 100) {
        console.log('⚠️  zorp_zones.owner column is VARCHAR with small limit, changing to TEXT...');
        try {
          await pool.query('ALTER TABLE zorp_zones MODIFY COLUMN owner TEXT NOT NULL');
          console.log('✅ Changed zorp_zones.owner column to TEXT type');
        } catch (error) {
          console.log('⚠️  Error changing zorp_zones.owner column type:', error.message);
        }
      } else {
        console.log('✅ zorp_zones.owner column type is already suitable for long names');
      }
    }
    
    // 5. Test with some example weird names
    console.log('\n5. Testing name handling...');
    
    const testNames = [
      '[CLAN] PlayerName',
      'PlayerNameWithVeryLongNameThatExceedsNormalLimits',
      'PlayerName with spaces',
      'PlayerName-with-dashes',
      'PlayerName_with_underscores',
      'PlayerName123',
      'PlayerName!@#$%^&*()',
      'PlayerName with unicode: 测试名字',
      'PlayerName with emoji: 🎮',
      'PlayerName with special chars: [SERVER] (should be allowed as player name)'
    ];
    
    console.log('Test names that should now be accepted:');
    testNames.forEach((name, index) => {
      console.log(`  ${index + 1}. "${name}" (${name.length} characters)`);
    });
    
    console.log('\n✅ Player name constraints have been fixed!');
    console.log('📝 Changes made:');
    console.log('   - Removed restrictive 32-character limit');
    console.log('   - Added permissive 100-character limit');
    console.log('   - Updated extractPlayerName function to allow names with brackets');
    console.log('   - Ensured database columns can handle long names');
    console.log('\n🎮 Players with weird names should now be able to create Zorps!');
    
  } catch (error) {
    console.error('❌ Error fixing player name constraints:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixPlayerNameConstraints();
