const fs = require('fs');

console.log('🔧 Fixing addCurrencyPlayer.js...');

const filePath = 'src/commands/admin/addCurrencyPlayer.js';

try {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix the malformed query
    content = content.replace(
      /'SELECT nickname FROM rust_servers WHERE guild_id = \? AND nickname LIKE \?' AND nickname LIKE \? LIMIT 25'/g,
      "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25'"
    );
    
    fs.writeFileSync(filePath, content);
    console.log('✅ Fixed addCurrencyPlayer.js');
  } else {
    console.log('❌ File not found:', filePath);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
} 