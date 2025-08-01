const pool = require('./src/db');

async function fixPositionConstraint() {
  try {
    console.log('🔧 Fixing Position Constraint...');
    
    // Check the table structure and constraints
    console.log('\n1. Checking zorp_zones table structure...');
    const [columns] = await pool.query('DESCRIBE zorp_zones');
    console.log('Columns in zorp_zones:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key || ''}`);
    });
    
    // Check for any constraints on the position column
    console.log('\n2. Checking for position constraints...');
    try {
      const [constraints] = await pool.query(`
        SELECT 
          CONSTRAINT_NAME,
          COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = 'zentro_bot' 
        AND TABLE_NAME = 'zorp_zones'
        AND COLUMN_NAME = 'position'
      `);
      
      console.log('Position constraints found:');
      constraints.forEach(constraint => {
        console.log(`  - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME}`);
      });
      
      if (constraints.length > 0) {
        console.log('\n3. Attempting to drop position constraints...');
        for (const constraint of constraints) {
          try {
            await pool.query(`ALTER TABLE zorp_zones DROP CONSTRAINT ${constraint.CONSTRAINT_NAME}`);
            console.log(`✅ Dropped constraint: ${constraint.CONSTRAINT_NAME}`);
          } catch (error) {
            console.log(`⚠️  Could not drop constraint ${constraint.CONSTRAINT_NAME}: ${error.message}`);
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️  Could not check constraints: ${error.message}`);
    }
    
    // Test inserting a zone with the correct position format
    console.log('\n4. Testing zone insertion...');
    
    const testZone = {
      server_id: '1753965211295_c5pfupu9',
      name: 'TEST_ZONE',
      owner: 'nzcve7130',
      team: null,
      position: '8.19 69.21 -973.43',
      size: 40,
      color_online: '0,255,0',
      color_offline: '255,0,0',
      radiation: 0,
      delay: 0,
      expire: 126000,
      min_team: 1,
      max_team: 8
    };
    
    const insertQuery = `
      INSERT INTO zorp_zones (
        server_id, name, owner, team, position, size, 
        color_online, color_offline, radiation, delay, expire, 
        min_team, max_team, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    try {
      await pool.query(insertQuery, [
        testZone.server_id,
        testZone.name,
        testZone.owner,
        testZone.team,
        testZone.position,
        testZone.size,
        testZone.color_online,
        testZone.color_offline,
        testZone.radiation,
        testZone.delay,
        testZone.expire,
        testZone.min_team,
        testZone.max_team
      ]);
      console.log('✅ Test zone insertion successful');
      
      // Clean up test zone
      await pool.query('DELETE FROM zorp_zones WHERE name = ?', [testZone.name]);
      console.log('✅ Test zone cleaned up');
      
    } catch (error) {
      console.log(`❌ Test zone insertion failed: ${error.message}`);
      
      // Try to get more details about the constraint
      console.log('\n5. Checking constraint details...');
      try {
        const [constraintDetails] = await pool.query(`
          SELECT 
            CONSTRAINT_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
          FROM information_schema.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = 'zentro_bot' 
          AND TABLE_NAME = 'zorp_zones'
        `);
        
        console.log('All constraints on zorp_zones:');
        constraintDetails.forEach(constraint => {
          console.log(`  - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
        });
        
      } catch (detailError) {
        console.log(`⚠️  Could not get constraint details: ${detailError.message}`);
      }
    }
    
    console.log('\n🎉 Position constraint check completed!');
    
  } catch (error) {
    console.error('❌ Error fixing position constraint:', error);
  } finally {
    await pool.end();
  }
}

fixPositionConstraint(); 