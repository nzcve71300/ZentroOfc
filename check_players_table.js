const mysql = require('mysql2/promise');
const config = require('./src/config');

async function checkPlayersTable() {
  let pool;
  
  try {
    console.log('🔍 Checking players table for Cholessss IGN...');
    console.log('==============================================\n');
    
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

    // 1. Check players table structure
    console.log('📋 1. Checking players table structure');
    console.log('-------------------------------------');
    
    const [tableInfo] = await pool.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'players' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 players table structure:');
    tableInfo.forEach(col => {
      console.log(`   ${col.COLUMN_NAME}: ${col.DATA_TYPE} | Nullable: ${col.IS_NULLABLE} | Default: ${col.COLUMN_DEFAULT}`);
    });
    console.log('');

    // 2. Check for the specific IGN in players table
    console.log('📋 2. Checking for IGN in players table');
    console.log('--------------------------------------');
    
    const [ignMatches] = await pool.query(`
      SELECT 
        p.*,
        rs.nickname as server_name,
        g.discord_id as guild_discord_id
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN guilds g ON p.guild_id = g.id
      WHERE LOWER(p.ign) = LOWER(?)
      ORDER BY p.linked_at DESC
    `, [targetIGN]);

    if (ignMatches.length === 0) {
      console.log('✅ No records found for IGN:', targetIGN);
    } else {
      console.log(`⚠️  Found ${ignMatches.length} records for IGN:`, targetIGN);
      ignMatches.forEach((match, index) => {
        console.log(`   ${index + 1}. ID: ${match.id} | Discord ID: ${match.discord_id} | Server: ${match.server_name || 'Unknown'} | Guild: ${match.guild_discord_id} | Active: ${match.is_active} | Linked: ${match.linked_at}`);
      });
    }
    console.log('');

    // 3. Check for the specific server
    console.log('📋 3. Checking server information');
    console.log('--------------------------------');
    
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

    // 4. Check for IGN on specific server
    console.log('📋 4. Checking for IGN on specific server');
    console.log('---------------------------------------');
    
    const [serverIgnMatches] = await pool.query(`
      SELECT 
        p.*,
        rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE rs.nickname = ? AND LOWER(p.ign) = LOWER(?)
      ORDER BY p.linked_at DESC
    `, [targetServer, targetIGN]);

    if (serverIgnMatches.length === 0) {
      console.log('✅ No records found for IGN:', targetIGN, 'on server:', targetServer);
    } else {
      console.log(`⚠️  Found ${serverIgnMatches.length} records for IGN:`, targetIGN, 'on server:', targetServer);
      serverIgnMatches.forEach((match, index) => {
        console.log(`   ${index + 1}. ID: ${match.id} | Discord ID: ${match.discord_id} | Active: ${match.is_active} | Linked: ${match.linked_at} | Unlinked: ${match.unlinked_at}`);
      });
    }
    console.log('');

    // 5. Check for case-insensitive matches
    console.log('📋 5. Checking for case-insensitive matches');
    console.log('-----------------------------------------');
    
    const [caseMatches] = await pool.query(`
      SELECT 
        p.ign,
        p.discord_id,
        p.server_id,
        p.is_active,
        rs.nickname as server_name
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign LIKE ? OR p.ign LIKE ? OR p.ign LIKE ?
      ORDER BY p.linked_at DESC
    `, [`%${targetIGN}%`, `%${targetIGN.toLowerCase()}%`, `%${targetIGN.toUpperCase()}%`]);

    if (caseMatches.length === 0) {
      console.log('✅ No case-insensitive matches found');
    } else {
      console.log(`⚠️  Found ${caseMatches.length} case-insensitive matches:`);
      caseMatches.forEach((match, index) => {
        console.log(`   ${index + 1}. IGN: "${match.ign}" | Discord ID: ${match.discord_id} | Server: ${match.server_name || 'Unknown'} | Active: ${match.is_active}`);
      });
    }
    console.log('');

    // 6. Check recent linking activity
    console.log('📋 6. Checking recent linking activity (last 24 hours)');
    console.log('----------------------------------------------------');
    
    const [recentActivity] = await pool.query(`
      SELECT 
        p.ign,
        p.discord_id,
        p.linked_at,
        rs.nickname as server_name
      FROM players p
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.linked_at >= NOW() - INTERVAL 24 HOUR
      ORDER BY p.linked_at DESC
      LIMIT 10
    `);

    if (recentActivity.length === 0) {
      console.log('✅ No recent linking activity in the last 24 hours');
    } else {
      console.log(`📊 Recent linking activity (last 24 hours):`);
      recentActivity.forEach((activity, index) => {
        console.log(`   ${index + 1}. IGN: ${activity.ign} | Discord ID: ${activity.discord_id} | Server: ${activity.server_name || 'Unknown'} | Time: ${activity.linked_at}`);
      });
    }
    console.log('');

    // 7. Test the exact query the bot uses
    console.log('📋 7. Testing the exact bot query');
    console.log('--------------------------------');
    
    try {
      // This is the exact query from the bot code
      const [botQueryResult] = await pool.query(`
        SELECT p.*, rs.nickname 
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
        AND LOWER(p.ign) = LOWER(?) 
        AND p.is_active = true
      `, [server.guild_discord_id, targetIGN]);

      console.log(`🔍 Bot query result: ${botQueryResult.length} records found`);
      if (botQueryResult.length > 0) {
        botQueryResult.forEach((result, index) => {
          console.log(`   ${index + 1}. ID: ${result.id} | Discord ID: ${result.discord_id} | Server: ${result.nickname} | Active: ${result.is_active}`);
        });
      } else {
        console.log('✅ Bot query found no conflicts - this should allow linking');
      }
    } catch (error) {
      console.log('❌ Error running bot query:', error.message);
    }
    console.log('');

    // 8. Summary and recommendations
    console.log('📋 8. Summary and Recommendations');
    console.log('==================================');
    
    if (ignMatches.length === 0) {
      console.log('✅ CONCLUSION: No database conflicts found');
      console.log('   The IGN is not linked to anyone in the database');
      console.log('   This suggests a BOT LOGIC BUG, not a database issue');
      console.log('');
      console.log('🔧 RECOMMENDATIONS:');
      console.log('   1. Check the bot\'s linking logic for false positives');
      console.log('   2. Look for caching issues in the bot');
      console.log('   3. Check if the bot is using the wrong guild_id');
      console.log('   4. Verify the bot is querying the correct database');
    } else {
      console.log('⚠️  CONCLUSION: Database conflicts found');
      console.log(`   Found ${ignMatches.length} existing links for IGN: ${targetIGN}`);
      console.log('');
      console.log('🔧 RECOMMENDATIONS:');
      console.log('   1. Review each conflicting link for legitimacy');
      console.log('   2. Remove invalid/expired links');
      console.log('   3. Contact players to verify ownership');
      console.log('   4. Consider implementing IGN change tracking');
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
checkPlayersTable().then(() => {
  console.log('\n🎯 Investigation completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Investigation failed:', error);
  process.exit(1);
});