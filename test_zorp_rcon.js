const mysql = require('mysql2/promise');
require('dotenv').config();

async function testZorpRcon() {
  console.log('🧪 Testing ZORP RCON Commands');
  console.log('==============================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Get a server with active ZORP zones to test
    console.log('📋 Finding server with active ZORP zones...\n');
    
    const [serverResult] = await connection.execute(`
      SELECT DISTINCT
        rs.id,
        rs.nickname,
        rs.ip,
        rs.port,
        rs.password,
        COUNT(z.id) as zone_count
      FROM rust_servers rs
      JOIN zorp_zones z ON rs.id = z.server_id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      GROUP BY rs.id
      ORDER BY zone_count DESC
      LIMIT 1
    `);

    if (serverResult.length === 0) {
      console.log('❌ No servers with active ZORP zones found!');
      return;
    }

    const server = serverResult[0];
    console.log(`🎯 Testing server: ${server.nickname}`);
    console.log(`   IP: ${server.ip}`);
    console.log(`   Port: ${server.port}`);
    console.log(`   Active Zones: ${server.zone_count}`);
    console.log('');

    // Test RCON connection and commands
    console.log('🔌 Testing RCON Connection...');
    
    try {
      // Import the RCON function
      const { sendRconCommand } = require('./src/rcon/index.js');
      
      console.log('✅ RCON module imported successfully');
      
      // Test basic connection with 'status' command
      console.log('\n📡 Testing "status" command...');
      try {
        const statusResult = await sendRconCommand(server.ip, server.port, server.password, 'status');
        console.log('✅ Status command successful');
        console.log('📄 Response preview:');
        console.log(statusResult.substring(0, 500) + '...');
        
        // Parse player count from status
        const lines = statusResult.split('\n');
        let playerCount = 0;
        for (const line of lines) {
          if (line.trim() && line.includes('(') && line.includes(')') && !line.includes('died')) {
            const match = line.match(/^([^(]+)/);
            if (match) {
              const playerName = match[1].trim();
              if (playerName && !playerName.includes('died') && !playerName.includes('Generic') && 
                  !playerName.includes('<slot:') && !playerName.includes('1users') && 
                  !playerName.includes('id ;name') && !playerName.includes('NA ;') &&
                  !playerName.includes('status') && !playerName.includes('players') &&
                  !playerName.includes('0users') && !playerName.includes('users')) {
                playerCount++;
              }
            }
          }
        }
        console.log(`👥 Players detected from status: ${playerCount}`);
        
      } catch (error) {
        console.log(`❌ Status command failed: ${error.message}`);
      }

      // Test 'players' command as fallback
      console.log('\n📡 Testing "players" command...');
      try {
        const playersResult = await sendRconCommand(server.ip, server.port, server.password, 'players');
        console.log('✅ Players command successful');
        console.log('📄 Response preview:');
        console.log(playersResult.substring(0, 500) + '...');
        
        // Parse player count from players
        const lines = playersResult.split('\n');
        let playerCount = 0;
        for (const line of lines) {
          if (line.trim() && line.includes('(') && line.includes(')')) {
            const match = line.match(/^([^(]+)/);
            if (match) {
              const playerName = match[1].trim();
              if (playerName && !playerName.includes('died') && !playerName.includes('Generic') && 
                  !playerName.includes('<slot:') && !playerName.includes('1users') && 
                  !playerName.includes('id ;name') && !playerName.includes('NA ;') &&
                  !playerName.includes('0users') && !playerName.includes('users')) {
                playerCount++;
              }
            }
          }
        }
        console.log(`👥 Players detected from players: ${playerCount}`);
        
      } catch (error) {
        console.log(`❌ Players command failed: ${error.message}`);
      }

      // Test 'users' command as last resort
      console.log('\n📡 Testing "users" command...');
      try {
        const usersResult = await sendRconCommand(server.ip, server.port, server.password, 'users');
        console.log('✅ Users command successful');
        console.log('📄 Response preview:');
        console.log(usersResult.substring(0, 500) + '...');
        
        // Parse player count from users
        const lines = usersResult.split('\n');
        let playerCount = 0;
        for (const line of lines) {
          if (line.trim() && !line.includes('Users:') && !line.includes('Total:')) {
            const playerName = line.trim();
            if (playerName && !playerName.includes('died') && !playerName.includes('Generic') && 
                !playerName.includes('<slot:') && !playerName.includes('1users') && 
                !playerName.includes('id ;name') && !playerName.includes('NA ;') &&
                !playerName.includes('0users') && !playerName.includes('users')) {
              playerCount++;
            }
          }
        }
        console.log(`👥 Players detected from users: ${playerCount}`);
        
      } catch (error) {
        console.log(`❌ Users command failed: ${error.message}`);
      }

    } catch (error) {
      console.log(`❌ Failed to import RCON module: ${error.message}`);
      console.log('   This suggests the RCON system might not be properly configured');
    }

    // Check ZORP zones on this server
    console.log('\n🏠 Checking ZORP zones on this server...');
    
    const [zones] = await connection.execute(`
      SELECT 
        z.name,
        z.owner,
        z.current_state,
        z.last_online_at
      FROM zorp_zones z
      WHERE z.server_id = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.created_at DESC
      LIMIT 5
    `, [server.id]);

    if (zones.length > 0) {
      console.log(`Found ${zones.length} active zones:`);
      zones.forEach(zone => {
        console.log(`   - ${zone.name} (${zone.owner}): ${zone.current_state || 'unknown'} - Last online: ${zone.last_online_at || 'Never'}`);
      });
    } else {
      console.log('No active zones found on this server');
    }

    console.log('\n🔍 **ZORP RCON Test Summary:**');
    console.log('   This test checks if the RCON commands used by the ZORP system are working');
    console.log('   If any commands fail, the ZORP system won\'t be able to detect online players');
    console.log('   The system tries: status → players → users (in that order)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

testZorpRcon();
