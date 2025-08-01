const fs = require('fs');
const path = require('path');

// 1. Add validation to add-server command
const addServerValidation = `
// Add this validation function to your add-server command
function validateServerData(serverData) {
  const invalidPatterns = [
    /placeholder/i,
    /unknown/i,
    /test/i,
    /example/i,
    /dummy/i
  ];
  
  // Check for invalid IP patterns
  if (!serverData.ip || 
      invalidPatterns.some(pattern => pattern.test(serverData.ip)) ||
      serverData.ip === 'localhost' ||
      serverData.ip === '127.0.0.1') {
    throw new Error('Invalid server IP address');
  }
  
  // Check for invalid nickname patterns
  if (!serverData.nickname || 
      invalidPatterns.some(pattern => pattern.test(serverData.nickname))) {
    throw new Error('Invalid server nickname');
  }
  
  // Check for valid port range
  if (!serverData.port || serverData.port < 1 || serverData.port > 65535) {
    throw new Error('Invalid port number');
  }
  
  return true;
}

// Add this to your add-server command before inserting
try {
  validateServerData({
    ip: serverIP,
    nickname: serverName,
    port: serverPort
  });
} catch (error) {
  return interaction.editReply({
    embeds: [errorEmbed('Invalid Server Data', error.message)]
  });
}
`;

// 2. Add to index.js startup
const indexJsIntegration = `
// Add this near the top of your index.js
const { validateOnStartup, cleanupPlaceholderServers } = require('./startup_validation');

// Add this in your client.once('ready') event, right after console.log
client.once('ready', async () => {
  console.log(\`Zentro Bot is online as \${client.user.tag}\`);
  
  // Add these lines to your existing startup code
  try {
    await cleanupPlaceholderServers(); // Clean up any existing placeholders
    await validateOnStartup(); // Validate all servers
    console.log('✅ Server validation completed');
  } catch (error) {
    console.error('❌ Error during server validation:', error);
  }
  
  // ... rest of your existing startup code
});
`;

// 3. Add periodic monitoring
const monitoringIntegration = `
// Add this to your index.js for periodic monitoring
const { monitorServerHealth } = require('./startup_validation');

// Add this after your client.once('ready') event
// Run health monitoring every hour
setInterval(async () => {
  try {
    await monitorServerHealth();
  } catch (error) {
    console.error('❌ Error during health monitoring:', error);
  }
}, 60 * 60 * 1000); // Every hour
`;

console.log('🔧 Integration files created!');
console.log('\n📋 Integration Instructions:');
console.log('\n1. Add validation to your add-server command:');
console.log('   - Copy the validation code above');
console.log('   - Add it to src/commands/admin/addServer.js');
console.log('   - Add the validation before the database insert');

console.log('\n2. Add startup validation to index.js:');
console.log('   - Add the require statement at the top');
console.log('   - Add the cleanup and validation calls in the ready event');

console.log('\n3. Add periodic monitoring:');
console.log('   - Add the monitoring code to index.js');
console.log('   - This will run health checks every hour');

console.log('\n4. Test the prevention:');
console.log('   - Try adding a server with "placeholder" in the name');
console.log('   - It should be rejected with an error message');

console.log('\n🎉 Your bot is now protected against placeholder servers!');
console.log('💡 The system will:');
console.log('   - Clean up placeholders on startup');
console.log('   - Validate all servers on startup');
console.log('   - Prevent invalid data from being added');
console.log('   - Monitor for suspicious patterns hourly');
console.log('   - Block placeholder data at the database level');

// Create integration files
fs.writeFileSync('add_server_validation.js', addServerValidation);
fs.writeFileSync('index_integration.js', indexJsIntegration);
fs.writeFileSync('monitoring_integration.js', monitoringIntegration);

console.log('\n📁 Created integration files:');
console.log('   - add_server_validation.js');
console.log('   - index_integration.js');
console.log('   - monitoring_integration.js'); 