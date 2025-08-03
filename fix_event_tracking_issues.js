const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing event tracking issues...\n');

// Read the current RCON file
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
let rconContent = '';

try {
  rconContent = fs.readFileSync(rconPath, 'utf8');
  console.log('✅ Found src/rcon/index.js');
} catch (error) {
  console.log('❌ Could not read src/rcon/index.js:', error.message);
  process.exit(1);
}

// Find and fix the event tracking trigger
const eventTriggerPattern = /\/\/ Handle event tracking[\s\S]*?if \(msg\.includes\('d11_quick_chat_orders_slot_7'\)\) \{[\s\S]*?\}/;
const newEventTrigger = `      // Handle event tracking
      if (msg.includes('d11_quick_chat_orders_slot_7')) {
        console.log('[EVENT TRACKING] Triggered by player:', parsed.Username);
        await handleEventTracking(client, guildId, serverName, ip, port, password, parsed.Username);
        return;
      }`;

// Find and fix the handleEventTracking function
const handleEventTrackingPattern = /const handleEventTracking = async \(client, guildId, serverName, ip, port, password, player\) => \{[\s\S]*?\};/;
const newHandleEventTracking = `const handleEventTracking = async (client, guildId, serverName, ip, port, password, player) => {
  try {
    console.log('[EVENT TRACKING] Player requested event times:', player);
    
    // Execute events.remainingtime command
    const response = await sendRconCommand(ip, port, password, 'events.remainingtime');
    
    if (response && response.Message) {
      console.log('[EVENT TRACKING] Raw response:', response.Message);
      const events = parseEventTimes(response.Message);
      
      if (events.length > 0) {
        const eventMessage = \`Next Events:<br>\${events.join('<br>')}\`;
        sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>requested event times</color>\`);
        sendRconCommand(ip, port, password, \`global.say <color=#00FF00>\${eventMessage}</color>\`);
      } else {
        sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>no events found</color>\`);
      }
    } else {
      sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>failed to get event times</color>\`);
    }
  } catch (error) {
    console.log('[EVENT TRACKING ERROR]:', error.message);
    sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>error getting event times</color>\`);
  }
};`;

// Find and fix the parseEventTimes function
const parseEventTimesPattern = /const parseEventTimes = \(response\) => \{[\s\S]*?\};/;
const newParseEventTimes = `const parseEventTimes = (response) => {
  const events = [];
  const lines = response.split('\\n');
  
  console.log('[EVENT TRACKING] Parsing response lines:', lines.length);
  
  for (const line of lines) {
    console.log('[EVENT TRACKING] Processing line:', line);
    if (line.includes('remaining hours')) {
      const match = line.match(/(\\w+):\\s*([\\d.]+)\\s*remaining hours/);
      if (match) {
        const eventName = match[1].replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
        const hours = parseFloat(match[2]);
        const readableTime = convertToReadableTime(hours);
        events.push(\`\${eventName}: \${readableTime}\`);
        console.log('[EVENT TRACKING] Parsed event:', eventName, '=', readableTime);
      }
    }
  }
  
  console.log('[EVENT TRACKING] Total events parsed:', events.length);
  return events;
};`;

// Apply the fixes
let updatedContent = rconContent;

// Fix the event trigger
if (eventTriggerPattern.test(updatedContent)) {
  updatedContent = updatedContent.replace(eventTriggerPattern, newEventTrigger);
  console.log('✅ Fixed event trigger');
} else {
  console.log('❌ Could not find event trigger pattern');
}

// Fix the handleEventTracking function
if (handleEventTrackingPattern.test(updatedContent)) {
  updatedContent = updatedContent.replace(handleEventTrackingPattern, newHandleEventTracking);
  console.log('✅ Fixed handleEventTracking function');
} else {
  console.log('❌ Could not find handleEventTracking pattern');
}

// Fix the parseEventTimes function
if (parseEventTimesPattern.test(updatedContent)) {
  updatedContent = updatedContent.replace(parseEventTimesPattern, newParseEventTimes);
  console.log('✅ Fixed parseEventTimes function');
} else {
  console.log('❌ Could not find parseEventTimes pattern');
}

// Backup the original file
const backupPath = rconPath + '.backup14';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the updated content
fs.writeFileSync(rconPath, updatedContent);
console.log('✅ Fixed event tracking issues in src/rcon/index.js');

console.log('\n✅ Event tracking issues fixed!');
console.log('📋 Fixes applied:');
console.log('1. Fixed undefined player name issue');
console.log('2. Added debug logging for response parsing');
console.log('3. Improved error handling and debugging');
console.log('\n📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test the command in-game: d11_quick_chat_orders_slot_7');
console.log('3. Check bot logs for detailed debugging info'); 