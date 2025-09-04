const pool = require('./src/db');

async function debugShopCommand() {
  console.log('🔍 DEBUGGING SHOP COMMAND');
  console.log('=====================================\n');

  try {
    // Test database connection
    console.log('📋 Step 1: Testing database connection...');
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully!\n');

    // Test guild lookup
    console.log('📋 Step 2: Testing guild lookup...');
    const guildId = '1387187628469653555'; // DeadOps Discord guild ID
    
    const [guildResult] = await connection.query(
      'SELECT id, name FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildResult.length === 0) {
      console.log('❌ Guild not found in database');
      return;
    }
    
    const dbGuildId = guildResult[0].id;
    console.log(`✅ Found guild: ${guildResult[0].name} (DB ID: ${dbGuildId})\n`);

    // Test server lookup
    console.log('📋 Step 3: Testing server lookup...');
    const [serversResult] = await connection.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = ?',
      [dbGuildId]
    );
    
    console.log(`✅ Found ${serversResult.length} servers:`);
    serversResult.forEach(server => {
      console.log(`   - ${server.nickname} (ID: ${server.id})`);
    });
    console.log('');

    // Test shop categories
    console.log('📋 Step 4: Testing shop categories...');
    for (const server of serversResult) {
      const [categoriesResult] = await connection.query(
        'SELECT id, name, type, role FROM shop_categories WHERE server_id = ?',
        [server.id]
      );
      
      console.log(`📦 ${server.nickname}: ${categoriesResult.length} categories`);
      if (categoriesResult.length > 0) {
        categoriesResult.forEach(cat => {
          console.log(`   - ${cat.name} (${cat.type})${cat.role ? ` [Role: ${cat.role}]` : ''}`);
        });
      } else {
        console.log(`   ⚠️  No categories found - need to create with /add-shop-category`);
      }
      console.log('');
    }

    // Test player lookup
    console.log('📋 Step 5: Testing player lookup...');
    const testDiscordId = '123456789'; // Test Discord ID
    const [playerResult] = await connection.query(
      `SELECT p.*, e.balance 
       FROM players p
       LEFT JOIN economy e ON p.id = e.player_id
       WHERE p.guild_id = ? AND p.discord_id = ? AND p.is_active = true
       LIMIT 1`,
      [dbGuildId, testDiscordId]
    );
    
    if (playerResult.length > 0) {
      console.log(`✅ Found test player: ${playerResult[0].ign} (Balance: ${playerResult[0].balance || 0})`);
    } else {
      console.log('⚠️  No test player found (this is normal for testing)');
    }
    console.log('');

    // Test economy table
    console.log('📋 Step 6: Testing economy table...');
    const [economyResult] = await connection.query(
      'SELECT COUNT(*) as count FROM economy WHERE guild_id = ?',
      [dbGuildId]
    );
    console.log(`✅ Economy records: ${economyResult[0].count}`);

    // Test shop tables structure
    console.log('\n📋 Step 7: Testing shop tables structure...');
    
    // Check shop_categories table
    try {
      const [categoriesStructure] = await connection.query('DESCRIBE shop_categories');
      console.log('✅ shop_categories table exists with columns:');
      categoriesStructure.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type})`);
      });
    } catch (error) {
      console.log('❌ shop_categories table error:', error.message);
    }

    // Check shop_items table
    try {
      const [itemsStructure] = await connection.query('DESCRIBE shop_items');
      console.log('\n✅ shop_items table exists with columns:');
      itemsStructure.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type})`);
      });
    } catch (error) {
      console.log('❌ shop_items table error:', error.message);
    }

    // Check shop_kits table
    try {
      const [kitsStructure] = await connection.query('DESCRIBE shop_kits');
      console.log('\n✅ shop_kits table exists with columns:');
      kitsStructure.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type})`);
      });
    } catch (error) {
      console.log('❌ shop_kits table error:', error.message);
    }

    connection.release();
    console.log('\n✅ Shop command debug complete!');

  } catch (error) {
    console.error('❌ Error debugging shop command:', error);
  }
}

debugShopCommand();
