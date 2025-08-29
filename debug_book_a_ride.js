
const pool = require('./src/db');

async function debugBookARide() {
  try {
    console.log('🔍 Debugging Book-a-Ride emote detection...');
    
    // Test emote constants
    const BOOKARIDE_EMOTE = 'd11_quick_chat_orders_slot_5';
    const BOOKARIDE_CHOICES = {
      horse: 'd11_quick_chat_responses_slot_0',
      rhib: 'd11_quick_chat_responses_slot_1',
      mini: 'd11_quick_chat_responses_slot_2',
      car: 'd11_quick_chat_responses_slot_3',
    };
    
    console.log('\n🎮 Emote Constants:');
    console.log(`   Request emote: "${BOOKARIDE_EMOTE}"`);
    console.log(`   Horse choice: "${BOOKARIDE_CHOICES.horse}"`);
    console.log(`   RHIB choice: "${BOOKARIDE_CHOICES.rhib}"`);
    console.log(`   Mini choice: "${BOOKARIDE_CHOICES.mini}"`);
    console.log(`   Car choice: "${BOOKARIDE_CHOICES.car}"`);
    
    // Test sample messages
    const testMessages = [
      '[CHAT LOCAL] PlayerName : d11_quick_chat_orders_slot_5',
      '[CHAT LOCAL] PlayerName : d11_quick_chat_responses_slot_0',
      '[CHAT LOCAL] PlayerName : d11_quick_chat_responses_slot_1',
      '[CHAT LOCAL] PlayerName : d11_quick_chat_responses_slot_2',
      '[CHAT LOCAL] PlayerName : d11_quick_chat_responses_slot_3'
    ];
    
    console.log('\n🧪 Testing emote detection:');
    testMessages.forEach((msg, index) => {
      const hasRequestEmote = msg.includes(BOOKARIDE_EMOTE);
      const hasHorseChoice = msg.includes(BOOKARIDE_CHOICES.horse);
      const hasRhibChoice = msg.includes(BOOKARIDE_CHOICES.rhib);
      const hasMiniChoice = msg.includes(BOOKARIDE_CHOICES.mini);
      const hasCarChoice = msg.includes(BOOKARIDE_CHOICES.car);
      
      console.log(`   Message ${index + 1}: "${msg}"`);
      console.log(`     Request emote: ${hasRequestEmote ? '✅' : '❌'}`);
      console.log(`     Horse choice: ${hasHorseChoice ? '✅' : '❌'}`);
      console.log(`     RHIB choice: ${hasRhibChoice ? '✅' : '❌'}`);
      console.log(`     Mini choice: ${hasMiniChoice ? '✅' : '❌'}`);
      console.log(`     Car choice: ${hasCarChoice ? '✅' : '❌'}`);
    });
    
    // Test player name extraction
    console.log('\n👤 Testing player name extraction:');
    const extractPlayerName = (msg) => {
      const match = msg.match(/\[CHAT \w+\] ([^:]+) :/);
      return match ? match[1].trim() : null;
    };
    
    testMessages.forEach((msg, index) => {
      const playerName = extractPlayerName(msg);
      console.log(`   Message ${index + 1}: Player = "${playerName}"`);
    });
    
    // Check database connection
    console.log('\n🗄️ Testing database connection...');
    const [result] = await pool.query('SELECT 1 as test');
    console.log(`   Database connection: ${result[0].test === 1 ? '✅' : '❌'}`);
    
    // Get a sample server config
    const [servers] = await pool.query(`
      SELECT rs.nickname, rc.enabled, rc.horse_enabled, rc.rhib_enabled
      FROM rust_servers rs 
      LEFT JOIN rider_config rc ON rs.id = rc.server_id
      WHERE rc.enabled = 1
      LIMIT 1
    `);
    
    if (servers.length > 0) {
      const server = servers[0];
      console.log(`\n📋 Sample server config (${server.nickname}):`);
      console.log(`   Enabled: ${server.enabled ? 'YES' : 'NO'}`);
      console.log(`   Horse enabled: ${server.horse_enabled ? 'YES' : 'NO'}`);
      console.log(`   RHIB enabled: ${server.rhib_enabled ? 'YES' : 'NO'}`);
    }
    
  } catch (error) {
    console.error('❌ Error debugging Book-a-Ride:', error);
  } finally {
    await pool.end();
  }
}

debugBookARide();
