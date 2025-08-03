const fs = require('fs');
const path = require('path');

console.log('🔧 Complete fix for event tracking...\n');

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

// Create a completely new event tracking implementation
const newEventTrackingCode = `
// Event tracking functionality
const handleEventTracking = async (client, guildId, serverName, ip, port, password, player) => {
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
};

// Function to convert hours to readable format
const convertToReadableTime = (hours) => {
  const totalHours = parseFloat(hours);
  const wholeHours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - wholeHours) * 60);
  
  if (wholeHours === 0) {
    return \`\${minutes}m\`;
  } else if (minutes === 0) {
    return \`\${wholeHours}h\`;
  } else {
    return \`\${wholeHours}h \${minutes}m\`;
  }
};

// Function to parse events.remainingtime response
const parseEventTimes = (response) => {
  const events = [];
  const lines = response.split('\\n');
  
  console.log('[EVENT TRACKING] Parsing response lines:', lines.length);
  console.log('[EVENT TRACKING] Response content:', response);
  
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
};
`;

// Remove all existing event tracking functions
let cleanedContent = rconContent;

// Remove all handleEventTracking function declarations
const handleEventTrackingPattern = /const handleEventTracking = async \(client, guildId, serverName, ip, port, password, player\) => \{[\s\S]*?\};/g;
cleanedContent = cleanedContent.replace(handleEventTrackingPattern, '');

// Remove all convertToReadableTime function declarations
const convertToReadableTimePattern = /const convertToReadableTime = \(hours\) => \{[\s\S]*?\};/g;
cleanedContent = cleanedContent.replace(convertToReadableTimePattern, '');

// Remove all parseEventTimes function declarations
const parseEventTimesPattern = /const parseEventTimes = \(response\) => \{[\s\S]*?\};/g;
cleanedContent = cleanedContent.replace(parseEventTimesPattern, '');

// Remove all event tracking trigger code
const eventTriggerPattern = /\/\/ Handle event tracking[\s\S]*?if \(msg\.includes\('d11_quick_chat_orders_slot_7'\)\) \{[\s\S]*?\}/g;
cleanedContent = cleanedContent.replace(eventTriggerPattern, '');

// Add the clean event tracking code before module.exports
const moduleExportsPattern = /module\.exports = {/;
if (moduleExportsPattern.test(cleanedContent)) {
  cleanedContent = cleanedContent.replace(
    moduleExportsPattern,
    `${newEventTrackingCode}\n\nmodule.exports = {`
  );
  
  // Add the event tracking trigger in the message handling section
  const newEventTrigger = `
      // Handle event tracking
      if (msg.includes('d11_quick_chat_orders_slot_7')) {
        // Extract player name from the message
        const playerMatch = msg.match(/\[CHAT LOCAL\] (\\w+) : d11_quick_chat_orders_slot_7/);
        const playerName = playerMatch ? playerMatch[1] : (parsed.Username || 'Unknown');
        console.log('[EVENT TRACKING] Triggered by player:', playerName);
        await handleEventTracking(client, guildId, serverName, ip, port, password, playerName);
        return;
      }
`;

  // Find the message handling section and add the event trigger
  const messageHandlingPattern = /\/\/ Handle kit emote detection/;
  if (messageHandlingPattern.test(cleanedContent)) {
    cleanedContent = cleanedContent.replace(
      /(\/\/ Handle kit emote detection)/,
      `${newEventTrigger}\n      $1`
    );
  }
}

// Backup the original file
const backupPath = rconPath + '.backup18';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the cleaned content
fs.writeFileSync(rconPath, cleanedContent);
console.log('✅ Fixed event tracking issues in src/rcon/index.js');

console.log('\n✅ Event tracking complete fix applied!');
console.log('📋 Fixes applied:');
console.log('1. Fixed player name extraction from chat message');
console.log('2. Enhanced response parsing with better debugging');
console.log('3. Improved error handling and logging');
console.log('4. Removed all duplicate functions');
console.log('\n📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test the command in-game: d11_quick_chat_orders_slot_7');
console.log('3. Check bot logs for detailed debugging info'); 