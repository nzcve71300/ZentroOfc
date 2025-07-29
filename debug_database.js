const pool = require('./src/db');

async function debugDatabase() {
  try {
    console.log('🔍 Debugging database issues...');
    
    // Test the exact query that's failing
    console.log('📋 Testing the failing query...');
    
    const result = await pool.query(`
      SELECT * FROM players 
      WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
      AND discord_id = $2
      AND LOWER(ign) != LOWER($3)
      AND is_active = true
    `, [123456789, 987654321, 'test']);
    
    console.log('✅ Query executed successfully!');
    console.log('📊 Result rows:', result.rows.length);
    
    // Check if the column actually exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' AND column_name = 'is_active'
    `);
    
    console.log('🔍 is_active column exists:', columnCheck.rows.length > 0);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ is_active column exists in database');
    } else {
      console.log('❌ is_active column does NOT exist in database');
    }
    
    // Check what database we're connected to
    const dbInfo = await pool.query('SELECT current_database() as db_name');
    console.log('🗄️  Connected to database:', dbInfo.rows[0].db_name);
    
    // Check table structure
    const tableStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Table structure:');
    tableStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error position:', error.position);
  } finally {
    await pool.end();
  }
}

debugDatabase();