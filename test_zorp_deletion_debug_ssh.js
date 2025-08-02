const WebSocket = require('ws');
const pool = require('./src/db');

async function testZorpDeletionDebug() {
  try {
    console.log('🧪 Testing Zorp Deletion Debug in SSH...\n');

    // Get first server
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers LIMIT 1'
    );

    if (servers.length === 0) {
      console.log('❌ No servers found');
      return;
    }

    const server = servers[0];
    console.log(`📡 Testing server: ${server.nickname} (${server.ip}:${server.port})`);

    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    ws.on('open', () => {
      console.log(`   ✅ Connected to ${server.nickname}`);
      
      // Step 1: Get zones from game
      console.log(`\n📤 Step 1: Getting zones from game...`);
      const zonesCommand = JSON.stringify({ Identifier: 1, Message: 'zones.listcustomzones', Name: 'WebRcon' });
      ws.send(zonesCommand);
    });
    
    ws.on('message', async (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.Identifier === 1 && parsed.Message) {
          console.log(`   📥 Received zones from game:`);
          const zones = parsed.Message.split('\n').filter(line => line.trim());
          
          // Extract ZORP zones
          const zorpZones = zones.filter(zone => zone.includes('ZORP_'));
          console.log(`   🎯 Found ${zorpZones.length} ZORP zones in game:`);
          zorpZones.forEach(zone => {
            console.log(`      - ${zone}`);
          });
          
          // Step 2: Check database
          console.log(`\n📊 Step 2: Checking database...`);
          const [dbZones] = await pool.query(
            'SELECT name, owner FROM zorp_zones WHERE server_id = ?',
            [server.id]
          );
          
          console.log(`   📋 Found ${dbZones.length} zones in database:`);
          dbZones.forEach(zone => {
            console.log(`      - ${zone.name} (${zone.owner})`);
          });
          
          // Step 3: Test deletion of first zone
          if (zorpZones.length > 0) {
            const firstZone = zorpZones[0];
            const zoneName = firstZone.match(/Name \[([^\]]+)\]/)?.[1];
            
            if (zoneName) {
              console.log(`\n🗑️ Step 3: Testing deletion of zone: ${zoneName}`);
              
              // Check if zone exists in database
              const [zoneInDb] = await pool.query(
                'SELECT id FROM zorp_zones WHERE name = ? AND server_id = ?',
                [zoneName, server.id]
              );
              
              if (zoneInDb.length > 0) {
                console.log(`   ✅ Zone found in database`);
              } else {
                console.log(`   ❌ Zone NOT found in database - this is the problem!`);
              }
              
              // Try to delete from game
              console.log(`   📤 Sending delete command to game...`);
              const deleteCommand = JSON.stringify({ 
                Identifier: 2, 
                Message: `zones.deletecustomzone "${zoneName}"`, 
                Name: 'WebRcon' 
              });
              ws.send(deleteCommand);
              
              // Wait a moment then check if it was deleted
              setTimeout(async () => {
                console.log(`\n🔍 Step 4: Checking if zone was deleted...`);
                
                // Check game again
                const checkCommand = JSON.stringify({ 
                  Identifier: 3, 
                  Message: 'zones.listcustomzones', 
                  Name: 'WebRcon' 
                });
                ws.send(checkCommand);
                
                // Check database
                const [remainingZones] = await pool.query(
                  'SELECT name FROM zorp_zones WHERE name = ? AND server_id = ?',
                  [zoneName, server.id]
                );
                
                if (remainingZones.length === 0) {
                  console.log(`   ✅ Zone deleted from database`);
                } else {
                  console.log(`   ❌ Zone still in database`);
                }
                
                ws.close();
              }, 3000);
            }
          } else {
            console.log(`   ❌ No ZORP zones found in game`);
            ws.close();
          }
        } else if (parsed.Identifier === 2) {
          console.log(`   📥 Delete command response:`, parsed.Message);
        } else if (parsed.Identifier === 3) {
          console.log(`   📥 Final zones check:`, parsed.Message);
        }
      } catch (err) {
        console.log(`   ❌ Error processing message:`, err.message);
        ws.close();
      }
    });
    
    ws.on('error', (error) => {
      console.error(`   ❌ WebSocket error:`, error.message);
    });
    
    ws.on('close', () => {
      console.log(`   🔌 Connection closed`);
    });

    // Keep the process alive for 10 seconds to allow async operations to complete
    setTimeout(() => {
      console.log('\n⏰ Test completed');
    }, 10000);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Don't close the pool here - let it stay open
    setTimeout(() => {
      pool.end();
    }, 5000);
  }
}

testZorpDeletionDebug(); 