const pool = require('./src/db');

const OLD_GUILD_ID = '1376431874699825216';
const NEW_GUILD_ID = '1413335350742614067';

async function debugShopMigration() {
  console.log('🔍 Debugging Shop Migration');
  console.log('============================\n');

  try {
    // Step 1: Check guild records
    console.log('📋 Step 1: Checking guild records...');
    const [oldGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [OLD_GUILD_ID]);
    const [newGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [NEW_GUILD_ID]);
    
    console.log(`Old guild: ${oldGuild.length > 0 ? `ID ${oldGuild[0].id}` : 'Not found'}`);
    console.log(`New guild: ${newGuild.length > 0 ? `ID ${newGuild[0].id}` : 'Not found'}`);

    if (oldGuild.length === 0 || newGuild.length === 0) {
      console.log('❌ Guild records not found');
      return;
    }

    const oldGuildId = oldGuild[0].id;
    const newGuildId = newGuild[0].id;

    // Step 2: Check server records
    console.log('\n📋 Step 2: Checking server records...');
    const [oldServers] = await pool.query('SELECT * FROM rust_servers WHERE guild_id = ?', [oldGuildId]);
    const [newServers] = await pool.query('SELECT * FROM rust_servers WHERE guild_id = ?', [newGuildId]);
    
    console.log(`Old guild servers: ${oldServers.length}`);
    oldServers.forEach(server => {
      console.log(`   - ${server.nickname} (ID: ${server.id})`);
    });
    
    console.log(`New guild servers: ${newServers.length}`);
    newServers.forEach(server => {
      console.log(`   - ${server.nickname} (ID: ${server.id})`);
    });

    // Step 3: Check shop categories
    console.log('\n📋 Step 3: Checking shop categories...');
    const [allCategories] = await pool.query('SELECT * FROM shop_categories');
    console.log(`Total shop categories: ${allCategories.length}`);
    
    allCategories.forEach(category => {
      console.log(`   - ${category.name} (Type: ${category.type}, Server ID: ${category.server_id})`);
    });

    // Step 4: Check shop items
    console.log('\n📋 Step 4: Checking shop items...');
    const [allItems] = await pool.query('SELECT * FROM shop_items');
    console.log(`Total shop items: ${allItems.length}`);
    
    allItems.forEach(item => {
      console.log(`   - ${item.display_name} (Category ID: ${item.category_id}, Price: ${item.price})`);
    });

    // Step 5: Check shop kits
    console.log('\n📋 Step 5: Checking shop kits...');
    const [allKits] = await pool.query('SELECT * FROM shop_kits');
    console.log(`Total shop kits: ${allKits.length}`);
    
    allKits.forEach(kit => {
      console.log(`   - ${kit.display_name} (Category ID: ${kit.category_id}, Price: ${kit.price})`);
    });

    // Step 6: Check relationships
    console.log('\n📋 Step 6: Checking relationships...');
    if (newServers.length > 0) {
      const newServerId = newServers[0].id;
      console.log(`Checking data for new server ID: ${newServerId}`);
      
      const [categoriesForNewServer] = await pool.query(
        'SELECT * FROM shop_categories WHERE server_id = ?', 
        [newServerId]
      );
      console.log(`Categories for new server: ${categoriesForNewServer.length}`);
      
      if (categoriesForNewServer.length > 0) {
        categoriesForNewServer.forEach(category => {
          console.log(`   - ${category.name} (Type: ${category.type})`);
        });
      }
    }

    // Step 7: Check if we need to fix the relationships
    console.log('\n📋 Step 7: Analyzing migration issues...');
    
    if (oldServers.length > 0 && newServers.length > 0) {
      const oldServerId = oldServers[0].id;
      const newServerId = newServers[0].id;
      
      console.log(`Old server ID: ${oldServerId}`);
      console.log(`New server ID: ${newServerId}`);
      
      // Check if shop data is still linked to old server
      const [categoriesOnOldServer] = await pool.query(
        'SELECT * FROM shop_categories WHERE server_id = ?', 
        [oldServerId]
      );
      
      const [categoriesOnNewServer] = await pool.query(
        'SELECT * FROM shop_categories WHERE server_id = ?', 
        [newServerId]
      );
      
      console.log(`Categories on old server: ${categoriesOnOldServer.length}`);
      console.log(`Categories on new server: ${categoriesOnNewServer.length}`);
      
      if (categoriesOnOldServer.length > 0 && categoriesOnNewServer.length === 0) {
        console.log('❌ ISSUE FOUND: Shop categories are still linked to old server!');
        console.log('🔧 This needs to be fixed by updating the server_id references');
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
if (require.main === module) {
  debugShopMigration()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugShopMigration };
