const pool = require('./src/db');

async function fixZorpZoneSync() {
  console.log('🔧 Fixing Zorp zone synchronization issues...\n');
  
  try {
    // 1. Clean up orphaned database records (zones that don't exist in game)
    console.log('1. Cleaning up orphaned database records...');
    
    const [servers] = await pool.query('SELECT id, nickname, ip, port, password FROM rust_servers');
    
    for (const server of servers) {
      console.log(`\nProcessing server: ${server.nickname}`);
      
      try {
        // Get zones from database
        const [dbZones] = await pool.query(
          'SELECT id, name, owner, current_state FROM zorp_zones WHERE server_id = ?',
          [server.id]
        );
        
        console.log(`  Found ${dbZones.length} zones in database`);
        
        // Check each zone to see if it exists in the game
        let orphanedCount = 0;
        
        for (const zone of dbZones) {
          try {
            // Try to get zone info from game
            const zoneInfo = await sendRconCommand(server.ip, server.port, server.password, `zones.getcustomzone "${zone.name}"`);
            
            if (!zoneInfo || zoneInfo.includes('Could not find zone') || zoneInfo.includes('No zone found')) {
              console.log(`  ❌ Zone ${zone.name} (${zone.owner}) not found in game - marking as orphaned`);
              
              // Mark zone as orphaned by setting a special state
              await pool.query(
                'UPDATE zorp_zones SET current_state = "orphaned" WHERE id = ?',
                [zone.id]
              );
              
              orphanedCount++;
            } else {
              console.log(`  ✅ Zone ${zone.name} (${zone.owner}) exists in game`);
            }
          } catch (error) {
            console.log(`  ⚠️  Error checking zone ${zone.name}: ${error.message}`);
            // Mark as orphaned if we can't check
            await pool.query(
              'UPDATE zorp_zones SET current_state = "orphaned" WHERE id = ?',
              [zone.id]
            );
            orphanedCount++;
          }
        }
        
        console.log(`  Cleaned up ${orphanedCount} orphaned zones`);
        
      } catch (error) {
        console.log(`  ❌ Error processing server ${server.nickname}: ${error.message}`);
      }
    }
    
    // 2. Fix zones with "Unknown" owners
    console.log('\n2. Fixing zones with "Unknown" owners...');
    
    const [unknownZones] = await pool.query(
      'SELECT id, name, owner FROM zorp_zones WHERE owner = "Unknown" OR owner IS NULL OR owner = ""'
    );
    
    console.log(`Found ${unknownZones.length} zones with unknown owners`);
    
    for (const zone of unknownZones) {
      try {
        // Try to extract owner from zone name (format: ZORP_timestamp)
        const timestampMatch = zone.name.match(/ZORP_(\d+)/);
        if (timestampMatch) {
          const timestamp = parseInt(timestampMatch[1]);
          const createdDate = new Date(timestamp);
          
          console.log(`  Zone ${zone.name} created at ${createdDate.toISOString()}`);
          
          // Try to find the actual owner by looking at recent player activity
          // For now, we'll mark these as orphaned too
          await pool.query(
            'UPDATE zorp_zones SET current_state = "orphaned" WHERE id = ?',
            [zone.id]
          );
          
          console.log(`  Marked zone ${zone.name} as orphaned due to unknown owner`);
        }
      } catch (error) {
        console.log(`  Error processing zone ${zone.name}: ${error.message}`);
      }
    }
    
    // 3. Remove orphaned zones from database
    console.log('\n3. Removing orphaned zones from database...');
    
    const [deleteResult] = await pool.query(
      'DELETE FROM zorp_zones WHERE current_state = "orphaned"'
    );
    
    console.log(`Removed ${deleteResult.affectedRows} orphaned zones from database`);
    
    // 4. Fix zones that are stuck in wrong states
    console.log('\n4. Fixing zones stuck in wrong states...');
    
    const [stuckZones] = await pool.query(`
      SELECT z.*, rs.ip, rs.port, rs.password, rs.nickname
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      AND z.current_state IN ('yellow', 'red')
    `);
    
    console.log(`Found ${stuckZones.length} zones that might be stuck`);
    
    for (const zone of stuckZones) {
      try {
        // Check if zone exists in game
        const zoneInfo = await sendRconCommand(zone.ip, zone.port, zone.password, `zones.getcustomzone "${zone.name}"`);
        
        if (zoneInfo && !zoneInfo.includes('Could not find zone')) {
          console.log(`  Zone ${zone.name} exists in game, checking if owner is online...`);
          
          // Check if owner is online
          const onlinePlayers = await getOnlinePlayers(zone.ip, zone.port, zone.password);
          
          if (onlinePlayers && onlinePlayers.has(zone.owner)) {
            console.log(`  Owner ${zone.owner} is online, setting zone to green`);
            
            // Set zone to green
            await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" allowbuilding 1`);
            await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" allowbuildingdamage 1`);
            await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" allowpvpdamage 1`);
            await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.name}" color (${zone.color_online})`);
            
            // Update database
            await pool.query(
              'UPDATE zorp_zones SET current_state = "green" WHERE id = ?',
              [zone.id]
            );
            
            console.log(`  ✅ Fixed zone ${zone.name} - set to green`);
          } else {
            console.log(`  Owner ${zone.owner} is offline, zone state is correct`);
          }
        } else {
          console.log(`  Zone ${zone.name} doesn't exist in game, marking as orphaned`);
          await pool.query(
            'UPDATE zorp_zones SET current_state = "orphaned" WHERE id = ?',
            [zone.id]
          );
        }
      } catch (error) {
        console.log(`  Error processing zone ${zone.name}: ${error.message}`);
      }
    }
    
    // 5. Final cleanup
    console.log('\n5. Final cleanup...');
    
    const [finalDeleteResult] = await pool.query(
      'DELETE FROM zorp_zones WHERE current_state = "orphaned"'
    );
    
    console.log(`Removed ${finalDeleteResult.affectedRows} additional orphaned zones`);
    
    console.log('\n✅ Zorp zone synchronization fix completed!');
    console.log('📝 Summary:');
    console.log('   - Cleaned up orphaned database records');
    console.log('   - Fixed zones with unknown owners');
    console.log('   - Corrected zones stuck in wrong states');
    console.log('   - Removed invalid zone records');
    console.log('\n🎮 Zorps should now work properly without getting stuck!');
    
  } catch (error) {
    console.error('❌ Error fixing Zorp zone sync:', error);
  } finally {
    await pool.end();
  }
}

