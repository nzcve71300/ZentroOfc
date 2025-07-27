const pool = require('./src/db');

async function testPositionTable() {
  try {
    console.log('Testing position_coordinates table...');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'position_coordinates'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ position_coordinates table does not exist!');
      return;
    }
    
    console.log('✅ position_coordinates table exists');
    
    // Check table structure
    const structureCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'position_coordinates'
      ORDER BY ordinal_position
    `);
    
    console.log('Table structure:');
    structureCheck.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Test inserting a sample record
    console.log('\nTesting insert...');
    await pool.query(`
      INSERT INTO position_coordinates (server_id, position_type, x_pos, y_pos, z_pos)
      VALUES (1, 'test', '100', '200', '300')
      ON CONFLICT (server_id, position_type) DO UPDATE SET
      x_pos = EXCLUDED.x_pos,
      y_pos = EXCLUDED.y_pos,
      z_pos = EXCLUDED.z_pos,
      updated_at = NOW()
    `);
    console.log('✅ Insert test successful');
    
    // Test querying
    const queryTest = await pool.query(`
      SELECT * FROM position_coordinates WHERE position_type = 'test'
    `);
    console.log('✅ Query test successful');
    console.log('Sample record:', queryTest.rows[0]);
    
  } catch (error) {
    console.error('❌ Error testing position_coordinates table:', error);
  } finally {
    await pool.end();
  }
}

testPositionTable(); 