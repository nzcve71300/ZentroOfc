const pool = require('./src/db');

const OLD_GUILD_ID = '1376431874699825216';
const NEW_GUILD_ID = '1413335350742614067';

async function fixShopMigration() {
  console.log('🔧 Fixing Shop Migration');
  console.log('========================\n');

  try {
    // Step 1: Get the server IDs
    console.log('📋 Step 1: Getting server information...');
    const [oldGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [OLD_GUILD_ID]);
    const [newGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [NEW_GUILD_ID]);
    
    if (oldGuild.length === 0 || newGuild.length === 0) {
      throw new Error('Guild records not found');
    }

    const [oldServers] = await pool.query('SELECT * FROM rust_servers WHERE guild_id = ?', [oldGuild[0].id]);
    const [newServers] = await pool.query('SELECT * FROM rust_servers WHERE guild_id = ?', [newGuild[0].id]);
    
    console.log(`Old guild servers: ${oldServers.length}`);
    console.log(`New guild servers: ${newServers.length}`);
    
    if (newServers.length === 0) {
      throw new Error('No servers found in new guild');
    }

    // Step 2: Find the server that was migrated
    console.log('\n📋 Step 2: Finding migrated server...');
    
    // Look for servers with the same nickname but different IDs
    let oldServerId = null;
    let newServerId = newServers[0].id;
    let serverNickname = newServers[0].nickname;
    
    console.log(`New server: ${serverNickname} (ID: ${newServerId})`);
    
    // Find the old server ID by looking for shop categories that should belong to this server
    const [categoriesForNewServer] = await pool.query(
      'SELECT * FROM shop_categories WHERE server_id = ?', 
      [newServerId]
    );
    
    console.log(`Categories currently linked to new server: ${categoriesForNewServer.length}`);
    
    // Look for categories that might belong to this server based on the server nickname
    const [allCategories] = await pool.query('SELECT DISTINCT server_id FROM shop_categories');
    console.log(`All server IDs in shop_categories: ${allCategories.map(c => c.server_id).join(', ')}`);
    
    // For now, let's assume we need to move categories from the most common old server ID
    // Based on the debug output, the old server ID was: 1754071898933_jg45hm1wj
    oldServerId = '1754071898933_jg45hm1wj';
    
    console.log(`Assuming old server ID: ${oldServerId}`);

    // Step 3: Update shop categories
    console.log('\n📋 Step 3: Updating shop categories...');
    const [categoriesToUpdate] = await pool.query(
      'SELECT * FROM shop_categories WHERE server_id = ?', 
      [oldServerId]
    );
    
    console.log(`Found ${categoriesToUpdate.length} categories to migrate`);
    
    if (categoriesToUpdate.length > 0) {
      await pool.query(
        'UPDATE shop_categories SET server_id = ? WHERE server_id = ?',
        [newServerId, oldServerId]
      );
      console.log(`✅ Updated ${categoriesToUpdate.length} shop categories`);
    }

    // Step 4: Update autokits
    console.log('\n📋 Step 4: Updating autokits...');
    const [autokitsToUpdate] = await pool.query(
      'SELECT * FROM autokits WHERE server_id = ?', 
      [oldServerId]
    );
    
    console.log(`Found ${autokitsToUpdate.length} autokits to migrate`);
    
    if (autokitsToUpdate.length > 0) {
      await pool.query(
        'UPDATE autokits SET server_id = ? WHERE server_id = ?',
        [newServerId, oldServerId]
      );
      console.log(`✅ Updated ${autokitsToUpdate.length} autokits`);
    }

    // Step 5: Update kit_auth
    console.log('\n📋 Step 5: Updating kit_auth...');
    const [kitAuthToUpdate] = await pool.query(
      'SELECT * FROM kit_auth WHERE server_id = ?', 
      [oldServerId]
    );
    
    console.log(`Found ${kitAuthToUpdate.length} kit_auth records to migrate`);
    
    if (kitAuthToUpdate.length > 0) {
      await pool.query(
        'UPDATE kit_auth SET server_id = ? WHERE server_id = ?',
        [newServerId, oldServerId]
      );
      console.log(`✅ Updated ${kitAuthToUpdate.length} kit_auth records`);
    }

    // Step 6: Update channel_settings
    console.log('\n📋 Step 6: Updating channel_settings...');
    const [channelSettingsToUpdate] = await pool.query(
      'SELECT * FROM channel_settings WHERE server_id = ?', 
      [oldServerId]
    );
    
    console.log(`Found ${channelSettingsToUpdate.length} channel_settings to migrate`);
    
    if (channelSettingsToUpdate.length > 0) {
      await pool.query(
        'UPDATE channel_settings SET server_id = ? WHERE server_id = ?',
        [newServerId, oldServerId]
      );
      console.log(`✅ Updated ${channelSettingsToUpdate.length} channel_settings`);
    }

    // Step 7: Update position_coordinates
    console.log('\n📋 Step 7: Updating position_coordinates...');
    const [positionCoordsToUpdate] = await pool.query(
      'SELECT * FROM position_coordinates WHERE server_id = ?', 
      [oldServerId]
    );
    
    console.log(`Found ${positionCoordsToUpdate.length} position_coordinates to migrate`);
    
    if (positionCoordsToUpdate.length > 0) {
      await pool.query(
        'UPDATE position_coordinates SET server_id = ? WHERE server_id = ?',
        [newServerId, oldServerId]
      );
      console.log(`✅ Updated ${positionCoordsToUpdate.length} position_coordinates`);
    }

    // Step 8: Update zones
    console.log('\n📋 Step 8: Updating zones...');
    const [zonesToUpdate] = await pool.query(
      'SELECT * FROM zones WHERE server_id = ?', 
      [oldServerId]
    );
    
    console.log(`Found ${zonesToUpdate.length} zones to migrate`);
    
    if (zonesToUpdate.length > 0) {
      await pool.query(
        'UPDATE zones SET server_id = ? WHERE server_id = ?',
        [newServerId, oldServerId]
      );
      console.log(`✅ Updated ${zonesToUpdate.length} zones`);
    }

    // Step 9: Update killfeed_configs
    console.log('\n📋 Step 9: Updating killfeed_configs...');
    const [killfeedConfigsToUpdate] = await pool.query(
      'SELECT * FROM killfeed_configs WHERE server_id = ?', 
      [oldServerId]
    );
    
    console.log(`Found ${killfeedConfigsToUpdate.length} killfeed_configs to migrate`);
    
    if (killfeedConfigsToUpdate.length > 0) {
      await pool.query(
        'UPDATE killfeed_configs SET server_id = ? WHERE server_id = ?',
        [newServerId, oldServerId]
      );
      console.log(`✅ Updated ${killfeedConfigsToUpdate.length} killfeed_configs`);
    }

    // Step 10: Update zorp_defaults
    console.log('\n📋 Step 10: Updating zorp_defaults...');
    const [zorpDefaultsToUpdate] = await pool.query(
      'SELECT * FROM zorp_defaults WHERE server_id = ?', 
      [oldServerId]
    );
    
    console.log(`Found ${zorpDefaultsToUpdate.length} zorp_defaults to migrate`);
    
    if (zorpDefaultsToUpdate.length > 0) {
      await pool.query(
        'UPDATE zorp_defaults SET server_id = ? WHERE server_id = ?',
        [newServerId, oldServerId]
      );
      console.log(`✅ Updated ${zorpDefaultsToUpdate.length} zorp_defaults`);
    }

    // Step 11: Verify the fix
    console.log('\n📋 Step 11: Verifying the fix...');
    const [finalCategories] = await pool.query(
      'SELECT * FROM shop_categories WHERE server_id = ?', 
      [newServerId]
    );
    
    console.log(`Categories now linked to new server: ${finalCategories.length}`);
    
    if (finalCategories.length > 0) {
      console.log('✅ Shop migration fix completed successfully!');
      console.log('\n📝 Summary:');
      console.log(`   - Server: ${serverNickname}`);
      console.log(`   - Shop categories migrated: ${finalCategories.length}`);
      console.log(`   - All server-related data should now be properly linked`);
    } else {
      console.log('❌ No categories found after migration - something went wrong');
    }

  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixShopMigration()
    .then(() => {
      console.log('\n🎉 Shop migration fix completed!');
      console.log('🔄 Try using the shop command again in the new Discord server');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixShopMigration };
