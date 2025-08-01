const pool = require('./src/db');
const fs = require('fs');

async function setupSubscriptionTable() {
  try {
    console.log('🔧 Setting up subscriptions table...');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync('./create_subscription_table.sql', 'utf8');
    
    // Execute the SQL
    await pool.query(sqlContent);
    
    console.log('✅ Subscriptions table created successfully!');
    
    // Verify the table exists
    const [result] = await pool.query('SHOW TABLES LIKE "subscriptions"');
    
    if (result.length > 0) {
      console.log('✅ Table verification successful - subscriptions table exists');
      
      // Show table structure
      const [structure] = await pool.query('DESCRIBE subscriptions');
      console.log('📋 Table structure:');
      structure.forEach(row => {
        console.log(`   ${row.Field} - ${row.Type} - ${row.Null} - ${row.Key} - ${row.Default}`);
      });
    } else {
      console.log('❌ Table verification failed - subscriptions table not found');
    }
    
  } catch (error) {
    console.error('❌ Error setting up subscriptions table:', error);
  } finally {
    await pool.end();
  }
}

setupSubscriptionTable(); 