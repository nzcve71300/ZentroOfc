const WebSocket = require('ws');
const pool = require('./src/db');

async function testEmoteDetection() {
  try {
    console.log('🧪 Testing Emote Detection in SSH...\n');
    console.log('📝 This will monitor ALL RCON messages to see emote formats');
    console.log('🎮 Please use the goodbye emote in-game while this is running\n');

    // Get first server
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers LIMIT 1'
    );

    if (servers.length === 0) {
      console.log('❌ No servers found');
      return;
    }

    const server = servers[0];
    console.log(`📡 Monitoring server: ${server.nickname} (${server.ip}:${server.port})`);
    console.log(`🎯 Looking for emote messages...`);

    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    ws.on('open', () => {
      console.log(`   ✅ Connected to ${server.nickname}`);
      console.log(`   📤 Monitoring all messages...`);
      console.log(`   🎮 Use the goodbye emote in-game now!`);
    });
    
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.Message) {
          const msg = parsed.Message;
          
          // Look for any message that might contain emote information
          if (msg.includes('d11_quick_chat') || 
              msg.includes('emote') || 
              msg.includes('goodbye') ||
              msg.includes('slot_6') ||
              msg.includes('ZORP') ||
              msg.includes('delete')) {
            
            console.log(`\n🎯 POTENTIAL EMOTE MESSAGE DETECTED:`);
            console.log(`   📥 Raw message: ${msg}`);
            console.log(`   📋 Parsed:`, parsed);
            
            // Check if it matches our emote constants
            const ZORP_DELETE_EMOTE = 'd11_quick_chat_responses_slot_6';
            const GOODBYE_EMOTE = 'd11_quick_chat_responses_slot_6';
            
            if (msg.includes(ZORP_DELETE_EMOTE) || msg.includes(GOODBYE_EMOTE)) {
              console.log(`   ✅ MATCHES DELETE EMOTE!`);
            } else {
              console.log(`   ❌ Does not match delete emote`);
            }
          }
          
          // Also log any message that contains player names (might be emote messages)
          if (msg.includes('[') && msg.includes(']') && msg.includes(':')) {
            console.log(`\n👤 PLAYER MESSAGE:`);
            console.log(`   📥 Message: ${msg}`);
          }
        }
      } catch (err) {
        // Ignore parsing errors
      }
    });
    
    ws.on('error', (error) => {
      console.error(`   ❌ WebSocket error:`, error.message);
    });
    
    ws.on('close', () => {
      console.log(`   🔌 Connection closed`);
    });

    // Keep running for 5 minutes
    setTimeout(() => {
      console.log('\n⏰ Test completed after 5 minutes');
      ws.close();
    }, 300000);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testEmoteDetection(); 