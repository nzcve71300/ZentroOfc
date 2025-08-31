const pool = require('./src/db');

async function checkTransactionsTable() {
  try {
    console.log('🔍 Checking transactions table structure...');
    
    const [columns] = await pool.query('DESCRIBE transactions');
    console.log('Transactions table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });
    
    console.log('\n📋 Sample transaction record:');
    const [sample] = await pool.query('SELECT * FROM transactions LIMIT 1');
    if (sample.length > 0) {
      console.log(sample[0]);
    } else {
      console.log('No transactions found');
    }
    
  } catch (error) {
    console.error('❌ Error checking transactions table:', error);
  } finally {
    await pool.end();
  }
}

checkTransactionsTable();
