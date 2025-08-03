const fs = require('fs');
const path = require('path');

console.log('🔧 Final fix for event tracking issues...\n');

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

// Find the exact location where the event tracking trigger is added
const eventTriggerLocation = rconContent.indexOf('// Handle event tracking');
if (eventTriggerLocation === -1) {
  console.log('❌ Could not find event tracking trigger location');
  process.exit(1);
}

// Find the line that contains the player name issue
const playerNameIssue = rconContent.indexOf('parsed.Username');
if (playerNameIssue === -1) {
  console.log('❌ Could not find player name issue location');
  process.exit(1);
}

// Let me check the actual structure around the message handling
const messageHandlingSection = rconContent.indexOf('// Handle kit emote detection');
if (messageHandlingSection === -1) {
  console.log('❌ Could not find message handling section');
  process.exit(1);
}

// Find the exact context where the event tracking is triggered
const eventTrackingContext = rconContent.substring(messageHandlingSection - 200, messageHandlingSection + 200);
console.log('📋 Found message handling context:', eventTrackingContext);

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

// Find the module.exports section and add the event tracking code before it
const moduleExportsPattern = /module\.exports = {/;
if (moduleExportsPattern.test(rconContent)) {
  const updatedContent = rconContent.replace(
    moduleExportsPattern,
    `${newEventTrackingCode}\n\nmodule.exports = {`
  );
  
  // Now add the event tracking trigger in the message handling section
  const newEventTrigger = `
      // Handle event tracking
      if (msg.includes('d11_quick_chat_orders_slot_7')) {
        const playerName = parsed.Username || 'Unknown';
        console.log('[EVENT TRACKING] Triggered by player:', playerName);
        await handleEventTracking(client, guildId, serverName, ip, port, password, playerName);
        return;
      }
`;

  // Find the message handling section and add the event trigger
  const messageHandlingPattern = /\/\/ Handle kit emote detection/;
  if (messageHandlingPattern.test(updatedContent)) {
    const finalContent = updatedContent.replace(
      /(\/\/ Handle kit emote detection)/,
      `${newEventTrigger}\n      $1`
    );
    
    // Backup the original file
    const backupPath = rconPath + '.backup15';
    fs.copyFileSync(rconPath, backupPath);
    console.log('✅ Created backup:', backupPath);
    
    // Write the updated content
    fs.writeFileSync(rconPath, finalContent);
    console.log('✅ Fixed event tracking issues in src/rcon/index.js');
    
  } else {
    console.log('❌ Could not find message handling section');
    process.exit(1);
  }
  
} else {
  console.log('❌ Could not find module.exports section');
  process.exit(1);
}

console.log('\n✅ Event tracking issues fixed!');
console.log('📋 Fixes applied:');
console.log('1. Fixed undefined player name with fallback');
console.log('2. Added comprehensive debug logging');
console.log('3. Improved error handling and parsing');
console.log('\n📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test the command in-game: d11_quick_chat_orders_slot_7');
console.log('3. Check bot logs for detailed debugging info'); 