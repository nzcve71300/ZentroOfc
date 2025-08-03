const fs = require('fs');
const path = require('path');

console.log('🔧 Final syntax fix - restoring from clean backup...\n');

// Restore from the cleanest backup
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
const backupPath = rconPath + '.backup18';

if (fs.existsSync(backupPath)) {
  console.log('✅ Found clean backup, restoring...');
  fs.copyFileSync(backupPath, rconPath);
  console.log('✅ Restored from clean backup');
} else {
  console.log('❌ No clean backup found, using backup19');
  const backupPath2 = rconPath + '.backup19';
  if (fs.existsSync(backupPath2)) {
    fs.copyFileSync(backupPath2, rconPath);
    console.log('✅ Restored from backup19');
  } else {
    console.log('❌ No backups found, cannot proceed');
    process.exit(1);
  }
}

// Read the restored file
let rconContent = '';
try {
  rconContent = fs.readFileSync(rconPath, 'utf8');
  console.log('✅ Read restored RCON file');
} catch (error) {
  console.log('❌ Could not read RCON file:', error.message);
  process.exit(1);
}

// Add minimal event tracking code at the end before module.exports
const minimalEventTrackingCode = `
// Event tracking functionality
const eventTrackingCooldowns = new Map();
const EVENT_TRACKING_COOLDOWN = 8000;

const handleEventTracking = async (client, guildId, serverName, ip, port, password, player) => {
  try {
    console.log('[EVENT TRACKING] Player requested event times:', player);
    
    const serverKey = \`\${ip}:\${port}\`;
    const lastRequest = eventTrackingCooldowns.get(serverKey);
    const now = Date.now();
    
    if (lastRequest && (now - lastRequest) < EVENT_TRACKING_COOLDOWN) {
      console.log('[EVENT TRACKING] Cooldown active, skipping request');
      return;
    }
    
    eventTrackingCooldowns.set(serverKey, now);
    
    const response = await sendRconCommand(ip, port, password, 'events.remainingtime');
    
    if (response && response.Message) {
      console.log('[EVENT TRACKING] Raw response:', response.Message);
      const events = parseEventTimes(response.Message);
      
      if (events.length > 0) {
        const eventMessage = \`Next Events:<br>\${events.join('<br>')}\`;
        sendRconCommand(ip, port, password, \`global.say <color=#FF69B4>\${player}</color> <color=white>requested event times</color>\`);
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

// Add the minimal event tracking code before module.exports
const moduleExportsPattern = /module\.exports = {/;
if (moduleExportsPattern.test(rconContent)) {
  rconContent = rconContent.replace(
    moduleExportsPattern,
    `${minimalEventTrackingCode}\n\nmodule.exports = {`
  );
  
  // Add the event tracking trigger in the message handling section
  const minimalEventTrigger = `
      // Handle event tracking
      if (msg.includes('d11_quick_chat_orders_slot_7')) {
        let playerName = 'Unknown';
        
        try {
          if (parsed && parsed.Username) {
            playerName = parsed.Username;
            console.log('[EVENT TRACKING] Found player name in parsed JSON:', playerName);
          } else {
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
  if (messageHandlingPattern.test(rconContent)) {
    rconContent = rconContent.replace(
      /(\/\/ Handle kit emote detection)/,
      `${minimalEventTrigger}\n      $1`
    );
  }
}

// Create new backup
const newBackupPath = rconPath + '.backup23';
fs.copyFileSync(rconPath, newBackupPath);
console.log('✅ Created new backup:', newBackupPath);

// Write the cleaned content
fs.writeFileSync(rconPath, rconContent);
console.log('✅ Added minimal event tracking to src/rcon/index.js');

console.log('\n✅ Final syntax fix complete!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test the event tracking in-game: d11_quick_chat_orders_slot_7');
console.log('3. Check bot logs for any remaining issues'); 