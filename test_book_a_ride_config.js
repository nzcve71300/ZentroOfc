const pool = require('./src/db');

async function testBookARideConfig() {
  try {
    console.log('🔍 Testing Book-a-Ride configuration...');
    
    // Get all servers and their rider configs
    const [servers] = await pool.query(`
      SELECT 
        rs.id, 
        rs.nickname, 
        rs.guild_id,
        rc.enabled,
        rc.cooldown,
        rc.horse_enabled,
        rc.rhib_enabled,
        rc.mini_enabled,
        rc.car_enabled,
        rc.fuel_amount
      FROM rust_servers rs 
      LEFT JOIN rider_config rc ON rs.id = rc.server_id
      ORDER BY rs.nickname
    `);
    
    console.log(`\n📋 Found ${servers.length} server(s):`);
    
    for (const server of servers) {
      console.log(`\n🏠 Server: ${server.nickname}`);
      console.log(`   ID: ${server.id}`);
      console.log(`   Guild ID: ${server.guild_id}`);
      
      if (server.enabled === null) {
        console.log(`   ❌ No rider_config found - Book-a-Ride not configured`);
        console.log(`   💡 Run: /set BAR-USE on ${server.nickname} to enable`);
      } else {
        console.log(`   ✅ Book-a-Ride enabled: ${server.enabled ? 'YES' : 'NO'}`);
        console.log(`   ⏱️  Cooldown: ${server.cooldown || 300} seconds`);
        console.log(`   🐎 Horse enabled: ${server.horse_enabled ? 'YES' : 'NO'}`);
        console.log(`   🚤 RHIB enabled: ${server.rhib_enabled ? 'YES' : 'NO'}`);
        console.log(`   🚁 Mini enabled: ${server.mini_enabled ? 'YES' : 'NO'}`);
        console.log(`   🚗 Car enabled: ${server.car_enabled ? 'YES' : 'NO'}`);
        console.log(`   ⛽ Fuel amount: ${server.fuel_amount || 100}`);
      }
    }
    
    // Check if any servers have no rider_config
    const serversWithoutConfig = servers.filter(s => s.enabled === null);
    if (serversWithoutConfig.length > 0) {
      console.log(`\n⚠️  ${serversWithoutConfig.length} server(s) need Book-a-Ride configuration:`);
      serversWithoutConfig.forEach(server => {
        console.log(`   - ${server.nickname}`);
      });
    }
    
    // Check emotes
    console.log(`\n🎮 Book-a-Ride Emotes:`);
    console.log(`   Request emote: d11_quick_chat_orders_slot_5`);
    console.log(`   Horse choice: d11_quick_chat_responses_slot_0`);
    console.log(`   RHIB choice: d11_quick_chat_responses_slot_1`);
    console.log(`   Mini choice: d11_quick_chat_responses_slot_2`);
    console.log(`   Car choice: d11_quick_chat_responses_slot_3`);
    
  } catch (error) {
    console.error('❌ Error testing Book-a-Ride config:', error);
  } finally {
    await pool.end();
  }
}

testBookARideConfig();
