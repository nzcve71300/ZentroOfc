const fs = require('fs');
const path = require('path');

const rconFilePath = path.join(__dirname, 'src', 'rcon', 'index.js');

console.log('🔧 Fixing RCON queries for MariaDB compatibility...');
console.log(`📁 Target file: ${rconFilePath}`);

try {
    // Check if file exists
    if (!fs.existsSync(rconFilePath)) {
        console.error('❌ Error: src/rcon/index.js not found!');
        console.log('📂 Current directory contents:');
        const files = fs.readdirSync(__dirname);
        files.forEach(file => console.log(`   - ${file}`));
        process.exit(1);
    }

    // Read the file
    let content = fs.readFileSync(rconFilePath, 'utf8');
    console.log('📖 File read successfully');

    // Count original pool.query occurrences
    const originalCount = (content.match(/pool\.query\(/g) || []).length;
    console.log(`🔍 Found ${originalCount} pool.query() calls`);

    if (originalCount === 0) {
        console.log('✅ No pool.query() calls found - file may already be fixed');
        process.exit(0);
    }

    // Replace pool.query with pool.execute
    let newContent = content.replace(/pool\.query\(/g, 'pool.execute(');
    
    // Count replacements
    const newCount = (newContent.match(/pool\.execute\(/g) || []).length;
    console.log(`🔄 Replaced ${newCount} pool.query() calls with pool.execute()`);

    // Write the fixed content back
    fs.writeFileSync(rconFilePath, newContent, 'utf8');
    console.log('💾 File updated successfully');

    // Show a sample of the changes
    console.log('\n📋 Sample of changes made:');
    const lines = newContent.split('\n');
    let shownLines = 0;
    for (let i = 0; i < lines.length && shownLines < 5; i++) {
        if (lines[i].includes('pool.execute(')) {
            console.log(`   Line ${i + 1}: ${lines[i].trim()}`);
            shownLines++;
        }
    }

    console.log('\n✅ RCON queries fixed for MariaDB!');
    console.log('🔄 Please restart your bot with: pm2 restart zentro-bot');

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
} 