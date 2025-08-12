const pool = require('./src/db');

async function checkTables() {
  try {
    console.log('🔍 Checking table structures...');
    
    // Check shop_items table
    console.log('\n📋 shop_items table structure:');
    const [shopItemsColumns] = await pool.query('DESCRIBE shop_items');
    console.table(shopItemsColumns);
    
    // Check shop_kits table
    console.log('\n📋 shop_kits table structure:');
    const [shopKitsColumns] = await pool.query('DESCRIBE shop_kits');
    console.table(shopKitsColumns);
    
    // Check shop_categories table
    console.log('\n📋 shop_categories table structure:');
    const [shopCategoriesColumns] = await pool.query('DESCRIBE shop_categories');
    console.table(shopCategoriesColumns);
    
    // Check zones table
    console.log('\n📋 zones table structure:');
    const [zonesColumns] = await pool.query('DESCRIBE zones');
    console.table(zonesColumns);
    
    // Check channel_settings table
    console.log('\n📋 channel_settings table structure:');
    const [channelSettingsColumns] = await pool.query('DESCRIBE channel_settings');
    console.table(channelSettingsColumns);
    
    // Check position_coordinates table
    console.log('\n📋 position_coordinates table structure:');
    const [positionCoordinatesColumns] = await pool.query('DESCRIBE position_coordinates');
    console.table(positionCoordinatesColumns);
    
    // Check link_requests table
    console.log('\n📋 link_requests table structure:');
    const [linkRequestsColumns] = await pool.query('DESCRIBE link_requests');
    console.table(linkRequestsColumns);
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    await pool.end();
  }
}

checkTables(); 