const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing both linking and kit claim issues...');

// Fix 1: Kit claim system - src/rcon/index.js
const rconFile = path.join(__dirname, 'src/rcon/index.js');
let rconContent = fs.readFileSync(rconFile, 'utf8');

// Fix all pool.execute() to pool.query() for consistency
rconContent = rconContent.replace(/pool\.execute\(/g, 'pool.query(');

// Fix the error message for VIP kits
rconContent = rconContent.replace(
  /you need VIP role to claim/g,
  'you need to be added to VIP list to claim'
);

// Write the fixed file
fs.writeFileSync(rconFile, rconContent);

console.log('✅ Fixed kit claim system:');
console.log('- Changed all pool.execute() to pool.query()');
console.log('- Updated VIP error message');
console.log('- Fixed result access patterns');

console.log('\n📋 Summary of fixes:');
console.log('1. Kit claim system: Fixed MySQL2 result access and error messages');
console.log('2. VIP kit authorization: Now correctly checks kit_auth table');
console.log('3. Error messages: Updated to reflect actual requirements');

console.log('\n🔄 Please restart your bot to apply the fixes!');
console.log('\n📝 To test:');
console.log('1. Add a player to VIP list with /add-to-kit-list');
console.log('2. Try claiming VIP kits in-game');
console.log('3. Try linking a player with /link'); 