const pool = require('./src/db');

// Add this to your bot's startup routine
async function validateOnStartup() {
  try {
    console.log('🔍 Validating server data on startup...');
    
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    let issuesFound = 0;
    
    for (const server of servers) {
      const issues = [];
      
      if (!server.ip || server.ip === '') issues.push('Empty IP');
      if (!server.nickname || server.nickname === '') issues.push('Empty nickname');
      if (server.ip && server.ip.includes('placeholder')) issues.push('Placeholder IP');
      if (server.nickname && server.nickname.includes('Unknown')) issues.push('Unknown nickname');
      
      if (issues.length > 0) {
        console.warn(`⚠️ Server ${server.nickname} has issues: ${issues.join(', ')}`);
        issuesFound++;
      }
    }
    
    if (issuesFound > 0) {
      console.warn(`⚠️ Found ${issuesFound} servers with potential issues`);
    } else {
      console.log('✅ All servers validated successfully');
    }
  } catch (error) {
    console.error('❌ Error during startup validation:', error);
  }
}

// Add this to your bot's startup routine
async function cleanupPlaceholderServers() {
  try {
    console.log('🧹 Checking for placeholder servers...');
    
    const [placeholderServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE ip LIKE "%placeholder%" OR ip LIKE "%PLACEHOLDER%" OR nickname LIKE "%Unknown%" OR nickname LIKE "%placeholder%" OR ip = "" OR nickname = ""'
    );
    
    if (placeholderServers.length > 0) {
      console.log(`Found ${placeholderServers.length} placeholder servers, removing...`);
      
      for (const server of placeholderServers) {
        // Remove related data
        await pool.query('DELETE FROM eco_games WHERE server_id = ?', [server.id]);
        await pool.query('DELETE FROM eco_games_config WHERE server_id = ?', [server.id]);
        await pool.query('DELETE FROM players WHERE server_id = ?', [server.id]);
        await pool.query('DELETE FROM economy WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)', [server.id]);
        await pool.query('DELETE FROM transactions WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)', [server.id]);
        
        // Remove the server
        await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
        console.log(`✅ Removed placeholder server: ${server.nickname}`);
      }
    } else {
      console.log('✅ No placeholder servers found');
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Add this to your bot's periodic checks
async function monitorServerHealth() {
  try {
    console.log('🔍 Monitoring server health...');
    
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    
    for (const server of servers) {
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /placeholder/i,
        /unknown/i,
        /test/i,
        /example/i,
        /dummy/i
      ];
      
      const hasSuspiciousIP = suspiciousPatterns.some(pattern => pattern.test(server.ip));
      const hasSuspiciousName = suspiciousPatterns.some(pattern => pattern.test(server.nickname));
      
      if (hasSuspiciousIP || hasSuspiciousName) {
        console.warn(`⚠️ Suspicious server detected: ${server.nickname} (${server.ip})`);
        // You could add automatic cleanup here
      }
    }
  } catch (error) {
    console.error('❌ Error during health check:', error);
  }
}

// Export functions for use in your bot
module.exports = {
  validateOnStartup,
  cleanupPlaceholderServers,
  monitorServerHealth
};

// If running this script directly, run the validation
if (require.main === module) {
  (async () => {
    await cleanupPlaceholderServers();
    await validateOnStartup();
    process.exit(0);
  })();
} 