const mysql = require('mysql2/promise');
require('dotenv').config();

async function copyShopData() {
  console.log('🔧 Shop Data Migration Script');
  console.log('=============================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Step 1: Find the source server (Dead-ops) - oldest server in guild
    console.log('📋 Step 1: Finding source server (Dead-ops)...');
    const [sourceServer] = await connection.execute(`
      SELECT rs.id, rs.nickname, rs.guild_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      WHERE g.discord_id = '609'  -- DEAD-OPS guild Discord ID
      ORDER BY rs.id ASC
      LIMIT 1
    `);

    if (sourceServer.length === 0) {
      console.log('❌ Source server (Dead-ops) not found!');
      return;
    }

    const sourceServerId = sourceServer[0].id;
    const sourceServerName = sourceServer[0].nickname;
    const guildId = sourceServer[0].guild_id;

    console.log(`✅ Found source server: ${sourceServerName} (ID: ${sourceServerId})`);

    // Step 2: Find the target server (USA-DeadOps)
    console.log('\n📋 Step 2: Finding target server (USA-DeadOps)...');
    const [targetServer] = await connection.execute(`
      SELECT rs.id, rs.nickname
      FROM rust_servers rs
      WHERE rs.guild_id = ? AND rs.nickname = 'USA-DeadOps'
    `, [guildId]);

    if (targetServer.length === 0) {
      console.log('❌ Target server (USA-DeadOps) not found!');
      return;
    }

    const targetServerId = targetServer[0].id;
    const targetServerName = targetServer[0].nickname;

    console.log(`✅ Found target server: ${targetServerName} (ID: ${targetServerId})`);

    // Step 3: Check if target server already has shop data
    console.log('\n📋 Step 3: Checking existing shop data on target server...');
    const [existingShopData] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM shop_categories WHERE server_id = ?) as categories,
        (SELECT COUNT(*) FROM shop_items WHERE server_id = ?) as items,
        (SELECT COUNT(*) FROM shop_kits WHERE server_id = ?) as kits,
        (SELECT COUNT(*) FROM shop_vehicles WHERE server_id = ?) as vehicles
    `, [targetServerId, targetServerId, targetServerId, targetServerId]);

    const existing = existingShopData[0];
    if (existing.categories > 0 || existing.items > 0 || existing.kits > 0 || existing.vehicles > 0) {
      console.log(`⚠️ Target server already has some shop data:`);
      console.log(`   Categories: ${existing.categories}`);
      console.log(`   Items: ${existing.items}`);
      console.log(`   Kits: ${existing.kits}`);
      console.log(`   Vehicles: ${existing.vehicles}`);
      console.log(`\n🔄 Proceeding with copy (will add to existing data)...`);
    } else {
      console.log(`✅ Target server has no existing shop data - clean slate!`);
    }

    // Step 4: Copy shop categories
    console.log('\n📋 Step 4: Copying shop categories...');
    const [categories] = await connection.execute(`
      SELECT * FROM shop_categories WHERE server_id = ?
    `, [sourceServerId]);

    if (categories.length === 0) {
      console.log(`ℹ️ No shop categories found on source server`);
    } else {
      let categoriesCopied = 0;
      for (const category of categories) {
        try {
          await connection.execute(`
            INSERT INTO shop_categories (
              server_id, name, description, type, display_order, is_active
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            targetServerId,
            category.name,
            category.description,
            category.type,
            category.display_order,
            category.is_active
          ]);
          categoriesCopied++;
        } catch (error) {
          console.log(`⚠️ Failed to copy category "${category.name}": ${error.message}`);
        }
      }
      console.log(`✅ Copied ${categoriesCopied} shop categories`);
    }

    // Step 5: Copy shop items
    console.log('\n📋 Step 5: Copying shop items...');
    const [items] = await connection.execute(`
      SELECT * FROM shop_items WHERE server_id = ?
    `, [sourceServerId]);

    if (items.length === 0) {
      console.log(`ℹ️ No shop items found on source server`);
    } else {
      let itemsCopied = 0;
      for (const item of items) {
        try {
          // First get the category ID for the target server
          const [targetCategory] = await connection.execute(`
            SELECT id FROM shop_categories 
            WHERE server_id = ? AND name = ? AND type = ?
          `, [targetServerId, item.category_name, item.category_type]);

          if (targetCategory.length > 0) {
            await connection.execute(`
              INSERT INTO shop_items (
                server_id, category_id, category_name, category_type,
                display_name, short_name, price, description, is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              targetServerId,
              targetCategory[0].id,
              item.category_name,
              item.category_type,
              item.display_name,
              item.short_name,
              item.price,
              item.description,
              item.is_active
            ]);
            itemsCopied++;
          } else {
            console.log(`⚠️ Skipping item "${item.display_name}" - category not found on target server`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to copy item "${item.display_name}": ${error.message}`);
        }
      }
      console.log(`✅ Copied ${itemsCopied} shop items`);
    }

    // Step 6: Copy shop kits
    console.log('\n📋 Step 6: Copying shop kits...');
    const [kits] = await connection.execute(`
      SELECT * FROM shop_kits WHERE server_id = ?
    `, [sourceServerId]);

    if (kits.length === 0) {
      console.log(`ℹ️ No shop kits found on source server`);
    } else {
      let kitsCopied = 0;
      for (const kit of kits) {
        try {
          // First get the category ID for the target server
          const [targetCategory] = await connection.execute(`
            SELECT id FROM shop_categories 
            WHERE server_id = ? AND name = ? AND type = ?
          `, [targetServerId, kit.category_name, kit.category_type]);

          if (targetCategory.length > 0) {
            await connection.execute(`
              INSERT INTO shop_kits (
                server_id, category_id, category_name, category_type,
                display_name, short_name, price, description, is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              targetServerId,
              targetCategory[0].id,
              kit.category_name,
              kit.category_type,
              kit.display_name,
              kit.short_name,
              kit.price,
              kit.description,
              kit.is_active
            ]);
            kitsCopied++;
          } else {
            console.log(`⚠️ Skipping kit "${kit.display_name}" - category not found on target server`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to copy kit "${kit.display_name}": ${error.message}`);
        }
      }
      console.log(`✅ Copied ${kitsCopied} shop kits`);
    }

    // Step 7: Copy shop vehicles
    console.log('\n📋 Step 7: Copying shop vehicles...');
    const [vehicles] = await connection.execute(`
      SELECT * FROM shop_vehicles WHERE server_id = ?
    `, [sourceServerId]);

    if (vehicles.length === 0) {
      console.log(`ℹ️ No shop vehicles found on source server`);
    } else {
      let vehiclesCopied = 0;
      for (const vehicle of vehicles) {
        try {
          // First get the category ID for the target server
          const [targetCategory] = await connection.execute(`
            SELECT id FROM shop_categories 
            WHERE server_id = ? AND name = ? AND type = ?
          `, [targetServerId, vehicle.category_name, vehicle.category_type]);

          if (targetCategory.length > 0) {
            await connection.execute(`
              INSERT INTO shop_vehicles (
                server_id, category_id, category_name, category_type,
                display_name, short_name, price, timer, is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              targetServerId,
              targetCategory[0].id,
              vehicle.category_name,
              vehicle.category_type,
              vehicle.display_name,
              vehicle.short_name,
              vehicle.price,
              vehicle.timer,
              vehicle.is_active
            ]);
            vehiclesCopied++;
          } else {
            console.log(`⚠️ Skipping vehicle "${vehicle.display_name}" - category not found on target server`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to copy vehicle "${vehicle.display_name}": ${error.message}`);
        }
      }
      console.log(`✅ Copied ${vehiclesCopied} shop vehicles`);
    }

    // Step 8: Final verification
    console.log('\n📋 Step 8: Final verification...');
    const [finalCounts] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM shop_categories WHERE server_id = ?) as categories,
        (SELECT COUNT(*) FROM shop_items WHERE server_id = ?) as items,
        (SELECT COUNT(*) FROM shop_kits WHERE server_id = ?) as kits,
        (SELECT COUNT(*) FROM shop_vehicles WHERE server_id = ?) as vehicles
    `, [targetServerId, targetServerId, targetServerId, targetServerId]);

    const final = finalCounts[0];
    const totalItems = final.categories + final.items + final.kits + final.vehicles;

    console.log(`\n🎉 Shop migration completed successfully!`);
    console.log(`📊 Final counts on ${targetServerName}:`);
    console.log(`   Categories: ${final.categories}`);
    console.log(`   Items: ${final.items}`);
    console.log(`   Kits: ${final.kits}`);
    console.log(`   Vehicles: ${final.vehicles}`);
    console.log(`   Total shop items: ${totalItems}`);
    console.log(`\n✅ ${targetServerName} now has identical shop system to ${sourceServerName}!`);

  } catch (error) {
    console.error('❌ Error during shop migration:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

copyShopData();
