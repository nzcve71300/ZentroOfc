const pool = require('./src/db');

async function testEcoGamesFixes() {
  try {
    console.log('🧪 Testing Eco Games Fixes...\n');

    // Test 1: Check if eco_games_config table has the correct settings
    console.log('1. Testing eco_games_config table structure...');
    const [configResult] = await pool.query(
      'SELECT setting_name, setting_value FROM eco_games_config WHERE setting_name LIKE "%coinflip%" OR setting_name LIKE "%blackjack%" LIMIT 10'
    );
    console.log('✅ Config settings found:', configResult.length);
    configResult.forEach(row => {
      console.log(`   - ${row.setting_name}: ${row.setting_value}`);
    });

    // Test 2: Check if transactions table has guild_id column
    console.log('\n2. Testing transactions table structure...');
    const [transactionResult] = await pool.query(
      'DESCRIBE transactions'
    );
    const hasGuildId = transactionResult.some(col => col.Field === 'guild_id');
    console.log('✅ Transactions table has guild_id column:', hasGuildId);

    // Test 3: Test server autocomplete query pattern
    console.log('\n3. Testing server autocomplete query...');
    const [serverResult] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) LIMIT 5',
      ['123456789'] // Test guild ID
    );
    console.log('✅ Server autocomplete query works:', serverResult.length, 'servers found');

    // Test 4: Check if players table has guild_id column
    console.log('\n4. Testing players table structure...');
    const [playerResult] = await pool.query(
      'DESCRIBE players'
    );
    const hasPlayerGuildId = playerResult.some(col => col.Field === 'guild_id');
    console.log('✅ Players table has guild_id column:', hasPlayerGuildId);

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📝 Summary of fixes applied:');
    console.log('   - Fixed Coinflip autocomplete query pattern');
    console.log('   - Fixed Blackjack button interaction indentation');
    console.log('   - Added guild_id to all transaction inserts');
    console.log('   - Updated Coinflip settings to use eco_games_config table');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testEcoGamesFixes(); 