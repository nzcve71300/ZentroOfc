const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixZorpZoneStates() {
  console.log('🔧 Fixing Stuck ZORP Zone States');
  console.log('==================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Get all active ZORP zones
    console.log('📋 Getting all active ZORP zones...\n');
    
    const [zones] = await connection.execute(`
      SELECT 
        z.id,
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
    `);

    if (zones.length === 0) {
      console.log('❌ No active ZORP zones found!');
      return;
    }

    console.log(`Found ${zones.length} active ZORP zones to check.\n`);

    // Group zones by server for efficient RCON calls
    const zonesByServer = {};
    zones.forEach(zone => {
      const serverKey = `${zone.server_name}_${zone.ip}_${zone.port}`;
      if (!zonesByServer[serverKey]) {
        zonesByServer[serverKey] = {
          serverName: zone.server_name,
          ip: zone.ip,
          port: zone.port,
          password: zone.password,
          zones: []
        };
      }
      zonesByServer[serverKey].zones.push(zone);
    });

    console.log(`Grouped into ${Object.keys(zonesByServer).length} servers.\n`);

    let totalFixed = 0;
    let totalChecked = 0;

    // Process each server
    for (const [serverKey, serverData] of Object.entries(zonesByServer)) {
      console.log(`🔍 Processing server: ${serverData.serverName}`);
      console.log(`   IP: ${serverData.ip}:${serverData.port}`);
      console.log(`   Zones to check: ${serverData.zones.length}`);
      console.log('');

      try {
        // Import the RCON function
        const { sendRconCommand } = require('./src/rcon/index.js');
        
        // Get current online players for this server
        console.log('📡 Getting online players...');
        let onlinePlayers = new Set();
        
        // Try 'players' command first
        try {
          const playersResult = await sendRconCommand(serverData.ip, serverData.port, serverData.password, 'players');
          if (playersResult) {
            const lines = playersResult.split('\n');
            for (const line of lines) {
              if (line.trim() && line.includes(';') && !line.includes('id ;name')) {
                const parts = line.split(';');
                if (parts.length >= 2) {
                  const playerName = parts[1].trim();
                  if (playerName && playerName !== 'name' && !playerName.includes('NA') && 
                      !playerName.includes('id') && !playerName.includes('died') && 
                      !playerName.includes('Generic') && !playerName.includes('<slot:')) {
                    onlinePlayers.add(playerName);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Players command failed: ${error.message}`);
        }

        // Try 'users' command as fallback
        if (onlinePlayers.size === 0) {
          try {
            const usersResult = await sendRconCommand(serverData.ip, serverData.port, serverData.password, 'users');
            if (usersResult) {
              const lines = usersResult.split('\n');
              for (const line of lines) {
                if (line.trim() && line.startsWith('"') && line.endsWith('"')) {
                  const playerName = line.trim().replace(/^"|"$/g, '');
                  if (playerName && !playerName.includes('died') && !playerName.includes('Generic') && 
                      !playerName.includes('<slot:') && !playerName.includes('1users') && 
                      !playerName.includes('id ;name') && !playerName.includes('NA ;') &&
                      !playerName.includes('0users') && !playerName.includes('users') &&
                      !playerName.includes('slot:') && !playerName.includes('name')) {
                    onlinePlayers.add(playerName);
                  }
                }
              }
            }
          } catch (error) {
            console.log(`   ⚠️  Users command failed: ${error.message}`);
          }
        }

        console.log(`   👥 Found ${onlinePlayers.size} online players: ${Array.from(onlinePlayers).slice(0, 5).join(', ')}${onlinePlayers.size > 5 ? '...' : ''}`);

        // Check each zone on this server
        for (const zone of serverData.zones) {
          totalChecked++;
          console.log(`\n   🏠 Checking zone: ${zone.name} (${zone.owner})`);
          console.log(`      Current state: ${zone.current_state || 'unknown'}`);
          console.log(`      Last online: ${zone.last_online_at || 'Never'}`);

          // Check if zone owner is online
          const isOwnerOnline = onlinePlayers.has(zone.owner);
          console.log(`      Owner online: ${isOwnerOnline ? '✅ YES' : '❌ NO'}`);

          // Determine what the zone state should be
          let shouldBeState = 'red';
          let reason = '';

          if (isOwnerOnline) {
            shouldBeState = 'green';
            reason = 'Owner is online';
          } else {
            // Check if any team members are online (simplified check)
            let teamMemberOnline = false;
            for (const onlinePlayer of onlinePlayers) {
              // Simple check: if player name contains part of zone owner name or vice versa
              if (onlinePlayer.toLowerCase().includes(zone.owner.toLowerCase()) || 
                  zone.owner.toLowerCase().includes(onlinePlayer.toLowerCase())) {
                teamMemberOnline = true;
                reason = `Team member ${onlinePlayer} is online`;
                break;
              }
            }
            
            if (teamMemberOnline) {
              shouldBeState = 'green';
            } else {
              shouldBeState = 'red';
              reason = 'No team members online';
            }
          }

          console.log(`      Should be: ${shouldBeState} (${reason})`);

          // Fix zone state if needed
          if (zone.current_state !== shouldBeState) {
            console.log(`      🔧 FIXING: Zone state mismatch!`);
            
            try {
              if (shouldBeState === 'green') {
                // Set zone to green
                console.log(`      📡 Setting zone to green...`);
                
                // Update zone settings via RCON
                await sendRconCommand(serverData.ip, serverData.port, serverData.password, `zones.editcustomzone "${zone.name}" allowbuilding 1`);
                await sendRconCommand(serverData.ip, serverData.port, serverData.password, `zones.editcustomzone "${zone.name}" allowbuildingdamage 1`);
                await sendRconCommand(serverData.ip, serverData.port, serverData.password, `zones.editcustomzone "${zone.name}" allowpvpdamage 1`);
                await sendRconCommand(serverData.ip, serverData.port, serverData.password, `zones.editcustomzone "${zone.name}" color (${zone.color_online || '0,255,0'})`);
                
                // Update database
                await connection.execute(
                  'UPDATE zorp_zones SET current_state = ?, last_online_at = NOW() WHERE id = ?',
                  ['green', zone.id]
                );
                
                console.log(`      ✅ Zone set to GREEN successfully!`);
                totalFixed++;
                
              } else if (shouldBeState === 'red') {
                // Set zone to red
                console.log(`      📡 Setting zone to red...`);
                
                // Update zone settings via RCON
                await sendRconCommand(serverData.ip, serverData.port, serverData.password, `zones.editcustomzone "${zone.name}" allowbuilding 1`);
                await sendRconCommand(serverData.ip, serverData.port, serverData.password, `zones.editcustomzone "${zone.name}" allowbuildingdamage 0`);
                await sendRconCommand(serverData.ip, serverData.port, serverData.password, `zones.editcustomzone "${zone.name}" allowpvpdamage 1`);
                await sendRconCommand(serverData.ip, serverData.port, serverData.password, `zones.editcustomzone "${zone.name}" color (${zone.color_offline || '255,0,0'})`);
                
                // Update database
                await connection.execute(
                  'UPDATE zorp_zones SET current_state = ? WHERE id = ?',
                  ['red', zone.id]
                );
                
                console.log(`      ✅ Zone set to RED successfully!`);
                totalFixed++;
              }
              
            } catch (error) {
              console.log(`      ❌ Failed to fix zone: ${error.message}`);
            }
            
          } else {
            console.log(`      ✅ Zone state is correct`);
          }
        }

        console.log('');

      } catch (error) {
        console.log(`   ❌ Failed to process server: ${error.message}`);
      }
    }

    console.log('🎉 **ZORP Zone State Fix Complete!**');
    console.log('=====================================');
    console.log(`   Total zones checked: ${totalChecked}`);
    console.log(`   Total zones fixed: ${totalFixed}`);
    console.log(`   Zones already correct: ${totalChecked - totalFixed}`);

    if (totalFixed > 0) {
      console.log('\n✅ **Fixed Zones Summary:**');
      console.log('   - Zones now show correct online/offline status');
      console.log('   - Database states are synchronized with in-game states');
      console.log('   - RCON commands executed successfully');
    }

    console.log('\n🔍 **Next Steps:**');
    console.log('   1. Check in-game ZORP zones - they should now show correct colors');
    console.log('   2. Monitor bot logs for proper ZORP state management');
    console.log('   3. The system should now maintain correct states automatically');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

fixZorpZoneStates();
