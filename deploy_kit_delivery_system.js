const pool = require('./src/db');
const fs = require('fs');

async function deployKitDeliverySystem() {
  console.log('🚀 Deploying Kit Delivery System...\n');
  
  try {
    // Step 1: Create the kit delivery queue table
    console.log('1. Creating kit delivery queue table...');
    const createTableSQL = fs.readFileSync('./sql/create_kit_queue_table.sql', 'utf8');
    await pool.query(createTableSQL);
    console.log('✅ Kit delivery queue table created successfully!\n');
    
    // Step 2: Test database connection and verify table structure
    console.log('2. Verifying table structure...');
    const [tableInfo] = await pool.query('DESCRIBE kit_delivery_queue');
    console.log('✅ Table structure verified:');
    tableInfo.forEach(column => {
      console.log(`   - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `(${column.Key})` : ''}`);
    });
    console.log('');
    
    // Step 3: Check for any existing queue entries (should be empty on first run)
    console.log('3. Checking existing queue entries...');
    const [existingEntries] = await pool.query('SELECT COUNT(*) as count FROM kit_delivery_queue');
    console.log(`✅ Found ${existingEntries[0].count} existing queue entries\n`);
    
    // Step 4: Verify shop_kits table exists and has required columns
    console.log('4. Verifying shop_kits table compatibility...');
    const [shopKitsInfo] = await pool.query('DESCRIBE shop_kits');
    const requiredColumns = ['id', 'display_name', 'kit_name', 'price', 'quantity'];
    const existingColumns = shopKitsInfo.map(col => col.Field);
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    if (missingColumns.length > 0) {
      console.log('❌ Missing required columns in shop_kits table:', missingColumns);
      throw new Error('shop_kits table is missing required columns');
    }
    console.log('✅ shop_kits table has all required columns\n');
    
    // Step 5: Test the system with a mock query (no actual insertion)
    console.log('5. Testing system queries...');
    const testQuery = `
      SELECT kdq.*, rs.ip, rs.port, rs.password, rs.nickname, p.ign, p.discord_id
      FROM kit_delivery_queue kdq
      JOIN rust_servers rs ON kdq.server_id = rs.id
      JOIN players p ON kdq.player_id = p.id
      WHERE kdq.message_id = ? AND kdq.remaining_quantity > 0
    `;
    // Test the query structure (will return empty result but validates syntax)
    await pool.query(testQuery, ['test_message_id']);
    console.log('✅ System queries validated\n');
    
    console.log('🎉 Kit Delivery System deployment completed successfully!');
    console.log('\n📋 System Features:');
    console.log('   • Kits with quantity > 1 are added to delivery queue');
    console.log('   • Users react with 📦 emoji to claim one kit at a time');
    console.log('   • 5-second cooldown between kit claims (anti-spam)');
    console.log('   • Real-time embed updates showing remaining quantity');
    console.log('   • In-game notifications for deliveries and cooldowns');
    console.log('   • Automatic cleanup when all kits are delivered');
    console.log('   • Admin feed logging for all kit deliveries\n');
    
    console.log('🔧 Modified Files:');
    console.log('   • src/events/interactionCreate.js - Modified purchase flow');
    console.log('   • src/index.js - Added reaction event handler');
    console.log('   • src/utils/kitDeliveryHandler.js - New kit delivery logic');
    console.log('   • sql/create_kit_queue_table.sql - New database table\n');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    console.error('\nPlease check the error above and run the deployment again.');
    process.exit(1);
  }
}

// Also create a cleanup utility for old queue entries
async function cleanupOldQueueEntries() {
  console.log('🧹 Cleaning up old kit delivery queue entries...\n');
  
  try {
    // Remove entries older than 7 days
    const [result] = await pool.query(
      'DELETE FROM kit_delivery_queue WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    
    console.log(`✅ Cleaned up ${result.affectedRows} old queue entries (older than 7 days)`);
    
    // Remove entries with 0 remaining quantity (shouldn't happen but just in case)
    const [zeroResult] = await pool.query(
      'DELETE FROM kit_delivery_queue WHERE remaining_quantity <= 0'
    );
    
    console.log(`✅ Cleaned up ${zeroResult.affectedRows} completed queue entries`);
    
    // Show current active entries
    const [activeEntries] = await pool.query(`
      SELECT kdq.display_name, kdq.remaining_quantity, kdq.created_at, p.ign, rs.nickname
      FROM kit_delivery_queue kdq
      JOIN players p ON kdq.player_id = p.id
      JOIN rust_servers rs ON kdq.server_id = rs.id
      ORDER BY kdq.created_at DESC
    `);
    
    console.log(`\n📊 Current active queue entries: ${activeEntries.length}`);
    activeEntries.forEach(entry => {
      console.log(`   • ${entry.ign} - ${entry.display_name} x${entry.remaining_quantity} on ${entry.nickname} (${entry.created_at})`);
    });
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run deployment if this script is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    cleanupOldQueueEntries().then(() => process.exit(0));
  } else {
    deployKitDeliverySystem().then(() => process.exit(0));
  }
}

module.exports = {
  deployKitDeliverySystem,
  cleanupOldQueueEntries
};
