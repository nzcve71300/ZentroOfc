const fs = require('fs');

console.log('🔧 Fixing addShopCategory.js syntax error...');

const filePath = 'src/commands/admin/addShopCategory.js';

try {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix the malformed query - missing closing quote
    content = content.replace(
      /'SELECT nickname FROM rust_servers WHERE guild_id = \? AND nickname LIKE \?' LIMIT 25'/g,
      "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25'"
    );
    
    fs.writeFileSync(filePath, content);
    console.log('✅ Fixed addShopCategory.js');
  } else {
    console.log('❌ File not found:', filePath);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
} 