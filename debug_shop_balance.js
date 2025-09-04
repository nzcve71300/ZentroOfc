const pool = require('./src/db');

async function debugShopBalance() {
  try {
    console.log('🔍 Debugging shop balance issue...');
    
    const userId = '1252993829007528086'; // The user from the logs
    const serverId = '1756598716651_wmh0kflng'; // The server from the logs
    
    console.log(`\n📋 User ID: ${userId}`);
    console.log(`📋 Server ID: ${serverId}`);
    
    // Check if the server exists
    console.log('\n🔍 Checking server...');
    const [serverResult] = await pool.query(
      'SELECT id, nickname, currency_name FROM rust_servers WHERE id = ?',
      [serverId]
    );
    
    if (serverResult.length === 0) {
      console.log('❌ Server not found!');
      return;
    }
    
    const server = serverResult[0];
    console.log(`✅ Server found: ${server.nickname}`);
    console.log(`✅ Currency name: ${server.currency_name}`);
    
    // Check if the user exists on this server
    console.log('\n🔍 Checking if user exists on this server...');
    const [playerResult] = await pool.query(
      'SELECT id, discord_id, server_id, ign FROM players WHERE discord_id = ? AND server_id = ?',
      [userId, serverId]
    );
    
    if (playerResult.length === 0) {
      console.log('❌ User not found on this server!');
      
      // Check if user exists on ANY server
      console.log('\n🔍 Checking if user exists on any server...');
      const [anyPlayerResult] = await pool.query(
        'SELECT id, discord_id, server_id, ign FROM players WHERE discord_id = ?',
        [userId]
      );
      
      if (anyPlayerResult.length === 0) {
        console.log('❌ User not found on any server!');
      } else {
        console.log(`✅ User found on ${anyPlayerResult.length} server(s):`);
        anyPlayerResult.forEach(player => {
          console.log(`   - Server ID: ${player.server_id}, IGN: ${player.ign}`);
        });
      }
      return;
    }
    
    const player = playerResult[0];
    console.log(`✅ User found on server: ${player.ign}`);
    
    // Check the user's economy record
    console.log('\n🔍 Checking economy record...');
    const [economyResult] = await pool.query(
      'SELECT id, player_id, balance FROM economy WHERE player_id = ?',
      [player.id]
    );
    
    if (economyResult.length === 0) {
      console.log('❌ No economy record found for user!');
      return;
    }
    
    const economy = economyResult[0];
    console.log(`✅ Economy record found: ID ${economy.id}`);
    console.log(`✅ Balance: ${economy.balance}`);
    
    // Check if there are any other economy records for this player
    console.log('\n🔍 Checking for other economy records...');
    const [allEconomyResult] = await pool.query(
      'SELECT id, player_id, balance FROM economy WHERE player_id = ?',
      [player.id]
    );
    
    if (allEconomyResult.length > 1) {
      console.log(`⚠️ Found ${allEconomyResult.length} economy records for this player:`);
      allEconomyResult.forEach(econ => {
        console.log(`   - Economy ID: ${econ.id}, Balance: ${econ.balance}`);
      });
    }
    
    // Check the exact query the shop is using
    console.log('\n🔍 Testing the exact shop query...');
    const [shopBalanceResult] = await pool.query(
      `SELECT e.balance, p.id as player_id, p.discord_id, p.server_id
       FROM players p
       JOIN economy e ON p.id = e.player_id
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.discord_id = ? AND rs.id = ?
       LIMIT 1`,
      [userId, serverId]
    );
    
    console.log(`✅ Shop query result: ${shopBalanceResult.length} rows`);
    if (shopBalanceResult.length > 0) {
      const shopBalance = shopBalanceResult[0];
      console.log(`   - Player ID: ${shopBalance.player_id}`);
      console.log(`   - Discord ID: ${shopBalance.discord_id}`);
      console.log(`   - Server ID: ${shopBalance.server_id}`);
      console.log(`   - Balance: ${shopBalance.balance}`);
    }
    
    console.log('\n✅ Debug complete!');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await pool.end();
  }
}

debugShopBalance();
