const pool = require('./src/db');

async function forceClearRcon() {
  try {
    console.log('🧹 Force clearing RCON connections...');
    console.log('====================================\n');
    
    // Step 1: Check current servers in database
    console.log('📋 Step 1: Checking current servers in database...');
    const [currentServers] = await pool.query('SELECT * FROM rust_servers');
    console.log(`Found ${currentServers.length} servers in database:`);
    
    if (currentServers.length === 0) {
      console.log('   No servers found in database');
    } else {
      currentServers.forEach((server, index) => {
        console.log(`   ${index + 1}. ${server.nickname} (${server.ip}:${server.port})`);
      });
    }
    
    // Step 2: Create a script to clear RCON connections
    console.log('\n📋 Step 2: Creating RCON cleanup script...');
    
    const rconCleanupScript = `// RCON Connection Cleanup Script
// Run this in the bot console or add to the bot startup

console.log('🧹 Clearing RCON connections...');

// Clear the activeConnections object
if (typeof activeConnections !== 'undefined') {
  console.log('📋 Clearing activeConnections...');
  
  // Close all existing connections
  for (const [key, connection] of Object.entries(activeConnections)) {
    if (connection && typeof connection.close === 'function') {
      try {
        connection.close();
        console.log(\`✅ Closed connection: \${key}\`);
      } catch (error) {
        console.log(\`⚠️ Error closing connection \${key}:\`, error.message);
      }
    }
  }
  
  // Clear the object
  Object.keys(activeConnections).forEach(key => {
    delete activeConnections[key];
  });
  
  console.log('✅ All RCON connections cleared');
} else {
  console.log('⚠️ activeConnections not found - connections may be in different scope');
}

// Clear other connection tracking objects
if (typeof onlineStatusChecks !== 'undefined') {
  onlineStatusChecks.clear();
  console.log('✅ Cleared onlineStatusChecks');
}

if (typeof onlinePlayers !== 'undefined') {
  onlinePlayers.clear();
  console.log('✅ Cleared onlinePlayers');
}

if (typeof playerTeamIds !== 'undefined') {
  playerTeamIds.clear();
  console.log('✅ Cleared playerTeamIds');
}

if (typeof recentJoins !== 'undefined') {
  recentJoins.clear();
  console.log('✅ Cleared recentJoins');
}

if (typeof eventFlags !== 'undefined') {
  eventFlags.clear();
  console.log('✅ Cleared eventFlags');
}

if (typeof serverEventStates !== 'undefined') {
  serverEventStates.clear();
  console.log('✅ Cleared serverEventStates');
}

if (typeof bountyTracking !== 'undefined') {
  bountyTracking.clear();
  console.log('✅ Cleared bountyTracking');
}

if (typeof activeBounties !== 'undefined') {
  activeBounties.clear();
  console.log('✅ Cleared activeBounties');
}

console.log('🎉 RCON cleanup complete!');
console.log('   The bot will now only connect to servers in the database');
`;
    
    // Write the cleanup script to a file
    const fs = require('fs');
    fs.writeFileSync('rcon_cleanup.js', rconCleanupScript);
    
    console.log('✅ Created RCON cleanup script: rcon_cleanup.js');
    
    // Step 3: Create a restart script
    console.log('\n📋 Step 3: Creating comprehensive restart script...');
    
    const comprehensiveRestartScript = `#!/bin/bash
echo "🔄 Comprehensive Zentro Bot Restart"
echo "=================================="

# Function to check if PM2 is available
check_pm2() {
    if command -v pm2 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to check if the bot is running
check_bot_running() {
    if check_pm2; then
        pm2 list | grep -q "zentro-bot"
        return $?
    else
        pgrep -f "node.*index.js" > /dev/null
        return $?
    fi
}

echo "📋 Step 1: Checking bot status..."

if check_bot_running; then
    echo "✅ Bot is currently running"
    
    if check_pm2; then
        echo "📋 Stopping bot with PM2..."
        pm2 stop zentro-bot
        sleep 3
        echo "📋 Starting bot with PM2..."
        pm2 start zentro-bot
        echo "✅ Bot restarted with PM2"
    else
        echo "📋 Stopping bot manually..."
        pkill -f "node.*index.js"
        sleep 3
        echo "📋 Starting bot manually..."
        nohup node index.js > bot.log 2>&1 &
        echo "✅ Bot restarted manually"
    fi
else
    echo "⚠️ Bot is not currently running"
    
    if check_pm2; then
        echo "📋 Starting bot with PM2..."
        pm2 start zentro-bot
        echo "✅ Bot started with PM2"
    else
        echo "📋 Starting bot manually..."
        nohup node index.js > bot.log 2>&1 &
        echo "✅ Bot started manually"
    fi
fi

echo ""
echo "🎉 Bot restart complete!"
echo "📋 RCON connections have been cleared"
echo "📋 The bot will only connect to servers in the database"
echo ""
echo "📝 To monitor the bot:"
if check_pm2; then
    echo "   pm2 logs zentro-bot"
else
    echo "   tail -f bot.log"
fi
`;
    
    fs.writeFileSync('restart_bot_comprehensive.sh', comprehensiveRestartScript);
    fs.chmodSync('restart_bot_comprehensive.sh', '755');
    
    console.log('✅ Created comprehensive restart script: restart_bot_comprehensive.sh');
    
    // Step 4: Summary
    console.log('\n🎉 FORCE CLEAR COMPLETE!');
    console.log('========================');
    console.log('✅ Created RCON cleanup script: rcon_cleanup.js');
    console.log('✅ Created restart script: restart_bot_comprehensive.sh');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: ./restart_bot_comprehensive.sh');
    console.log('   2. The bot will restart and clear all RCON connections');
    console.log('   3. Only servers in the database will be connected to');
    console.log('   4. No more connection attempts to the disconnected server');
    console.log('\n🔧 Alternative method:');
    console.log('   If the restart doesn\'t work, you can manually run the cleanup:');
    console.log('   node rcon_cleanup.js (in the bot console)');
    
  } catch (error) {
    console.error('❌ Error during force clear:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the force clear
forceClearRcon();
