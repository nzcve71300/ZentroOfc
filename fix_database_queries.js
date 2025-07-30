const fs = require('fs');
const path = require('path');

// Read the RCON file
const rconFile = path.join(__dirname, 'src', 'rcon', 'index.js');
let content = fs.readFileSync(rconFile, 'utf8');

console.log('🔧 Fixing database queries for MariaDB compatibility...');

// Replace all pool.query() calls with pool.execute()
const originalQueries = [
  'pool.query(',
  'await pool.query(',
  'const [result] = await pool.query(',
  'const [guildResult] = await pool.query(',
  'const [serverResult] = await pool.query(',
  'const [existingPlayer] = await pool.query(',
  'const [newPlayer] = await pool.query(',
  'await pool.query(',
  'const [playerResult] = await pool.query(',
  'const configResult = await pool.query(',
  'const coordResult = await pool.query(',
  'const serverResult = await pool.query(',
  'const existingZone = await pool.query(',
  'const defaultsResult = await pool.query(',
  'const existingZones = await pool.query(',
  'const zoneResult = await pool.query('
];

const fixedQueries = [
  'pool.execute(',
  'await pool.execute(',
  'const [result] = await pool.execute(',
  'const [guildResult] = await pool.execute(',
  'const [serverResult] = await pool.execute(',
  'const [existingPlayer] = await pool.execute(',
  'const [newPlayer] = await pool.execute(',
  'await pool.execute(',
  'const [playerResult] = await pool.execute(',
  'const [configResult] = await pool.execute(',
  'const [coordResult] = await pool.execute(',
  'const [serverResult] = await pool.execute(',
  'const [existingZone] = await pool.execute(',
  'const [defaultsResult] = await pool.execute(',
  'const [existingZones] = await pool.execute(',
  'const [zoneResult] = await pool.execute('
];

let changes = 0;
for (let i = 0; i < originalQueries.length; i++) {
  const original = originalQueries[i];
  const fixed = fixedQueries[i];
  
  if (content.includes(original)) {
    content = content.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fixed);
    changes++;
    console.log(`✅ Fixed: ${original} → ${fixed}`);
  }
}

// Write the fixed content back
fs.writeFileSync(rconFile, content, 'utf8');

console.log(`\n🎉 Fixed ${changes} database query calls for MariaDB compatibility!`);
console.log('The autokit system should now work properly.');
console.log('\nNext steps:');
console.log('1. Restart your bot');
console.log('2. Try using the emote again');
console.log('3. Check the logs for successful kit claims'); 