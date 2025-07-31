const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAutokitConfigs() {
  console.log('🔍 Autokit Configuration Check');
  console.log('==============================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('📋 Current autokit configurations:');
    const [autokits] = await connection.execute(`
      SELECT ak.*, rs.nickname as server_name 
      FROM autokits ak 
      JOIN rust_servers rs ON ak.server_id = rs.id
      ORDER BY rs.nickname, ak.kit_name
    `);
    
    for (const kit of autokits) {
      console.log(`Server: ${kit.server_name}`);
      console.log(`  Kit: ${kit.kit_name} (${kit.game_name})`);
      console.log(`  Enabled: ${kit.enabled ? '✅' : '❌'}`);
      console.log(`  Cooldown: ${kit.cooldown} minutes`);
      console.log('');
    }

    console.log('🔍 VIP/ELITE Kit Authorization:');
    const [kitAuth] = await connection.execute(`
      SELECT ka.*, rs.nickname as server_name 
      FROM kit_auth ka 
      JOIN rust_servers rs ON ka.server_id = rs.id
      ORDER BY rs.nickname, ka.kitlist
    `);
    
    for (const auth of kitAuth) {
      console.log(`Server: ${auth.server_name}`);
      console.log(`  Kit: ${auth.kitlist}`);
      console.log(`  Discord ID: ${auth.discord_id}`);
      console.log('');
    }

    await connection.end();

    console.log('💡 ISSUES FOUND:');
    console.log('1. VIPkit authorization is missing from handleKitClaim function');
    console.log('2. Cooldown system uses in-memory storage (resets on bot restart)');
    console.log('3. Need to add VIPkit check similar to ELITEkit check');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAutokitConfigs(); 