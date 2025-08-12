const pool = require('./src/db');

async function diagnoseNewServerCommands() {
  try {
    console.log('🔍 Diagnosing new server command auto-population...\n');
    
    // Check all servers and their guild associations
    console.log('📋 Step 1: Checking all servers and guild associations...');
    const [servers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_discord_id, g.name as guild_name
      FROM rust_servers rs
      LEFT JOIN guilds g ON rs.guild_id = g.id
      ORDER BY rs.created_at DESC
    `);
    
    console.log(`Found ${servers.length} servers:`);
    servers.forEach((server, index) => {
      console.log(`\n${index + 1}. ${server.nickname}`);
      console.log(`   ID: ${server.id}`);
      console.log(`   IP: ${server.ip}:${server.port}`);
      console.log(`   Guild ID: ${server.guild_id}`);
      console.log(`   Guild Discord ID: ${server.guild_discord_id || 'NULL'}`);
      console.log(`   Guild Name: ${server.guild_name || 'NULL'}`);
      console.log(`   Created: ${server.created_at}`);
    });
    
    // Check guilds table
    console.log('\n📋 Step 2: Checking guilds table...');
    const [guilds] = await pool.query('SELECT * FROM guilds ORDER BY id');
    console.log(`Found ${guilds.length} guilds:`);
    guilds.forEach((guild, index) => {
      console.log(`\n${index + 1}. Guild ID: ${guild.id}`);
      console.log(`   Discord ID: ${guild.discord_id}`);
      console.log(`   Name: ${guild.name}`);
      console.log(`   Created: ${guild.created_at}`);
    });
    
    // Check for servers without proper guild associations
    console.log('\n📋 Step 3: Checking for orphaned servers...');
    const [orphanedServers] = await pool.query(`
      SELECT rs.* FROM rust_servers rs
      LEFT JOIN guilds g ON rs.guild_id = g.id
      WHERE g.id IS NULL
    `);
    
    if (orphanedServers.length > 0) {
      console.log(`❌ Found ${orphanedServers.length} orphaned servers:`);
      orphanedServers.forEach(server => {
        console.log(`   - ${server.nickname} (Guild ID: ${server.guild_id})`);
      });
    } else {
      console.log('✅ No orphaned servers found');
    }
    
    // Test autocomplete query for each guild
    console.log('\n📋 Step 4: Testing autocomplete queries...');
    for (const guild of guilds) {
      console.log(`\nTesting guild: ${guild.name} (Discord ID: ${guild.discord_id})`);
      
      const [autocompleteServers] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
        [guild.id, '%']
      );
      
      console.log(`   Found ${autocompleteServers.length} servers for autocomplete:`);
      autocompleteServers.forEach(server => {
        console.log(`     - ${server.nickname}`);
      });
    }
    
    // Check recent server additions
    console.log('\n📋 Step 5: Checking recent server additions...');
    const [recentServers] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_discord_id, g.name as guild_name
      FROM rust_servers rs
      LEFT JOIN guilds g ON rs.guild_id = g.id
      WHERE rs.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY rs.created_at DESC
    `);
    
    if (recentServers.length > 0) {
      console.log(`Found ${recentServers.length} servers added in the last 7 days:`);
      recentServers.forEach(server => {
        console.log(`\n   ${server.nickname}`);
        console.log(`     Created: ${server.created_at}`);
        console.log(`     Guild: ${server.guild_name} (${server.guild_discord_id})`);
        console.log(`     IP: ${server.ip}:${server.port}`);
      });
    } else {
      console.log('No servers added in the last 7 days');
    }
    
    // Check for any database connection issues
    console.log('\n📋 Step 6: Testing database connection...');
    try {
      const [testResult] = await pool.query('SELECT 1 as test');
      console.log('✅ Database connection working');
    } catch (error) {
      console.log('❌ Database connection error:', error.message);
    }
    
    console.log('\n🎯 DIAGNOSIS SUMMARY:');
    console.log('1. Check if new servers have proper guild_id associations');
    console.log('2. Verify guilds table has correct discord_id mappings');
    console.log('3. Ensure autocomplete queries are working for each guild');
    console.log('4. Check for any database connection issues');
    console.log('5. Verify bot has proper permissions in Discord guilds');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await pool.end();
  }
}

diagnoseNewServerCommands(); 