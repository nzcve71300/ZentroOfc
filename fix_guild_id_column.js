const pool = require('./src/db');

async function fixGuildIdColumn() {
  try {
    console.log('🔧 Fixing guild_id column in rust_servers table...');
    
    // Check current column type
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'zentro_bot' 
      AND TABLE_NAME = 'rust_servers' 
      AND COLUMN_NAME = 'guild_id'
    `);
    
    console.log('Current guild_id column info:', columns[0]);
    
    if (columns.length > 0) {
      const column = columns[0];
      
      // Check if it needs to be updated
      if (column.DATA_TYPE === 'int' || column.DATA_TYPE === 'bigint') {
        const precision = parseInt(column.NUMERIC_PRECISION);
        
        if (precision < 20) {
          console.log('⚠️ guild_id column is too small for Discord IDs. Updating...');
          
          // Update the column to BIGINT UNSIGNED
          await pool.query(`
            ALTER TABLE rust_servers 
            MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
          `);
          
          console.log('✅ Successfully updated guild_id column to BIGINT UNSIGNED');
        } else {
          console.log('✅ guild_id column is already large enough');
        }
      } else {
        console.log('⚠️ guild_id column is not numeric. Converting...');
        
        // Convert to BIGINT UNSIGNED
        await pool.query(`
          ALTER TABLE rust_servers 
          MODIFY COLUMN guild_id BIGINT UNSIGNED NOT NULL
        `);
        
        console.log('✅ Successfully converted guild_id column to BIGINT UNSIGNED');
      }
    } else {
      console.log('❌ guild_id column not found in rust_servers table');
    }
    
    // Verify the fix
    const [verifyColumns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'zentro_bot' 
      AND TABLE_NAME = 'rust_servers' 
      AND COLUMN_NAME = 'guild_id'
    `);
    
    if (verifyColumns.length > 0) {
      const verifyColumn = verifyColumns[0];
      console.log('✅ Verified guild_id column:', verifyColumn);
      
      if (verifyColumn.DATA_TYPE === 'bigint' && parseInt(verifyColumn.NUMERIC_PRECISION) >= 20) {
        console.log('🎉 guild_id column is now properly sized for Discord IDs!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error fixing guild_id column:', error);
  } finally {
    await pool.end();
  }
}

fixGuildIdColumn(); 