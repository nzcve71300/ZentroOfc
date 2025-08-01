const pool = require('./src/db');

async function checkRustServersStructure() {
  try {
    console.log('🔍 Checking rust_servers table structure...');

    // Get table structure
    const [columns] = await pool.query('DESCRIBE rust_servers');
    console.log(`Found ${columns.length} columns in rust_servers table:`);
    
    columns.forEach((column, index) => {
      console.log(`\n${index + 1}. Column:`);
      console.log(`   Field: ${column.Field}`);
      console.log(`   Type: ${column.Type}`);
      console.log(`   Null: ${column.Null}`);
      console.log(`   Key: ${column.Key}`);
      console.log(`   Default: ${column.Default}`);
    });

    // Check current server data
    const [servers] = await pool.query('SELECT * FROM rust_servers LIMIT 1');
    if (servers.length > 0) {
      console.log(`\n📋 Sample server data:`);
      console.log(JSON.stringify(servers[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkRustServersStructure(); 