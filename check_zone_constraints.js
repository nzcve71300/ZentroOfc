const pool = require('./src/db');

async function checkZoneConstraints() {
  try {
    console.log('🔍 Checking Zone Database Constraints...');
    
    // Check table structure
    console.log('\n1. Checking zorp_zones table structure...');
    const [columns] = await pool.query('DESCRIBE zorp_zones');
    console.log('Columns in zorp_zones:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key || ''}`);
    });
    
    // Check constraints
    console.log('\n2. Checking table constraints...');
    const [constraints] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        CONSTRAINT_TYPE
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'zentro_bot' 
      AND TABLE_NAME = 'zorp_zones'
    `);
    
    console.log('Constraints found:');
    constraints.forEach(constraint => {
      console.log(`  - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} (${constraint.CONSTRAINT_TYPE})`);
    });
    
    // Check current zone data
    console.log('\n3. Checking current zone data...');
    const [zones] = await pool.query('SELECT id, name, position, LENGTH(position) as pos_length FROM zorp_zones LIMIT 3');
    console.log('Current zones:');
    zones.forEach(zone => {
      console.log(`  - ${zone.name}: position="${zone.position}" (length: ${zone.pos_length})`);
    });
    
    // Test different position formats
    console.log('\n4. Testing position format updates...');
    
    const testFormats = [
      '8.19 69.21 -973.43',
      '8.19,69.21,-973.43',
      '[8.19,69.21,-973.43]',
      '8.19, 69.21, -973.43'
    ];
    
    for (const format of testFormats) {
      try {
        console.log(`\nTesting format: "${format}"`);
        const [testResult] = await pool.query(
          'UPDATE zorp_zones SET position = ? WHERE id = ?',
          [format, zones[0].id]
        );
        console.log(`✅ Success: ${testResult.affectedRows} rows updated`);
        
        // Revert back to original
        await pool.query(
          'UPDATE zorp_zones SET position = ? WHERE id = ?',
          [zones[0].position, zones[0].id]
        );
        console.log('✅ Reverted to original');
        
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Constraint check completed!');
    
  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  } finally {
    await pool.end();
  }
}

checkZoneConstraints(); 