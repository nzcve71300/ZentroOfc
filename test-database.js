const pool = require('./src/db');

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const [result] = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection working');
    
    // Check if guilds table exists and has data
    const [guilds] = await pool.query('SELECT * FROM guilds LIMIT 5');
    console.log('Guilds found:', guilds.length);
    
    // Check if rust_servers table exists and has data
    const [servers] = await pool.query('SELECT * FROM rust_servers LIMIT 5');
    console.log('Servers found:', servers.length);
    
    if (servers.length > 0) {
      console.log('Sample servers:');
      servers.forEach(server => {
        console.log(`  - ID: ${server.id}, Name: ${server.nickname}, Guild ID: ${server.guild_id}`);
      });
    }
    
    // Test the autocomplete query
    const [autocompleteResult] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      ['123456789', '%']  // Using a dummy guild ID
    );
    console.log('Autocomplete query result:', autocompleteResult.length, 'servers found');
    
  } catch (error) {
    console.error('Database test failed:', error);
  } finally {
    process.exit(0);
  }
}

testDatabase(); 