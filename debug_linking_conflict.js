const mysql = require('mysql2/promise');
const config = require('./src/config');

async function debugLinkingConflict() {
  let pool;
  
  try {
    console.log('🔍 Debugging Discord Linking Conflict for IGN: Cholessss');
    console.log('==================================================\n');
    
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

    const targetIGN = 'Cholessss';
    const targetServer = 'Dead-ops';

    // 1. First, check the actual table structure
    console.log('📋 1. Checking discord_links table structure');
    console.log('--------------------------------------------');
    
    try {
      const [tableInfo] = await pool.query(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'discord_links' 
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('📋 discord_links table structure:');
      tableInfo.forEach(col => {
        console.log(`   ${col.COLUMN_NAME}: ${col.DATA_TYPE} | Nullable: ${col.IS_NULLABLE} | Default: ${col.COLUMN_DEFAULT}`);
      });
    } catch (error) {
      console.log('❌ Could not retrieve table structure:', error.message);
    }
    console.log('');

    // 2. Check all discord_links for this IGN across ALL servers
    console.log('📋 2. Checking ALL discord_links for IGN:', targetIGN);
    console.log('--------------------------------------------------');
    
    // Let's try different possible column names
    let allLinks = [];
    let columnName = null;
    
    // Try common column names for IGN
    const possibleColumns = ['ign', 'in_game_name', 'username', 'player_name', 'name'];
    
    for (const col of possibleColumns) {
      try {
        const [result] = await pool.query(`
          SELECT 
            dl.*,
            rs.nickname as server_name,
            rs.guild_id,
            g.discord_id as guild_discord_id
          FROM discord_links dl
          LEFT JOIN rust_servers rs ON dl.server_id = rs.id
          LEFT JOIN guilds g ON rs.guild_id = g.id
          WHERE LOWER(dl.${col}) = LOWER(?)
          ORDER BY dl.created_at DESC
        `, [targetIGN]);
        
        if (result.length > 0) {
          allLinks = result;
          columnName = col;
          console.log(`✅ Found column: ${col}`);
          break;
        }
      } catch (error) {
        // Column doesn't exist, try next one
        continue;
      }
    }
    
    if (!columnName) {
      console.log('❌ Could not find IGN column in discord_links table');
      console.log('   Tried columns:', possibleColumns.join(', '));
    }

    if (allLinks.length === 0) {
      console.log('✅ No discord_links found for IGN:', targetIGN);
    } else {
      console.log(`⚠️  Found ${allLinks.length} discord_links for IGN:`, targetIGN);
      allLinks.forEach((link, index) => {
        console.log(`   ${index + 1}. Server: ${link.server_name || 'Unknown'} | Discord ID: ${link.discord_id} | Created: ${link.created_at}`);
      });
    }
    console.log('');

    // 3. Check the specific server (Dead-ops)
    console.log('📋 3. Checking server:', targetServer);
    console.log('------------------------');
    
    const [serverInfo] = await pool.query(`
      SELECT 
        rs.*,
        g.discord_id as guild_discord_id
      FROM rust_servers rs
      LEFT JOIN guilds g ON rs.guild_id = g.id
      WHERE rs.nickname = ?
    `, [targetServer]);

    if (serverInfo.length === 0) {
      console.log('❌ Server not found:', targetServer);
      return;
    }

    const server = serverInfo[0];
    console.log(`✅ Server found: ${server.nickname} (ID: ${server.id})`);
    console.log(`   Guild ID: ${server.guild_id} | Discord ID: ${server.guild_discord_id}`);
    console.log('');

    // 4. Check discord_links specifically for this server
    console.log('📋 4. Checking discord_links for server:', targetServer);
    console.log('------------------------------------------------');
    
    let serverLinks = [];
    if (columnName) {
      try {
        const [result] = await pool.query(`
          SELECT 
            dl.*,
            rs.nickname as server_name
          FROM discord_links dl
          JOIN rust_servers rs ON dl.server_id = rs.id
          WHERE rs.nickname = ? AND LOWER(dl.${columnName}) = LOWER(?)
        `, [targetServer, targetIGN]);
        serverLinks = result;
      } catch (error) {
        console.log('❌ Error querying server-specific links:', error.message);
      }
    } else {
      console.log('❌ Cannot query server-specific links - no IGN column found');
    }

    if (serverLinks.length === 0) {
      console.log('✅ No discord_links found for IGN:', targetIGN, 'on server:', targetServer);
    } else {
      console.log(`⚠️  Found ${serverLinks.length} discord_links for IGN:`, targetIGN, 'on server:', targetServer);
      serverLinks.forEach((link, index) => {
        console.log(`   ${index + 1}. Discord ID: ${link.discord_id} | Created: ${link.created_at} | Updated: ${link.updated_at}`);
      });
    }
    console.log('');

    // 5. Check for case-insensitive matches
    console.log('📋 5. Checking for case-insensitive IGN matches');
    console.log('----------------------------------------------');
    
    let caseMatches = [];
    if (columnName) {
      try {
        const [result] = await pool.query(`
          SELECT 
            dl.${columnName} as ign,
            dl.discord_id,
            dl.server_id,
            rs.nickname as server_name
          FROM discord_links dl
          LEFT JOIN rust_servers rs ON dl.server_id = rs.id
          WHERE dl.${columnName} LIKE ? OR dl.${columnName} LIKE ? OR dl.${columnName} LIKE ?
        `, [`%${targetIGN}%`, `%${targetIGN.toLowerCase()}%`, `%${targetIGN.toUpperCase()}%`]);
        caseMatches = result;
      } catch (error) {
        console.log('❌ Error querying case-insensitive matches:', error.message);
      }
    } else {
      console.log('❌ Cannot query case-insensitive matches - no IGN column found');
    }

    if (caseMatches.length === 0) {
      console.log('✅ No case-insensitive matches found');
    } else {
      console.log(`⚠️  Found ${caseMatches.length} case-insensitive matches:`);
      caseMatches.forEach((match, index) => {
        console.log(`   ${index + 1}. IGN: "${match.ign}" | Discord ID: ${match.discord_id} | Server: ${match.server_name || 'Unknown'}`);
      });
    }
    console.log('');

    // 6. Check recent linking activity
    console.log('📋 6. Checking recent linking activity (last 24 hours)');
    console.log('----------------------------------------------------');
    
    let recentActivity = [];
    if (columnName) {
      try {
        const [result] = await pool.query(`
          SELECT 
            dl.${columnName} as ign,
            dl.discord_id,
            dl.created_at,
            rs.nickname as server_name
          FROM discord_links dl
          LEFT JOIN rust_servers rs ON dl.server_id = rs.id
          WHERE dl.created_at >= NOW() - INTERVAL 24 HOUR
          ORDER BY dl.created_at DESC
          LIMIT 10
        `);
        recentActivity = result;
      } catch (error) {
        console.log('❌ Error querying recent activity:', error.message);
      }
    } else {
      console.log('❌ Cannot query recent activity - no IGN column found');
    }

    if (recentActivity.length === 0) {
      console.log('✅ No recent linking activity in the last 24 hours');
    } else {
      console.log(`📊 Recent linking activity (last 24 hours):`);
      recentActivity.forEach((activity, index) => {
        console.log(`   ${index + 1}. IGN: ${activity.ign} | Discord ID: ${activity.discord_id} | Server: ${activity.server_name || 'Unknown'} | Time: ${activity.created_at}`);
      });
    }
    console.log('');

    // 7. Summary and recommendations
    console.log('📋 7. Summary and Recommendations');
    console.log('==================================');
    
    if (allLinks.length === 0) {
      console.log('✅ CONCLUSION: No database conflicts found');
      console.log('   This suggests a BOT LOGIC BUG, not a database issue');
      console.log('   The bot is incorrectly thinking the IGN is already linked');
      console.log('');
      console.log('🔧 RECOMMENDATIONS:');
      console.log('   1. Check the bot\'s linking logic for false positives');
      console.log('   2. Look for case sensitivity bugs in the code');
      console.log('   3. Check if the bot is querying the wrong server_id');
      console.log('   4. Verify the guild_id to server_id mapping');
    } else {
      console.log('⚠️  CONCLUSION: Database conflicts found');
      console.log(`   Found ${allLinks.length} existing links for IGN: ${targetIGN}`);
      console.log('');
      console.log('🔧 RECOMMENDATIONS:');
      console.log('   1. Review each conflicting link for legitimacy');
      console.log('   2. Remove invalid/expired links');
      console.log('   3. Contact players to verify ownership');
      console.log('   4. Consider implementing IGN change tracking');
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the debug function
debugLinkingConflict().then(() => {
  console.log('\n🎯 Debug script completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
