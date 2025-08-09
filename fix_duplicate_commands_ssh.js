const fs = require('fs');
const path = require('path');

async function fixDuplicateCommands() {
  try {
    console.log('🔧 SSH: Fixing Duplicate Command Issue...');

    const playerCommandsDir = './src/commands/player/';
    
    // Check what files exist
    console.log('\n📋 Current files in player commands directory:');
    const files = fs.readdirSync(playerCommandsDir);
    files.forEach(file => {
      console.log(`   - ${file}`);
    });

    // Check if link_updated.js exists
    const duplicateFile = path.join(playerCommandsDir, 'link_updated.js');
    
    if (fs.existsSync(duplicateFile)) {
      console.log('\n🗑️  Found duplicate file: link_updated.js');
      
      // Read the file to see what it contains
      const content = fs.readFileSync(duplicateFile, 'utf8');
      console.log('\n📄 Content preview of link_updated.js:');
      console.log(content.substring(0, 200) + '...');
      
      // Remove the duplicate file
      fs.unlinkSync(duplicateFile);
      console.log('\n✅ Removed duplicate file: link_updated.js');
      
    } else {
      console.log('\n⚠️  link_updated.js not found - checking for other duplicates...');
    }

    // Check for any other potential duplicate link files
    const linkFiles = files.filter(file => file.toLowerCase().includes('link'));
    console.log('\n🔍 All link-related files:');
    linkFiles.forEach(file => {
      const filePath = path.join(playerCommandsDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const commandNameMatch = content.match(/\.setName\(['"`]([^'"`]+)['"`]\)/);
        const commandName = commandNameMatch ? commandNameMatch[1] : 'unknown';
        console.log(`   - ${file} -> command name: "${commandName}"`);
      }
    });

    // List remaining files after cleanup
    console.log('\n📋 Files after cleanup:');
    const remainingFiles = fs.readdirSync(playerCommandsDir);
    const remainingLinkFiles = remainingFiles.filter(file => file.toLowerCase().includes('link'));
    remainingLinkFiles.forEach(file => {
      console.log(`   - ${file} ✅`);
    });

    console.log('\n🎉 Duplicate command cleanup completed!');
    console.log('💡 Now run: node deploy-commands.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the fix
fixDuplicateCommands().catch(console.error);