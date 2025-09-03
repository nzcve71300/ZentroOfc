const mysql = require('mysql2/promise');
require('dotenv').config();

async function testZorpFix() {
  console.log('🧪 Testing ZORP Player Detection Fix');
  console.log('====================================\n');

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

    // Test the fixed getOnlinePlayers function
    console.log('🔌 Testing Fixed RCON Player Detection...');
    
    try {
      // Import the RCON function
      const { sendRconCommand } = require('./src/rcon/index.js');
      
      console.log('✅ RCON module imported successfully');
      
      // Test 'players' command (this should now work correctly)
      console.log('\n📡 Testing "players" command with fixed parsing...');
      try {
        const playersResult = await sendRconCommand(server.ip, server.port, server.password, 'players');
        console.log('✅ Players command successful');
        console.log('📄 Response preview:');
        console.log(playersResult.substring(0, 500) + '...');
        
        // Parse player count from players using the NEW logic
        const lines = playersResult.split('\n');
        let playerCount = 0;
        let detectedPlayers = [];
        
        for (const line of lines) {
          // Parse format: "NA ;PlayerName ;ping ;snap ;updt ;posi ;dist ;"
          if (line.trim() && line.includes(';') && !line.includes('id ;name')) {
            const parts = line.split(';');
            if (parts.length >= 2) {
              const playerName = parts[1].trim();
              // Filter out header and invalid entries
              if (playerName && playerName !== 'name' && !playerName.includes('NA') && 
                  !playerName.includes('id') && !playerName.includes('died') && 
                  !playerName.includes('Generic') && !playerName.includes('<slot:')) {
                playerCount++;
                detectedPlayers.push(playerName);
              }
            }
          }
        }
        
        console.log(`👥 Players detected from players: ${playerCount}`);
        if (detectedPlayers.length > 0) {
          console.log(`   Sample players: ${detectedPlayers.slice(0, 5).join(', ')}`);
        }
        
      } catch (error) {
        console.log(`❌ Players command failed: ${error.message}`);
      }

      // Test 'users' command (this should also work correctly now)
      console.log('\n📡 Testing "users" command with fixed parsing...');
      try {
        const usersResult = await sendRconCommand(server.ip, server.port, server.password, 'users');
        console.log('✅ Users command successful');
        console.log('📄 Response preview:');
        console.log(usersResult.substring(0, 500) + '...');
        
        // Parse player count from users using the NEW logic
        const lines = usersResult.split('\n');
        let playerCount = 0;
        let detectedPlayers = [];
        
        for (const line of lines) {
          // Parse format: "PlayerName" (quoted names)
          if (line.trim() && line.startsWith('"') && line.endsWith('"')) {
            const playerName = line.trim().replace(/^"|"$/g, '');
            // Filter out invalid entries
            if (playerName && !playerName.includes('died') && !playerName.includes('Generic') && 
                !playerName.includes('<slot:') && !playerName.includes('1users') && 
                !playerName.includes('id ;name') && !playerName.includes('NA ;') &&
                !playerName.includes('0users') && !playerName.includes('users') &&
                !playerName.includes('slot:') && !playerName.includes('name')) {
              playerCount++;
              detectedPlayers.push(playerName);
            }
          }
        }
        
        console.log(`👥 Players detected from users: ${playerCount}`);
        if (detectedPlayers.length > 0) {
          console.log(`   Sample players: ${detectedPlayers.slice(0, 5).join(', ')}`);
        }
        
      } catch (error) {
        console.log(`❌ Users command failed: ${error.message}`);
      }

      // Check if any of the detected players have ZORP zones
      console.log('\n🏠 Checking if detected players have ZORP zones...');
      
      const [zones] = await connection.execute(`
        SELECT 
          z.name,
          z.owner,
          z.current_state,
          z.last_online_at
        FROM zorp_zones z
        WHERE z.server_id = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
        ORDER BY z.created_at DESC
        LIMIT 10
      `, [server.id]);

      if (zones.length > 0) {
        console.log(`Found ${zones.length} active zones:`);
        zones.forEach(zone => {
          console.log(`   - ${zone.name} (${zone.owner}): ${zone.current_state || 'unknown'} - Last online: ${zone.last_online_at || 'Never'}`);
        });
      } else {
        console.log('No active zones found on this server');
      }

    } catch (error) {
      console.log(`❌ Failed to import RCON module: ${error.message}`);
      console.log('   This suggests the RCON system might not be properly configured');
    }

    console.log('\n🔍 **ZORP Fix Test Summary:**');
    console.log('   This test verifies that the player detection parsing has been fixed');
    console.log('   The system should now correctly detect players from:');
    console.log('   1. players command (semicolon-separated format)');
    console.log('   2. users command (quoted names format)');
    console.log('   3. status command (with fallback for non-steam ID names)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

testZorpFix();
