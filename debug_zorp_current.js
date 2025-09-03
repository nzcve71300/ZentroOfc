const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugZorpCurrent() {
  console.log('🔍 Debugging Current ZORP Status - Real-time Check');
  console.log('================================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Check current ZORP zones and their status
    console.log('📋 Checking Current ZORP Zones Status...\n');
    
    const [zones] = await connection.execute(`
      SELECT 
        z.name,
        z.owner,
        z.current_state,
        z.color_online,
        z.color_offline,
        z.delay,
        z.expire,
        z.created_at,
        z.last_online_at,
        rs.nickname as server_name,
        rs.ip,
        rs.port,
        rs.password
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.created_at DESC
      LIMIT 15
    `);

    if (zones.length === 0) {
      console.log('❌ No active ZORP zones found!');
      return;
    }

    console.log(`Found ${zones.length} active ZORP zones:\n`);

    for (const zone of zones) {
      console.log(`🏠 **Zone: ${zone.name}**`);
      console.log(`   Owner: ${zone.owner}`);
      console.log(`   Server: ${zone.server_name}`);
      console.log(`   Current State: ${zone.current_state || 'unknown'}`);
      console.log(`   Online Color: ${zone.color_online || 'default'}`);
      console.log(`   Offline Color: ${zone.color_offline || 'default'}`);
      console.log(`   Delay: ${zone.delay || 0} minutes`);
      console.log(`   Created: ${zone.created_at}`);
      console.log(`   Last Online: ${zone.last_online_at || 'Never'}`);
      
      // Calculate time remaining
      const created = new Date(zone.created_at);
      const now = new Date();
      const elapsed = Math.floor((now - created) / 1000);
      const remaining = zone.expire - elapsed;
      const remainingHours = Math.floor(remaining / 3600);
      const remainingMinutes = Math.floor((remaining % 3600) / 60);
      
      console.log(`   Time Remaining: ${remainingHours}h ${remainingMinutes}m`);
      console.log(`   Server IP: ${zone.ip}`);
      console.log(`   Server Port: ${zone.port}`);
      console.log('');

      // Check if this zone should be online based on current time
      if (zone.current_state === 'red' || zone.current_state === 'yellow') {
        console.log(`   ⚠️  ZONE IS OFFLINE (${zone.current_state.toUpperCase()})`);
        console.log(`   🔍 This zone should be showing as offline in-game`);
        console.log('');
      } else if (zone.current_state === 'green') {
        console.log(`   ✅ ZONE IS ONLINE (GREEN)`);
        console.log(`   🔍 This zone should be showing as online in-game`);
        console.log('');
      } else {
        console.log(`   ❓ ZONE STATE UNKNOWN: ${zone.current_state}`);
        console.log('');
      }
    }

    // Now let's test the actual RCON commands to see what's happening
    console.log('🔌 Testing Current RCON Player Detection...\n');
    
    // Get a server with active ZORP zones to test
    const [serverResult] = await connection.execute(`
      SELECT DISTINCT
        rs.id,
        rs.nickname,
        rs.ip,
        rs.port,
        rs.password
      FROM rust_servers rs
      JOIN zorp_zones z ON rs.id = z.server_id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      LIMIT 1
    `);

    if (serverResult.length > 0) {
      const server = serverResult[0];
      console.log(`🎯 Testing server: ${server.nickname}`);
      console.log(`   IP: ${server.ip}`);
      console.log(`   Port: ${server.port}`);
      console.log('');

      try {
        // Import the RCON function
        const { sendRconCommand } = require('./src/rcon/index.js');
        
        console.log('✅ RCON module imported successfully');
        
        // Test 'players' command
        console.log('📡 Testing "players" command...');
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

        // Test 'users' command
        console.log('\n📡 Testing "users" command...');
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
        
        if (detectedPlayers.length > 0) {
          const placeholders = detectedPlayers.map(() => '?').join(',');
          const [playerZones] = await connection.execute(`
            SELECT 
              z.name,
              z.owner,
              z.current_state,
              z.last_online_at
            FROM zorp_zones z
            WHERE z.owner IN (${placeholders}) AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
          `, detectedPlayers);

          if (playerZones.length > 0) {
            console.log(`Found ${playerZones.length} zones for detected players:`);
            playerZones.forEach(zone => {
              console.log(`   - ${zone.name} (${zone.owner}): ${zone.current_state || 'unknown'} - Last online: ${zone.last_online_at || 'Never'}`);
            });
          } else {
            console.log('No zones found for detected players');
          }
        }

      } catch (error) {
        console.log(`❌ Failed to import RCON module: ${error.message}`);
      }
    }

    console.log('\n🔍 **Current ZORP Status Summary:**');
    console.log(`   Total Active Zones: ${zones.length}`);
    console.log(`   Online Zones (Green): ${zones.filter(z => z.current_state === 'green').length}`);
    console.log(`   Offline Zones (Red): ${zones.filter(z => z.current_state === 'red').length}`);
    console.log(`   Delay Zones (Yellow): ${zones.filter(z => z.current_state === 'yellow').length}`);
    console.log(`   Unknown State: ${zones.filter(z => !z.current_state || z.current_state === '').length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

debugZorpCurrent();
