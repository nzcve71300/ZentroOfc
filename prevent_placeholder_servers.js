const pool = require('./src/db');

async function preventPlaceholderServers() {
  try {
    console.log('🛡️ Setting up placeholder server prevention...');
    
    // 1. Create a trigger to prevent placeholder servers from being inserted
    console.log('🔧 Creating database triggers...');
    
    try {
      // Drop existing triggers if they exist
      await pool.query('DROP TRIGGER IF EXISTS prevent_placeholder_servers_insert');
      await pool.query('DROP TRIGGER IF EXISTS prevent_placeholder_servers_update');
      
      // Create trigger for INSERT
      await pool.query(`
        CREATE TRIGGER prevent_placeholder_servers_insert
        BEFORE INSERT ON rust_servers
        FOR EACH ROW
        BEGIN
          IF NEW.ip LIKE '%placeholder%' OR NEW.ip LIKE '%PLACEHOLDER%' OR 
             NEW.nickname LIKE '%Unknown%' OR NEW.nickname LIKE '%placeholder%' OR
             NEW.ip = '' OR NEW.ip IS NULL OR NEW.nickname = '' OR NEW.nickname IS NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot insert placeholder or invalid server data';
          END IF;
        END
      `);
      
      // Create trigger for UPDATE
      await pool.query(`
        CREATE TRIGGER prevent_placeholder_servers_update
        BEFORE UPDATE ON rust_servers
        FOR EACH ROW
        BEGIN
          IF NEW.ip LIKE '%placeholder%' OR NEW.ip LIKE '%PLACEHOLDER%' OR 
             NEW.nickname LIKE '%Unknown%' OR NEW.nickname LIKE '%placeholder%' OR
             NEW.ip = '' OR NEW.ip IS NULL OR NEW.nickname = '' OR NEW.nickname IS NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot update server with placeholder or invalid data';
          END IF;
        END
      `);
      
      console.log('✅ Database triggers created successfully');
    } catch (error) {
      console.log('⚠️ Could not create triggers (might not have privileges):', error.message);
    }
    
    // 2. Create a validation function in the bot code
    console.log('🔧 Creating validation functions...');
    
    const validationCode = `
// Add this to your bot's server validation logic
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

// Add this to your add-server command
async function addServerWithValidation(serverData) {
  try {
    validateServerData(serverData);
    
    // Proceed with server addition
    const result = await pool.query(
      'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password, rcon_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [serverData.id, serverData.guild_id, serverData.nickname, serverData.ip, serverData.port, serverData.password, serverData.rcon_password]
    );
    
    return result;
  } catch (error) {
    throw new Error('Server validation failed: ' + error.message);
  }
}
`;
    
    console.log('📝 Validation code template:');
    console.log(validationCode);
    
    // 3. Create a cleanup script that can be run periodically
    console.log('🔧 Creating cleanup script...');
    
    const cleanupScript = `
// Add this to your bot's startup routine
async function cleanupPlaceholderServers() {
  try {
    console.log('🧹 Checking for placeholder servers...');
    
    const [placeholderServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE ip LIKE "%placeholder%" OR ip LIKE "%PLACEHOLDER%" OR nickname LIKE "%Unknown%" OR nickname LIKE "%placeholder%" OR ip = "" OR nickname = ""'
    );
    
    if (placeholderServers.length > 0) {
      console.log(\`Found \${placeholderServers.length} placeholder servers, removing...\`);
      
      for (const server of placeholderServers) {
        // Remove related data
        await pool.query('DELETE FROM eco_games WHERE server_id = ?', [server.id]);
        await pool.query('DELETE FROM eco_games_config WHERE server_id = ?', [server.id]);
        await pool.query('DELETE FROM players WHERE server_id = ?', [server.id]);
        await pool.query('DELETE FROM economy WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)', [server.id]);
        await pool.query('DELETE FROM transactions WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)', [server.id]);
        
        // Remove the server
        await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
        console.log(\`✅ Removed placeholder server: \${server.nickname}\`);
      }
    } else {
      console.log('✅ No placeholder servers found');
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Call this on bot startup
cleanupPlaceholderServers();
`;
    
    console.log('📝 Cleanup script template:');
    console.log(cleanupScript);
    
    // 4. Create a monitoring script
    console.log('🔧 Creating monitoring script...');
    
    const monitoringScript = `
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
        console.warn(\`⚠️ Suspicious server detected: \${server.nickname} (\${server.ip})\`);
        // You could add automatic cleanup here
      }
    }
  } catch (error) {
    console.error('❌ Error during health check:', error);
  }
}

// Run this every hour
setInterval(monitorServerHealth, 60 * 60 * 1000);
`;
    
    console.log('📝 Monitoring script template:');
    console.log(monitoringScript);
    
    // 5. Create a startup check
    console.log('🔧 Creating startup validation...');
    
    const startupCheck = `
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
        console.warn(\`⚠️ Server \${server.nickname} has issues: \${issues.join(', ')}\`);
        issuesFound++;
      }
    }
    
    if (issuesFound > 0) {
      console.warn(\`⚠️ Found \${issuesFound} servers with potential issues\`);
    } else {
      console.log('✅ All servers validated successfully');
    }
  } catch (error) {
    console.error('❌ Error during startup validation:', error);
  }
}

// Call this on bot startup
validateOnStartup();
`;
    
    console.log('📝 Startup validation template:');
    console.log(startupCheck);
    
    console.log('\n🎉 Placeholder prevention setup complete!');
    console.log('💡 Prevention measures:');
    console.log('   1. Database triggers (if privileges allow)');
    console.log('   2. Validation functions for server addition');
    console.log('   3. Automatic cleanup on startup');
    console.log('   4. Periodic health monitoring');
    console.log('   5. Startup validation checks');
    
    console.log('\n📋 Next steps:');
    console.log('   1. Add the validation code to your add-server command');
    console.log('   2. Add the cleanup script to your bot startup');
    console.log('   3. Add the monitoring script for periodic checks');
    console.log('   4. Test with invalid data to ensure prevention works');
    
  } catch (error) {
    console.error('❌ Error setting up prevention:', error);
  } finally {
    await pool.end();
  }
}

preventPlaceholderServers(); 