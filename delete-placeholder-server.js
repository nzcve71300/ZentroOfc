const pool = require('./src/db');

async function deletePlaceholderServer() {
  try {
    console.log('🗑️ Deleting placeholder server...');
    
    // Delete the placeholder server
    const [result] = await pool.query('DELETE FROM rust_servers WHERE nickname = "Unknown Server"');
    
    if (result.affectedRows > 0) {
      console.log('✅ Successfully deleted placeholder server');
      console.log('\n📝 Now you can add a proper server using:');
      console.log('/setup-server server_name: "RISE 3X" ip: "your.server.ip" port: 28016 password: "your_rcon_password"');
    } else {
      console.log('❌ No placeholder server found to delete');
    }
    
  } catch (error) {
    console.error('❌ Error deleting placeholder server:', error);
  } finally {
    process.exit(0);
  }
}

deletePlaceholderServer(); 