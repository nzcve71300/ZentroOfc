const pool = require('./src/db');

async function checkConstraints() {
  try {
    console.log('🔍 Checking players table constraints...');
    
    // Check for triggers
    const [triggers] = await pool.query(
      'SHOW TRIGGERS WHERE `Table` = "players"'
    );
    console.log('Triggers on players table:', triggers);
    
    // Check for foreign key constraints
    const [foreignKeys] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'players' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.log('Foreign key constraints:', foreignKeys);
    
    // Check for check constraints
    const [checkConstraints] = await pool.query(`
      SELECT 
        CONSTRAINT_NAME,
        CHECK_CLAUSE
      FROM information_schema.CHECK_CONSTRAINTS 
      WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_NAME = 'players' 
        AND CONSTRAINT_NAME = information_schema.CHECK_CONSTRAINTS.CONSTRAINT_NAME
      )
    `);
    console.log('Check constraints:', checkConstraints);
    
    // Check the actual table structure again
    const [columns] = await pool.query('DESCRIBE players');
    console.log('Players table structure:');
    columns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key === 'PRI' ? '(PRIMARY)' : col.Key === 'MUL' ? '(INDEX)' : ''} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  } finally {
    await pool.end();
  }
}

checkConstraints();
