const {
  getServersForGuild,
  isDiscordIdLinkedToDifferentIgn,
  isIgnLinkedToDifferentDiscordId
} = require('./src/utils/unifiedPlayerSystem');

async function testLinkFunctions() {
  try {
    console.log('🧪 Testing link command functions...');
    
    // Test getServersForGuild with a sample guild ID
    const testGuildId = '123456789'; // Replace with a real guild ID from your database
    console.log(`Testing getServersForGuild with guild ID: ${testGuildId}`);
    
    const servers = await getServersForGuild(testGuildId);
    console.log('✅ getServersForGuild result:', servers);
    
    // Test the other functions
    const testDiscordId = '987654321';
    const testIgn = 'TestPlayer';
    
    console.log(`Testing isDiscordIdLinkedToDifferentIgn with Discord ID: ${testDiscordId}, IGN: ${testIgn}`);
    const isLinkedToDifferentIgn = await isDiscordIdLinkedToDifferentIgn(testGuildId, testDiscordId, testIgn);
    console.log('✅ isDiscordIdLinkedToDifferentIgn result:', isLinkedToDifferentIgn);
    
    console.log(`Testing isIgnLinkedToDifferentDiscordId with IGN: ${testIgn}, Discord ID: ${testDiscordId}`);
    const isIgnLinkedToDifferentDiscord = await isIgnLinkedToDifferentDiscordId(testGuildId, testIgn, testDiscordId);
    console.log('✅ isIgnLinkedToDifferentDiscordId result:', isIgnLinkedToDifferentDiscord);
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testLinkFunctions(); 