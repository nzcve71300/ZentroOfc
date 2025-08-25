const fs = require('fs');
const path = require('path');

const unlinkPath = path.join(__dirname, 'src', 'commands', 'admin', 'unlink.js');

try {
  let content = fs.readFileSync(unlinkPath, 'utf8');
  
  // Remove merge conflict markers
  content = content.replace(/<<<<<<< HEAD[\s\S]*?=======[\s\S]*?>>>>>>> [^\n]*\n/g, '');
  content = content.replace(/<<<<<<< HEAD[\s\S]*?>>>>>>> [^\n]*\n/g, '');
  
  // Write the cleaned content back
  fs.writeFileSync(unlinkPath, content, 'utf8');
  
  console.log('✅ Successfully removed merge conflict markers from unlink.js');
  console.log('✅ Bot should now start without crashing');
  
} catch (error) {
  console.error('❌ Error fixing unlink.js:', error);
}
