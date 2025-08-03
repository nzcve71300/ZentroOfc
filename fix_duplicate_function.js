const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing duplicate function declaration...\n');

// Read the current RCON file
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
let rconContent = '';

try {
  rconContent = fs.readFileSync(rconPath, 'utf8');
  console.log('✅ Read RCON file');
} catch (error) {
  console.log('❌ Could not read RCON file:', error.message);
  process.exit(1);
}

// Find and remove duplicate function declarations
let updatedContent = rconContent;

// Remove all existing event tracking code
const eventTrackingPatterns = [
  /\/\/ Event tracking functionality with cooldown[\s\S]*?const parseEventTimes = \(response\) => \{[\s\S]*?\};/g,
  /const eventTrackingCooldowns = new Map\(\);/g,
  /const EVENT_TRACKING_COOLDOWN = \d+;/g,
  /const handleEventTracking = async \(client, guildId, serverName, ip, port, password, player\) => \{[\s\S]*?\};/g,
  /const convertToReadableTime = \(hours\) => \{[\s\S]*?\};/g,
  /const parseEventTimes = \(response\) => \{[\s\S]*?\};/g
];

eventTrackingPatterns.forEach(pattern => {
  updatedContent = updatedContent.replace(pattern, '');
});

// Remove duplicate event tracking triggers
const eventTriggerPatterns = [
  /\/\/ Handle event tracking[\s\S]*?if \(msg\.includes\('d11_quick_chat_orders_slot_7'\)\) \{[\s\S]*?\}/g
];

eventTriggerPatterns.forEach(pattern => {
  updatedContent = updatedContent.replace(pattern, '');
});

// Clean up extra whitespace and empty lines
updatedContent = updatedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

// Add clean event tracking code
const cleanEventTrackingCode = `
// Event tracking functionality with cooldown
const eventTrackingCooldowns = new Map(); // Track cooldowns per server
const EVENT_TRACKING_COOLDOWN = 8000; // 8 seconds cooldown

const handleEventTracking = async (client, guildId, serverName, ip, port, password, player) => {
  try {
    console.log('[EVENT TRACKING] Player requested event times:', player);
    
    // Check cooldown
    const serverKey = \`\${ip}:\${port}\`;
    const lastRequest = eventTrackingCooldowns.get(serverKey);
    const now = Date.now();
    
    if (lastRequest && (now - lastRequest) < EVENT_TRACKING_COOLDOWN) {
      console.log('[EVENT TRACKING] Cooldown active, skipping request');
      return;
    }
    
    // Update cooldown
    eventTrackingCooldowns.set(serverKey, now);
    
    // Execute events.remainingtime command
    const response = await sendRconCommand(ip, port, password, 'events.remainingtime');
    
    if (response && response.Message) {
      console.log('[EVENT TRACKING] Raw response:', response.Message);
      const events = parseEventTimes(response.Message);
      
      if (events.length > 0) {
        const eventMessage = \`Next Events:<br>\${events.join('<br>')}\`;
        
        // Send messages with delay to prevent spam
        sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>requested event times</color>\`);
        
        // Wait 1 second before sending the event list
        setTimeout(() => {
          sendRconCommand(ip, port, password, \`global.say <color=#00FF00>\${eventMessage}</color>\`);
        }, 1000);
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

// Add the clean event tracking code before module.exports
const moduleExportsPattern = /module\.exports = {/;
if (moduleExportsPattern.test(updatedContent)) {
  updatedContent = updatedContent.replace(
    moduleExportsPattern,
    `${cleanEventTrackingCode}\n\nmodule.exports = {`
  );
  
  // Add the event tracking trigger in the message handling section
  const cleanEventTrigger = `
      // Handle event tracking
      if (msg.includes('d11_quick_chat_orders_slot_7')) {
        // Extract player name from the JSON response
        let playerName = 'Unknown';
        
        try {
          // First try to get from the parsed JSON response
          if (parsed && parsed.Username) {
            playerName = parsed.Username;
            console.log('[EVENT TRACKING] Found player name in parsed JSON:', playerName);
          } else {
            // Fallback to regex extraction from raw message
            const playerMatch = msg.match(/\[CHAT LOCAL\] (\\w+) : d11_quick_chat_orders_slot_7/);
            if (playerMatch) {
              playerName = playerMatch[1];
              console.log('[EVENT TRACKING] Found player name via regex:', playerName);
            } else {
              console.log('[EVENT TRACKING] Could not extract player name from:', msg);
            }
          }
        } catch (error) {
          console.log('[EVENT TRACKING] Error extracting player name:', error.message);
        }
        
        console.log('[EVENT TRACKING] Triggered by player:', playerName);
        await handleEventTracking(client, guildId, serverName, ip, port, password, playerName);
        return;
      }
`;

  // Find the message handling section and add the event trigger
  const messageHandlingPattern = /\/\/ Handle kit emote detection/;
  if (messageHandlingPattern.test(updatedContent)) {
    updatedContent = updatedContent.replace(
      /(\/\/ Handle kit emote detection)/,
      `${cleanEventTrigger}\n      $1`
    );
  }
}

// Create new backup
const newBackupPath = rconPath + '.backup22';
fs.copyFileSync(rconPath, newBackupPath);
console.log('✅ Created new backup:', newBackupPath);

// Write the cleaned content
fs.writeFileSync(rconPath, updatedContent);
console.log('✅ Fixed duplicate function declaration in src/rcon/index.js');

console.log('\n✅ Duplicate function fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test the event tracking in-game: d11_quick_chat_orders_slot_7');
console.log('3. Check bot logs for any remaining issues'); 