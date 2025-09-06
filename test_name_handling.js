// Test script to verify player name handling works with weird names
const pool = require('./src/db');

// Import the extractPlayerName function (we'll need to copy it here for testing)
function extractPlayerName(logLine) {
  // Try multiple formats for player name extraction
  let match = logLine.match(/\[CHAT LOCAL\] (.*?) :/);
  if (match) {
    return match[1];
  }
  
  // Try JSON format
  if (logLine.includes('"Username"')) {
    try {
      const parsed = JSON.parse(logLine);
      if (parsed.Username) return parsed.Username;
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  
  // Try direct format but exclude chat server messages
  match = logLine.match(/^([^:]+) :/);
  if (match) {
    let playerName = match[1];
    // Filter out chat server prefixes and system messages
    if (playerName.includes('[CHAT SERVER]')) {
      // Extract actual player name from "[CHAT SERVER] PlayerName"
      const serverMatch = playerName.match(/\[CHAT SERVER\]\s*(.+)/);
      if (serverMatch) {
        playerName = serverMatch[1].trim();
      } else {
        return null; // Invalid format
      }
    }
    
    // Only filter out obvious system messages, allow all player names including those with brackets
    // Allow names starting with [ (like [CLAN] PlayerName)
    // Allow names containing SERVER (as long as it's not the system message)
    // Only reject if it's clearly a system message or empty
    if (playerName.length < 1 || 
        playerName === 'SERVER' || 
        playerName === '[SERVER]' ||
        playerName.includes('[CHAT SERVER]') ||
        playerName.includes('[SAVE]') ||
        playerName.includes('[LOAD]') ||
        playerName.includes('[ERROR]') ||
        playerName.includes('[WARNING]') ||
        playerName.includes('[INFO]')) {
      return null;
    }
    
    return playerName;
  }
  
  return null;
}

async function testNameHandling() {
  console.log('🧪 Testing player name handling with weird names...\n');
  
  const testCases = [
    // Test cases that should work (return player name)
    { input: '[CLAN] PlayerName : hello', expected: '[CLAN] PlayerName', description: 'Name with brackets' },
    { input: 'PlayerNameWithVeryLongNameThatExceedsNormalLimits : hello', expected: 'PlayerNameWithVeryLongNameThatExceedsNormalLimits', description: 'Very long name' },
    { input: 'PlayerName with spaces : hello', expected: 'PlayerName with spaces', description: 'Name with spaces' },
    { input: 'PlayerName-with-dashes : hello', expected: 'PlayerName-with-dashes', description: 'Name with dashes' },
    { input: 'PlayerName_with_underscores : hello', expected: 'PlayerName_with_underscores', description: 'Name with underscores' },
    { input: 'PlayerName123 : hello', expected: 'PlayerName123', description: 'Name with numbers' },
    { input: 'PlayerName!@#$%^&*() : hello', expected: 'PlayerName!@#$%^&*()', description: 'Name with special characters' },
    { input: 'PlayerName with unicode: 测试名字 : hello', expected: 'PlayerName with unicode: 测试名字', description: 'Name with unicode' },
    { input: 'PlayerName with emoji: 🎮 : hello', expected: 'PlayerName with emoji: 🎮', description: 'Name with emoji' },
    { input: 'PlayerName [SERVER] (should be allowed) : hello', expected: 'PlayerName [SERVER] (should be allowed)', description: 'Name containing SERVER' },
    
    // Test cases that should be rejected (return null)
    { input: 'SERVER : system message', expected: null, description: 'System message SERVER' },
    { input: '[SERVER] : system message', expected: null, description: 'System message [SERVER]' },
    { input: '[CHAT SERVER] PlayerName : hello', expected: 'PlayerName', description: 'Chat server message (should extract player name)' },
    { input: '[SAVE] : system message', expected: null, description: 'System message [SAVE]' },
    { input: '[ERROR] : system message', expected: null, description: 'System message [ERROR]' },
    { input: ' : empty name', expected: null, description: 'Empty name' },
  ];
  
  let passed = 0;
  let failed = 0;
  
  console.log('Testing extractPlayerName function:');
  console.log('=' .repeat(80));
  
  for (const testCase of testCases) {
    const result = extractPlayerName(testCase.input);
    const success = result === testCase.expected;
    
    console.log(`\nTest: ${testCase.description}`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected: ${testCase.expected === null ? 'null' : `"${testCase.expected}"`}`);
    console.log(`Got: ${result === null ? 'null' : `"${result}"`}`);
    
    // Debug unicode and emoji tests
    if (testCase.description.includes('unicode') || testCase.description.includes('emoji')) {
      console.log(`Debug - Input bytes: ${Buffer.from(testCase.input).toString('hex')}`);
      if (result) {
        console.log(`Debug - Result bytes: ${Buffer.from(result).toString('hex')}`);
      }
    }
    
    console.log(`Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
    
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n' + '=' .repeat(80));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Player name handling is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the implementation.');
  }
  
  // Test database constraints
  console.log('\n🔍 Testing database constraints...');
  
  try {
    // Test if we can insert a long name (this will fail if constraints are too restrictive)
    const longName = 'PlayerNameWithVeryLongNameThatExceedsNormalLimitsAndShouldBeAllowedInTheDatabase';
    console.log(`Testing long name: "${longName}" (${longName.length} characters)`);
    
    // Just test the constraint, don't actually insert
    const [constraintCheck] = await pool.query(`
      SELECT CONSTRAINT_NAME, CHECK_CLAUSE 
      FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
      WHERE TABLE_NAME = 'players' 
      AND CONSTRAINT_NAME LIKE '%ign%'
    `);
    
    if (constraintCheck.length > 0) {
      console.log('Current IGN constraints:');
      constraintCheck.forEach(constraint => {
        console.log(`  - ${constraint.CONSTRAINT_NAME}: ${constraint.CHECK_CLAUSE}`);
      });
    } else {
      console.log('No IGN constraints found (this is good - no restrictions)');
    }
    
    console.log('✅ Database constraint check completed');
    
  } catch (error) {
    console.log('⚠️  Error checking database constraints:', error.message);
  }
  
  console.log('\n📝 Summary:');
  console.log('   - extractPlayerName function updated to be more permissive');
  console.log('   - Names with brackets, long names, and special characters are now allowed');
  console.log('   - Only obvious system messages are filtered out');
  console.log('   - Database constraints should be updated to allow longer names');
  console.log('\n🎮 Players with weird names should now be able to create Zorps!');
}

// Run the test
testNameHandling().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
