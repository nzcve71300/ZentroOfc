const pool = require('./src/db');

async function addSaveMessageHandling() {
  try {
    console.log('🔧 Adding Save Message Handling...');
    
    // This will be added to the RCON message handling in src/rcon/index.js
    console.log('\n📝 Add this code to src/rcon/index.js in the message handling section:');
    console.log('');
    console.log('// Handle save messages');
    console.log('if (msg.includes("[ SAVE ]")) {');
    console.log('  const saveMatch = msg.match(/\\[ SAVE \\] (.+)/);');
    console.log('  if (saveMatch) {');
    console.log('    const saveMessage = saveMatch[1];');
    console.log('    // Send colored message to game');
    console.log('    await sendRconCommand(ip, port, password, `say <color=#00FF00>Saving</color> <color=white>${saveMessage}</color>`);');
    console.log('  }');
    console.log('}');
    console.log('');
    
    console.log('📍 Location: Add this code in the main message processing loop');
    console.log('   around line 200-300 where other message types are handled');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

addSaveMessageHandling(); 