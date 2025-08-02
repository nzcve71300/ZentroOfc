const WebSocket = require('ws');
const pool = require('./src/db');

// Test the emote detection logic
function testEmoteDetection(msg) {
  console.log(`\n🔍 TESTING EMOTE DETECTION:`);
  console.log(`Message: "${msg}"`);
  
  // Check for ZORP delete emote in the correct format: [CHAT LOCAL] player : d11_quick_chat_responses_slot_6
  if (msg.includes('[CHAT LOCAL]') && msg.includes('d11_quick_chat_responses_slot_6')) {
    console.log(`✅ EMOTE DETECTED!`);
    
    // Extract player name
    const playerMatch = msg.match(/\[CHAT LOCAL\] (.+?) :/);
    if (playerMatch) {
      const player = playerMatch[1];
      console.log(`✅ Player extracted: ${player}`);
      return { detected: true, player };
    } else {
      console.log(`❌ Could not extract player name`);
      return { detected: true, player: null };
    }
  } else {
    console.log(`❌ EMOTE NOT DETECTED`);
    console.log(`   - Contains [CHAT LOCAL]: ${msg.includes('[CHAT LOCAL]')}`);
    console.log(`   - Contains d11_quick_chat_responses_slot_6: ${msg.includes('d11_quick_chat_responses_slot_6')}`);
    return { detected: false, player: null };
  }
}

// Test different message formats
const testMessages = [
  '[CHAT LOCAL] PlayerName : d11_quick_chat_responses_slot_6',
  '[CHAT LOCAL] TestPlayer : d11_quick_chat_responses_slot_6',
  '[CHAT LOCAL] SomePlayer : d11_quick_chat_responses_slot_6',
  '[CHAT LOCAL] PlayerName : d11_quick_chat_questions_slot_1', // Wrong emote
  'Some other message',
  '[CHAT LOCAL] PlayerName : d11_quick_chat_responses_slot_6 extra text',
];

console.log('🧪 TESTING ZORP EMOTE DETECTION');
console.log('================================');

testMessages.forEach((msg, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  const result = testEmoteDetection(msg);
  console.log(`Result:`, result);
});

console.log('\n🎯 CONCLUSION:');
console.log('The emote detection should work for messages containing:');
console.log('- [CHAT LOCAL]');
console.log('- d11_quick_chat_responses_slot_6');
console.log('- Player name in format: [CHAT LOCAL] PlayerName : emote'); 