const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugEliteKitAuth() {
  console.log('🔧 DEBUG ELITE KIT AUTHORIZATION');
  console.log('=================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Check kit_auth table structure...');
    try {
      const [kitAuthStructure] = await connection.execute('DESCRIBE kit_auth');
      console.log('kit_auth table structure:');
      kitAuthStructure.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } catch (e) {
      console.log('❌ kit_auth table does not exist');
    }

    console.log('\n📋 Step 2: Check sample kit_auth data...');
    try {
      const [kitAuthData] = await connection.execute('SELECT * FROM kit_auth LIMIT 10');
      console.log(`Found ${kitAuthData.length} kit authorization records:`);
      kitAuthData.forEach((auth, index) => {
        console.log(`   ${index + 1}. Server: ${auth.server_id}, Discord: ${auth.discord_id}, Kitlist: ${auth.kitlist}`);
      });
    } catch (e) {
      console.log('❌ Cannot query kit_auth table:', e.message);
    }

    console.log('\n📋 Step 3: Check players table with Discord IDs...');
    try {
      const [playersData] = await connection.execute(`
        SELECT id, server_id, discord_id, ign, is_active 
        FROM players 
        WHERE discord_id IS NOT NULL AND discord_id > 0 
        LIMIT 10
      `);
      console.log(`Found ${playersData.length} properly linked players:`);
      playersData.forEach((player, index) => {
        console.log(`   ${index + 1}. Server: ${player.server_id}, Discord: ${player.discord_id}, IGN: ${player.ign}, Active: ${player.is_active}`);
      });
    } catch (e) {
      console.log('❌ Cannot query players table:', e.message);
    }

    console.log('\n📋 Step 4: Test the current authorization query...');
    
    // Get a sample player and server for testing
    const [samplePlayer] = await connection.execute(`
      SELECT p.*, rs.nickname as server_name 
      FROM players p 
      JOIN rust_servers rs ON p.server_id = rs.id 
      WHERE p.discord_id IS NOT NULL AND p.discord_id > 0 
      LIMIT 1
    `);

    if (samplePlayer.length > 0) {
      const player = samplePlayer[0];
      console.log(`Testing with player: ${player.ign} (Discord: ${player.discord_id}) on server: ${player.server_name}`);
      
      // Test the current query that's failing
      const [currentAuthTest] = await connection.execute(`
        SELECT ka.* FROM kit_auth ka 
        JOIN players p ON ka.discord_id = p.discord_id 
        WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?
      `, [player.server_id, player.ign, 'Elite1']);
      
      console.log(`Current query result for Elite1: ${currentAuthTest.length} records found`);
      
      // Test a simpler direct query
      const [directAuthTest] = await connection.execute(`
        SELECT * FROM kit_auth 
        WHERE server_id = ? AND discord_id = ? AND kitlist = ?
      `, [player.server_id, player.discord_id, 'Elite1']);
      
      console.log(`Direct query result for Elite1: ${directAuthTest.length} records found`);
      
      // Check what kit authorizations this player actually has
      const [playerAuth] = await connection.execute(`
        SELECT * FROM kit_auth 
        WHERE server_id = ? AND discord_id = ?
      `, [player.server_id, player.discord_id]);
      
      console.log(`Player has ${playerAuth.length} kit authorizations:`);
      playerAuth.forEach(auth => {
        console.log(`   - ${auth.kitlist}`);
      });
      
    } else {
      console.log('❌ No linked players found for testing');
    }

    console.log('\n📋 Step 5: Check elite kit configurations...');
    try {
      const [eliteKits] = await connection.execute(`
        SELECT ak.*, rs.nickname as server_name 
        FROM autokits ak 
        JOIN rust_servers rs ON ak.server_id = rs.id 
        WHERE ak.kit_name LIKE 'ELITEkit%' 
        ORDER BY rs.nickname, ak.kit_name
      `);
      
      console.log(`Found ${eliteKits.length} elite kit configurations:`);
      eliteKits.forEach(kit => {
        console.log(`   - ${kit.server_name}: ${kit.kit_name} (${kit.game_name}) - Enabled: ${kit.enabled}`);
      });
    } catch (e) {
      console.log('❌ Cannot query autokits table:', e.message);
    }

    console.log('\n📋 Step 6: Check new elite kits specifically...');
    try {
      const [newEliteKits] = await connection.execute(`
        SELECT ak.*, rs.nickname as server_name 
        FROM autokits ak 
        JOIN rust_servers rs ON ak.server_id = rs.id 
        WHERE ak.kit_name IN ('ELITEkit7', 'ELITEkit8', 'ELITEkit9', 'ELITEkit10', 'ELITEkit11', 'ELITEkit12', 'ELITEkit13')
        ORDER BY rs.nickname, ak.kit_name
      `);
      
      console.log(`Found ${newEliteKits.length} NEW elite kit configurations:`);
      newEliteKits.forEach(kit => {
        console.log(`   - ${kit.server_name}: ${kit.kit_name} (${kit.game_name}) - Enabled: ${kit.enabled}`);
      });
    } catch (e) {
      console.log('❌ Cannot query new elite kits:', e.message);
    }

    await connection.end();

    console.log('\n🎯 DIAGNOSIS COMPLETE!');
    console.log('This will help identify why elite kit authorization is failing.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

debugEliteKitAuth();