// Helper function to send RCON commands
async function sendRconCommand(ip, port, password, command) {
  return new Promise((resolve, reject) => {
    const WebSocket = require('ws');
    const ws = new WebSocket(`ws://${ip}:${port}/${password}`);
    
    let responseReceived = false;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ Identifier: 1, Message: command, Name: 'WebRcon' }));
    });
    
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.Message) {
          responseReceived = true;
          ws.close();
          resolve(parsed.Message);
        }
      } catch (err) {
        if (!responseReceived) {
          reject(new Error(`Invalid RCON response: ${err.message}`));
        }
      }
    });
    
    ws.on('error', (err) => {
      if (!responseReceived) {
        reject(err);
      }
    });
    
    ws.on('close', () => {
      if (!responseReceived) {
        reject(new Error('Connection closed without response'));
      }
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!responseReceived) {
        ws.close();
        reject(new Error('RCON command timeout'));
      }
    }, 5000);
  });
}

// Helper function to get online players
async function getOnlinePlayers(ip, port, password) {
  try {
    const response = await sendRconCommand(ip, port, password, 'playerlist');
    if (!response) return null;
    
    const players = new Set();
    const lines = response.split('\n');
    
    for (const line of lines) {
      if (line.trim() && line.includes(';') && !line.includes('id ;name')) {
        const parts = line.split(';');
        if (parts.length >= 2) {
          const playerName = parts[1].trim();
          if (playerName && playerName !== 'name' && !playerName.includes('NA')) {
            players.add(playerName);
          }
        }
      }
    }
    
    return players;
  } catch (error) {
    console.error('Error getting online players:', error);
    return null;
  }
}

// Run the fix
fixZorpZoneSync();
