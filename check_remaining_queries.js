const fs = require('fs');
const path = require('path');

const rconFilePath = path.join(__dirname, 'src', 'rcon', 'index.js');

console.log('🔍 Checking for remaining pool.query() calls...');
console.log(`📁 Target file: ${rconFilePath}`);

try {
    // Check if file exists
    if (!fs.existsSync(rconFilePath)) {
        console.error('❌ Error: src/rcon/index.js not found!');
        process.exit(1);
    }

    // Read the file
    let content = fs.readFileSync(rconFilePath, 'utf8');
    console.log('📖 File read successfully');

    // Find all pool.query occurrences
    const queryMatches = content.match(/pool\.query\(/g);
    const queryCount = queryMatches ? queryMatches.length : 0;
    console.log(`🔍 Found ${queryCount} pool.query() calls`);

    if (queryCount > 0) {
        console.log('\n❌ There are still pool.query() calls that need to be fixed!');
        
        // Find the lines with pool.query
        const lines = content.split('\n');
        console.log('\n📋 Lines with pool.query():');
        lines.forEach((line, index) => {
            if (line.includes('pool.query(')) {
                console.log(`   Line ${index + 1}: ${line.trim()}`);
            }
        });
        
        console.log('\n🔄 Please run the fix script again or manually fix these lines.');
    } else {
        console.log('✅ No pool.query() calls found - all should be fixed!');
        
        // Check for pool.execute calls
        const executeMatches = content.match(/pool\.execute\(/g);
        const executeCount = executeMatches ? executeMatches.length : 0;
        console.log(`✅ Found ${executeCount} pool.execute() calls`);
    }

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
} 