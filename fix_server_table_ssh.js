const pool = require('./src/db');

async function fixServerTable() {
  try {
    console.log('🔧 Checking rust_servers table structure...');
    
    // Check current table structure
    const [columns] = await pool.query('DESCRIBE rust_servers');
    console.log('📋 Current rust_servers table columns:');
    columns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });
    
    // Check if rcon_password column exists
    const hasRconPassword = columns.some(col => col.Field === 'rcon_password');
    
    if (!hasRconPassword) {
      console.log('\n➕ Adding rcon_password column...');
      await pool.query('ALTER TABLE rust_servers ADD COLUMN rcon_password VARCHAR(255)');
      console.log('✅ Added rcon_password column');
    } else {
      console.log('✅ rcon_password column already exists');
    }
    
    // Check if rcon_port column exists (some versions use this instead)
    const hasRconPort = columns.some(col => col.Field === 'rcon_port');
    
    if (!hasRconPort) {
      console.log('\n➕ Adding rcon_port column...');
      await pool.query('ALTER TABLE rust_servers ADD COLUMN rcon_port INT DEFAULT 28016');
      console.log('✅ Added rcon_port column');
    } else {
      console.log('✅ rcon_port column already exists');
    }
    
    // Show final table structure
    const [finalColumns] = await pool.query('DESCRIBE rust_servers');
    console.log('\n📋 Final rust_servers table columns:');
    finalColumns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
    });
    
    console.log('\n🎉 Table structure fixed!');
    console.log('💡 Now you can run the add_real_server_ssh.js script again');
    
  } catch (error) {
    console.error('❌ Error fixing table structure:', error);
  } finally {
    await pool.end();
  }
}

fixServerTable(); 