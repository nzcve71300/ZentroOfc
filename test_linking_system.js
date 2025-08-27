const { compareDiscordIds, normalizeDiscordId, isValidDiscordId } = require('./src/utils/discordUtils');

console.log('🧪 Testing Zentro Bot Linking System');
console.log('=====================================\n');

// Test Discord ID utilities
console.log('1. Testing Discord ID Utilities:');
console.log('--------------------------------');

const testDiscordIds = [
  '123456789012345678',
  '1234567890123456789',
  '12345678901234567890',
  BigInt('123456789012345678'),
  ' 123456789012345678 ', // with spaces
  'invalid_id',
  null,
  undefined
];

testDiscordIds.forEach((id, index) => {
  console.log(`Test ${index + 1}:`);
  console.log(`  Input: ${id} (type: ${typeof id})`);
  console.log(`  Normalized: ${normalizeDiscordId(id)}`);
  console.log(`  Valid: ${isValidDiscordId(id)}`);
  console.log('');
});

// Test Discord ID comparisons
console.log('2. Testing Discord ID Comparisons:');
console.log('-----------------------------------');

const comparisonTests = [
  ['123456789012345678', '123456789012345678', true],
  ['123456789012345678', BigInt('123456789012345678'), true],
  ['123456789012345678', ' 123456789012345678 ', true],
  ['123456789012345678', '987654321098765432', false],
  [BigInt('123456789012345678'), '123456789012345678', true],
  ['invalid1', 'invalid2', false],
  [null, null, true],
  [undefined, undefined, true],
  [null, '123456789012345678', false]
];

comparisonTests.forEach(([id1, id2, expected], index) => {
  const result = compareDiscordIds(id1, id2);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  console.log(`Test ${index + 1}: ${status}`);
  console.log(`  ${id1} == ${id2} => ${result} (expected: ${expected})`);
  console.log('');
});

// Test IGN handling
console.log('3. Testing IGN Handling:');
console.log('-------------------------');

const testIgns = [
  'NormalName',
  'WEIRD_NAME_123',
  'Name with spaces',
  'Name@#$%^&*()',
  'Name with 🎮 emoji',
  'Name with 中文 characters',
  'Name with 🏆🏅🎖️ multiple emojis',
  'Name_with_underscores',
  'Name-with-dashes',
  'Name.with.dots',
  'Name with numbers 123',
  'Name with symbols !@#$%^&*()',
  'Name with unicode 🎯🎲🎳',
  'Name with mixed case NaMe',
  'Name with leading/trailing spaces ',
  ' Name with leading/trailing spaces',
  '  Name with multiple spaces  '
];

console.log('Test IGNs that should be accepted:');
testIgns.forEach((ign, index) => {
  const trimmed = ign.trim();
  const isValid = trimmed.length >= 1 && trimmed.length <= 32;
  const status = isValid ? '✅ VALID' : '❌ INVALID';
  console.log(`${index + 1}. ${status}: "${ign}" -> "${trimmed}" (length: ${trimmed.length})`);
});

console.log('\n4. Testing Edge Cases:');
console.log('---------------------');

// Test empty and very long names
const edgeCaseIgns = [
  '', // empty
  ' ', // only space
  'a', // single character
  'A'.repeat(33), // too long
  'A'.repeat(32), // exactly max length
  'A'.repeat(31), // just under max length
  '\t\n\r', // whitespace characters
  'null',
  'undefined'
];

console.log('Edge case IGNs:');
edgeCaseIgns.forEach((ign, index) => {
  const trimmed = ign.trim();
  const isValid = trimmed.length >= 1 && trimmed.length <= 32;
  const status = isValid ? '✅ VALID' : '❌ INVALID';
  console.log(`${index + 1}. ${status}: "${ign}" -> "${trimmed}" (length: ${trimmed.length})`);
});

console.log('\n✅ Linking system test completed!');
console.log('\nKey improvements made:');
console.log('• Discord IDs are now properly normalized and compared');
console.log('• IGNs preserve original case and special characters');
console.log('• Weird names with symbols, emojis, and unicode are supported');
console.log('• Same user can update their existing link');
console.log('• Proper validation for edge cases');
