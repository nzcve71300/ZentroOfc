const mysql = require('mysql2/promise');
const config = require('./src/config');

async function findIGNLinksTable() {
  let pool;
  
  try {
    console.log('🔍 Finding where IGN links are actually stored...');
    console.log('================================================\n');
    
    // Create connection pool
    pool = mysql.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      port: config.db.port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // 1. Get all tables in the database
    console.log('📋 1. Finding all tables in the database');
    console.log('----------------------------------------');
    
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);
    
    console.log(`📊 Found ${tables.length} tables:`);
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.TABLE_NAME}`);
    });
    console.log('');

    // 2. Search for tables with IGN-related columns
    console.log('📋 2. Searching for tables with IGN-related columns');
    console.log('--------------------------------------------------');
    
    const possibleIGNColumns = [
      'ign', 'in_game_name', 'username', 'player_name', 'name',
      'game_name', 'rust_name', 'steam_name', 'display_name'
    ];
    
    const tablesWithIGN = [];
    
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      try {
        const [columns] = await pool.query(`
          SELECT COLUMN_NAME, DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()
        `, [tableName]);
        
        const columnNames = columns.map(col => col.COLUMN_NAME.toLowerCase());
        
        // Check if any IGN-related columns exist
        const foundIGNColumns = possibleIGNColumns.filter(ignCol => 
          columnNames.includes(ignCol.toLowerCase())
        );
        
        if (foundIGNColumns.length > 0) {
          tablesWithIGN.push({
            table: tableName,
            ignColumns: foundIGNColumns,
            allColumns: columns
          });
        }
      } catch (error) {
        // Skip tables that can't be queried
        continue;
      }
    }
    
    if (tablesWithIGN.length === 0) {
      console.log('❌ No tables found with IGN-related columns');
      console.log('   This suggests the IGN linking system might be broken');
    } else {
      console.log(`✅ Found ${tablesWithIGN.length} tables with IGN-related columns:`);
      tablesWithIGN.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.table}`);
        console.log(`      IGN columns: ${table.ignColumns.join(', ')}`);
        console.log(`      All columns: ${table.allColumns.map(c => c.COLUMN_NAME).join(', ')}`);
        console.log('');
      });
    }

    // 3. Check for Discord-related columns
    console.log('📋 3. Searching for tables with Discord-related columns');
    console.log('-----------------------------------------------------');
    
    const possibleDiscordColumns = [
      'discord_id', 'discord_user_id', 'user_id', 'linked_by_user_id',
      'discord_guild_id', 'guild_id', 'server_id'
    ];
    
    const tablesWithDiscord = [];
    
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      try {
        const [columns] = await pool.query(`
          SELECT COLUMN_NAME, DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()
        `, [tableName]);
        
        const columnNames = columns.map(col => col.COLUMN_NAME.toLowerCase());
        
        // Check if any Discord-related columns exist
        const foundDiscordColumns = possibleDiscordColumns.filter(discordCol => 
          columnNames.includes(discordCol.toLowerCase())
        );
        
        if (foundDiscordColumns.length > 0) {
          tablesWithDiscord.push({
            table: tableName,
            discordColumns: foundDiscordColumns,
            allColumns: columns
          });
        }
      } catch (error) {
        // Skip tables that can't be queried
        continue;
      }
    }
    
    if (tablesWithDiscord.length === 0) {
      console.log('❌ No tables found with Discord-related columns');
    } else {
      console.log(`✅ Found ${tablesWithDiscord.length} tables with Discord-related columns:`);
      tablesWithDiscord.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.table}`);
        console.log(`      Discord columns: ${table.discordColumns.join(', ')}`);
        console.log(`      All columns: ${table.allColumns.map(c => c.COLUMN_NAME).join(', ')}`);
        console.log('');
      });
    }

    // 4. Look for tables that might contain both IGN and Discord data
    console.log('📋 4. Looking for potential linking tables');
    console.log('----------------------------------------');
    
    const potentialLinkingTables = [];
    
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      try {
        const [columns] = await pool.query(`
          SELECT COLUMN_NAME, DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()
        `, [tableName]);
        
        const columnNames = columns.map(col => col.COLUMN_NAME.toLowerCase());
        
        // Check if table has both IGN and Discord columns
        const hasIGN = possibleIGNColumns.some(ignCol => 
          columnNames.includes(ignCol.toLowerCase())
        );
        const hasDiscord = possibleDiscordColumns.some(discordCol => 
          columnNames.includes(discordCol.toLowerCase())
        );
        
        if (hasIGN && hasDiscord) {
          potentialLinkingTables.push({
            table: tableName,
            columns: columns
          });
        }
      } catch (error) {
        // Skip tables that can't be queried
        continue;
      }
    }
    
    if (potentialLinkingTables.length === 0) {
      console.log('❌ No tables found with both IGN and Discord columns');
      console.log('   This suggests the linking system might be split across multiple tables');
    } else {
      console.log(`✅ Found ${potentialLinkingTables.length} potential linking tables:`);
      potentialLinkingTables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.table}`);
        console.log(`      Columns: ${table.columns.map(c => c.COLUMN_NAME).join(', ')}`);
        console.log('');
      });
    }

    // 5. Check for any data in the current discord_links table
    console.log('📋 5. Checking current discord_links table data');
    console.log('---------------------------------------------');
    
    try {
      const [discordLinksData] = await pool.query(`
        SELECT * FROM discord_links 
        ORDER BY linked_at DESC 
        LIMIT 5
      `);
      
      if (discordLinksData.length === 0) {
        console.log('✅ discord_links table is empty');
      } else {
        console.log(`📊 Found ${discordLinksData.length} recent entries in discord_links:`);
        discordLinksData.forEach((entry, index) => {
          console.log(`   ${index + 1}. ID: ${entry.id} | Store ID: ${entry.store_id} | Guild: ${entry.discord_guild_name} | Linked by: ${entry.linked_by_user_id} | Active: ${entry.is_active}`);
        });
      }
    } catch (error) {
      console.log('❌ Error querying discord_links table:', error.message);
    }
    console.log('');

    // 6. Summary and recommendations
    console.log('📋 6. Summary and Recommendations');
    console.log('==================================');
    
    if (tablesWithIGN.length === 0) {
      console.log('🚨 CRITICAL ISSUE: No IGN columns found in any table!');
      console.log('   This means the IGN linking system is completely broken');
      console.log('');
      console.log('🔧 IMMEDIATE ACTIONS NEEDED:');
      console.log('   1. Check if the bot is using the wrong database');
      console.log('   2. Verify if there are multiple databases');
      console.log('   3. Check if the linking system was never properly implemented');
      console.log('   4. Look for alternative linking mechanisms');
    } else if (potentialLinkingTables.length === 0) {
      console.log('⚠️  PARTIAL ISSUE: IGN columns exist but no linking tables found');
      console.log('   The linking system might be split across multiple tables');
      console.log('');
      console.log('🔧 RECOMMENDATIONS:');
      console.log('   1. Check if IGN and Discord data are in separate tables');
      console.log('   2. Look for foreign key relationships between tables');
      console.log('   3. Verify if the bot is joining tables correctly');
    } else {
      console.log('✅ POTENTIAL SOLUTION: Found tables with both IGN and Discord columns');
      console.log('   These tables might be the correct linking tables');
      console.log('');
      console.log('🔧 NEXT STEPS:');
      console.log('   1. Check the bot code to see which table it should be using');
      console.log('   2. Verify if the bot is querying the wrong table');
      console.log('   3. Update the bot to use the correct table structure');
    }

  } catch (error) {
    console.error('❌ Error during investigation:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the investigation function
findIGNLinksTable().then(() => {
  console.log('\n🎯 Investigation completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Investigation failed:', error);
  process.exit(1);
});
