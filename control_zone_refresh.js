#!/usr/bin/env node

const zoneRefreshSystem = require('./zone_refresh_system');

// Parse command line arguments
const command = process.argv[2] || 'status';

async function main() {
  try {
    switch (command) {
      case 'start':
        console.log('🚀 Starting Zone Refresh System...');
        zoneRefreshSystem.start();
        break;
        
      case 'stop':
        console.log('🛑 Stopping Zone Refresh System...');
        zoneRefreshSystem.stop();
        break;
        
      case 'restart':
        console.log('🔄 Restarting Zone Refresh System...');
        zoneRefreshSystem.stop();
        setTimeout(() => zoneRefreshSystem.start(), 1000);
        break;
        
      case 'refresh':
        console.log('🔄 Forcing immediate refresh...');
        await zoneRefreshSystem.forceRefresh();
        break;
        
      case 'status':
        const status = zoneRefreshSystem.getStatus();
        console.log('📊 Zone Refresh System Status:');
        console.log(`   Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
        console.log(`   Last Run: ${status.stats.lastRun || 'Never'}`);
        console.log(`   Total Zones: ${status.stats.totalZones}`);
        console.log(`   Zones Fixed: ${status.stats.fixedZones}`);
        console.log(`   Errors: ${status.stats.errors}`);
        console.log(`   Next Refresh: ${status.nextRefreshIn}`);
        break;
        
      case 'help':
        console.log('🔧 Zone Refresh System Control');
        console.log('');
        console.log('Commands:');
        console.log('  start    - Start the zone refresh system');
        console.log('  stop     - Stop the zone refresh system');
        console.log('  restart  - Restart the zone refresh system');
        console.log('  refresh  - Force an immediate refresh');
        console.log('  status   - Show system status (default)');
        console.log('  help     - Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  node control_zone_refresh.js start');
        console.log('  node control_zone_refresh.js status');
        console.log('  node control_zone_refresh.js refresh');
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Use "help" to see available commands');
        process.exit(1);
    }
    
    // If starting, keep the process running
    if (command === 'start') {
      console.log('\n💡 Zone Refresh System is now running...');
      console.log('Press Ctrl+C to stop');
      
      // Keep process alive
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        zoneRefreshSystem.stop();
        process.exit(0);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
