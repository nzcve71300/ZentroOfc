const ImprovedZorpSystem = require('./improved_zorp_system.js');

async function configureZorp() {
  console.log('⚙️  Zorp System Configuration\n');
  
  const zorpSystem = new ImprovedZorpSystem();
  
  try {
    // Start the system
    await zorpSystem.start();
    
    console.log('\n📋 Current Configuration:');
    const status = zorpSystem.getStatus();
    console.log(`   • Refresh Interval: ${status.config.refreshInterval / 60000} minutes`);
    console.log(`   • Skip Problematic Servers: ${status.config.skipProblematicServers}`);
    console.log(`   • Max RCON Retries: ${status.config.maxRconRetries}`);
    console.log(`   • RCON Timeout: ${status.config.rconTimeout}ms`);
    console.log(`   • Skipped Servers: ${status.config.skipServers.length > 0 ? status.config.skipServers.join(', ') : 'None'}`);
    
    console.log('\n🔧 Configuration Options:');
    console.log('   1. Skip problematic servers (prevents RCON timeouts)');
    console.log('   2. Reset server failures (re-enable all servers)');
    console.log('   3. Add server to skip list');
    console.log('   4. Remove server from skip list');
    console.log('   5. View system status');
    console.log('   6. Manual refresh');
    console.log('   7. Exit');
    
    // For now, just show the status and exit
    console.log('\n✅ System is running with current configuration');
    console.log('💡 Use the methods in the class to configure:');
    console.log('   • zorpSystem.resetServerFailures()');
    console.log('   • zorpSystem.addServerToSkipList("ServerName")');
    console.log('   • zorpSystem.removeServerFromSkipList("ServerName")');
    
    // Stop the system
    zorpSystem.stop();
    
  } catch (error) {
    console.error('❌ Configuration failed:', error);
  }
}

// Run configuration
configureZorp();
