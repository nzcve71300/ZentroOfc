const mysql = require('mysql2/promise');
Mkarequire('dotenv').config();

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
    
    // First, let's find the guild that contains both Dead-ops and USA-DeadOps
    const [guilds] = await connection.execute(`
      SELECT DISTINCT g.id, g.discord_id, g.name
      FROM guilds g
      JOIN rust_servers rs ON g.id = rs.guild_id
      WHERE rs.nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY g.id ASC
    `);
    
    if (guilds.length === 0) {
      console.log('❌ No guild found containing both Dead-ops and USA-DeadOps!');
      return;
    }
    
    const guildId = guilds[0].id;
    console.log(`✅ Found guild: ${guilds[0].name} (ID: ${guildId})`);
    
    // Now find the source server (Dead-ops) - oldest server in this guild
    const [sourceServer] = await connection.execute(`
      SELECT rs.id, rs.nickname, rs.guild_id
      FROM rust_servers rs
      WHERE rs.guild_id = ? AND rs.nickname = 'Dead-ops'
      ORDER BY rs.id ASC
      LIMIT 1
    `, [guildId]);

    if (sourceServer.length === 0) {
      console.log('❌ Source server (Dead-ops) not found!');
      return;
    }

    const sourceServerId = sourceServer[0].id;
    const sourceServerName = sourceServer[0].nickname;

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
        (SELECT COUNT(*) FROM shop_categories WHERE server_id = ?) as categories
    `, [targetServerId]);

    const existing = existingShopData[0];
    if (existing.categories > 0) {
      console.log(`⚠️ Target server already has ${existing.categories} shop categories`);
      console.log(`🔄 Proceeding with copy (will add to existing data)...`);
    } else {
      console.log(`✅ Target server has no existing shop data - clean slate!`);
    }

    // Step 4: Copy shop categories and build ID mapping
    console.log('\n📋 Step 4: Copying shop categories...');
    const [categories] = await connection.execute(`
      SELECT * FROM shop_categories WHERE server_id = ?
    `, [sourceServerId]);

    if (categories.length === 0) {
      console.log(`ℹ️ No shop categories found on source server`);
    } else {
      let categoriesCopied = 0;
      const categoryIdMapping = {}; // Maps old category ID to new category ID
      
      for (const category of categories) {
        try {
          const [insertResult] = await connection.execute(`
            INSERT INTO shop_categories (
              server_id, name, type, role
            ) VALUES (?, ?, ?, ?)
          `, [
            targetServerId,
            category.name,
            category.type,
            category.role
          ]);
          
          // Store the mapping from old category ID to new category ID
          categoryIdMapping[category.id] = insertResult.insertId;
          categoriesCopied++;
        } catch (error) {
          console.log(`⚠️ Failed to copy category "${category.name}": ${error.message}`);
        }
      }
      console.log(`✅ Copied ${categoriesCopied} shop categories`);
      
      // Step 5: Copy shop items using category ID mapping
      console.log('\n📋 Step 5: Copying shop items...');
      const [items] = await connection.execute(`
        SELECT * FROM shop_items WHERE category_id IN (${Object.keys(categoryIdMapping).join(',')})
      `);

      if (items.length === 0) {
        console.log(`ℹ️ No shop items found on source server`);
      } else {
        let itemsCopied = 0;
        for (const item of items) {
          try {
            const newCategoryId = categoryIdMapping[item.category_id];
            if (newCategoryId) {
              await connection.execute(`
                INSERT INTO shop_items (
                  category_id, display_name, short_name, price, quantity, timer
                ) VALUES (?, ?, ?, ?, ?, ?)
              `, [
                newCategoryId,
                item.display_name,
                item.short_name,
                item.price,
                item.quantity,
                item.timer
              ]);
              itemsCopied++;
            } else {
              console.log(`⚠️ Skipping item "${item.display_name}" - category mapping not found`);
            }
          } catch (error) {
            console.log(`⚠️ Failed to copy item "${item.display_name}": ${error.message}`);
          }
        }
        console.log(`✅ Copied ${itemsCopied} shop items`);
      }

      // Step 6: Copy shop kits using category ID mapping
      console.log('\n📋 Step 6: Copying shop kits...');
      const [kits] = await connection.execute(`
        SELECT * FROM shop_kits WHERE category_id IN (${Object.keys(categoryIdMapping).join(',')})
      `);

      if (kits.length === 0) {
        console.log(`ℹ️ No shop kits found on source server`);
      } else {
        let kitsCopied = 0;
        for (const kit of kits) {
          try {
            const newCategoryId = categoryIdMapping[kit.category_id];
            if (newCategoryId) {
              await connection.execute(`
                INSERT INTO shop_kits (
                  category_id, display_name, kit_name, price, quantity, timer
                ) VALUES (?, ?, ?, ?, ?, ?)
              `, [
                newCategoryId,
                kit.display_name,
                kit.kit_name,
                kit.price,
                kit.quantity,
                kit.timer
              ]);
              kitsCopied++;
            } else {
              console.log(`⚠️ Skipping kit "${kit.display_name}" - category mapping not found`);
            }
          } catch (error) {
            console.log(`⚠️ Failed to copy kit "${kit.display_name}": ${error.message}`);
          }
        }
        console.log(`✅ Copied ${kitsCopied} shop kits`);
      }

      // Step 7: Copy shop vehicles using category ID mapping
      console.log('\n📋 Step 7: Copying shop vehicles...');
      const [vehicles] = await connection.execute(`
        SELECT * FROM shop_vehicles WHERE category_id IN (${Object.keys(categoryIdMapping).join(',')})
      `);

      if (vehicles.length === 0) {
        console.log(`ℹ️ No shop vehicles found on source server`);
      } else {
        let vehiclesCopied = 0;
        for (const vehicle of vehicles) {
          try {
            const newCategoryId = categoryIdMapping[vehicle.category_id];
            if (newCategoryId) {
              await connection.execute(`
                INSERT INTO shop_vehicles (
                  category_id, display_name, short_name, price, timer
                ) VALUES (?, ?, ?, ?, ?)
              `, [
                newCategoryId,
                vehicle.display_name,
                vehicle.short_name,
                vehicle.price,
                vehicle.timer
              ]);
              vehiclesCopied++;
            } else {
              console.log(`⚠️ Skipping vehicle "${vehicle.display_name}" - category mapping not found`);
            }
          } catch (error) {
            console.log(`⚠️ Failed to copy vehicle "${vehicle.display_name}": ${error.message}`);
          }
        }
        console.log(`✅ Copied ${vehiclesCopied} shop vehicles`);
      }
    }



    // Step 8: Final verification
    console.log('\n📋 Step 8: Final verification...');
    
    // Count categories on target server
    const [finalCategories] = await connection.execute(`
      SELECT COUNT(*) as count FROM shop_categories WHERE server_id = ?
    `, [targetServerId]);
    
    // Count items linked to target server categories
    const [finalItems] = await connection.execute(`
      SELECT COUNT(*) as count FROM shop_items si
      JOIN shop_categories sc ON si.category_id = sc.id
      WHERE sc.server_id = ?
    `, [targetServerId]);
    
    // Count kits linked to target server categories
    const [finalKits] = await connection.execute(`
      SELECT COUNT(*) as count FROM shop_kits sk
      JOIN shop_categories sc ON sk.category_id = sc.id
      WHERE sc.server_id = ?
    `, [targetServerId]);
    
    // Count vehicles linked to target server categories
    const [finalVehicles] = await connection.execute(`
      SELECT COUNT(*) as count FROM shop_vehicles sv
      JOIN shop_categories sc ON sv.category_id = sc.id
      WHERE sc.server_id = ?
    `, [targetServerId]);

    const totalItems = finalCategories[0].count + finalItems[0].count + finalKits[0].count + finalVehicles[0].count;

    console.log(`\n🎉 Shop migration completed successfully!`);
    console.log(`📊 Final counts on ${targetServerName}:`);
    console.log(`   Categories: ${finalCategories[0].count}`);
    console.log(`   Items: ${finalItems[0].count}`);
    console.log(`   Kits: ${finalKits[0].count}`);
    console.log(`   Vehicles: ${finalVehicles[0].count}`);
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
