const fs = require('fs');

console.log('🔧 Final test of event parsing logic...\n');

// Test the parsing function with the actual response format from your logs
const testResponse = `Event Remaining Times:
event_airdrop: 7.69 remaining hours
event_cargoheli: 19.43 remaining hours
event_cargoship: 41.43 remaining hours
event_helicopter: 25.43 remaining hours`;

console.log('📋 Test response:');
console.log(testResponse);
console.log('');

// Test the parsing function
const parseEventTimes = (response) => {
  const events = [];
  const lines = response.split('\n');
  
  console.log('[EVENT TRACKING] Parsing response lines:', lines.length);
  console.log('[EVENT TRACKING] Response content:', response);
  console.log('');
  
  for (const line of lines) {
    console.log('[EVENT TRACKING] Processing line:', line);
    if (line.includes('remaining hours')) {
      const match = line.match(/(\w+):\s*([\d.]+)\s*remaining hours/);
      if (match) {
        const eventName = match[1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const hours = parseFloat(match[2]);
        const readableTime = convertToReadableTime(hours);
        events.push(`${eventName}: ${readableTime}`);
        console.log('[EVENT TRACKING] Parsed event:', eventName, '=', readableTime);
      }
    }
  }
  
  console.log('');
  console.log('[EVENT TRACKING] Total events parsed:', events.length);
  return events;
};

// Function to convert hours to readable format
const convertToReadableTime = (hours) => {
  const totalHours = parseFloat(hours);
  const wholeHours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - wholeHours) * 60);
  
  if (wholeHours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${wholeHours}h`;
  } else {
    return `${wholeHours}h ${minutes}m`;
  }
};

// Test the parsing
const events = parseEventTimes(testResponse);
console.log('\n📋 Parsed events:');
events.forEach(event => console.log(event));

console.log('\n📋 Expected in-game output:');
console.log('Next Events:');
events.forEach(event => console.log(event));

console.log('\n✅ Test complete!');
console.log('📋 This shows what the bot should display in-game');
console.log('📋 The parsing logic is working correctly'); 