const pool = require('./src/db');

async function fixRustServersId() {
  try {
    console.log('🔧 Fixing rust_servers table id column...');
    
    // Check current table structure
    const [columns] = await pool.query(`
      DESCRIBE rust_servers
    `);
    
    console.log('Current rust_servers structure:', columns);
    
    // Check if id column exists and its properties
    const idColumn = columns.find(col => col.Field === 'id');
    
    if (idColumn) {
      console.log('Found id column:', idColumn);
      
      if (idColumn.Extra !== 'auto_increment') {
        console.log('Making id column auto-increment...');
        
        // Make the id column auto-increment
        await pool.query(`
          ALTER TABLE rust_servers 
          MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY
        `);
        
        console.log('✅ Successfully made id column auto-increment');
      } else {
        console.log('✅ id column is already auto-increment');
      }
    } else {
      console.log('No id column found, adding one...');
      
      // Add id column as auto-increment primary key
      await pool.query(`
        ALTER TABLE rust_servers 
        ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST
      `);
      
      console.log('✅ Successfully added id column as auto-increment primary key');
    }
    
    // Verify the fix
    const [verifyColumns] = await pool.query(`
      DESCRIBE rust_servers
    `);
    
    const verifyIdColumn = verifyColumns.find(col => col.Field === 'id');
    if (verifyIdColumn && verifyIdColumn.Extra === 'auto_increment') {
      console.log('🎉 rust_servers.id is now properly configured as auto-increment!');
    }
    
  } catch (error) {
    console.error('❌ Error fixing rust_servers id column:', error);
  } finally {
    await pool.end();
  }
}

fixRustServersId(); 