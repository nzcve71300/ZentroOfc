#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixZorpStatesWithLocks() {
  let connection;
  
  try {
    // Use the same database configuration as the bot
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'zentro_bot',
      port: process.env.DB_PORT || 3306
    });

    console.log('🔧 Fixing Zorp zone states with state locking...\n');

    // Get all active Zorp zones
    const [zones] = await connection.execute(`
      SELECT 
        z.*,
        rs.ip, rs.port, rs.password, rs.nickname as server_name,
        g.discord_id as guild_id
      FROM zorp_zones z
      LEFT JOIN rust_servers rs ON z.server_id = rs.id
      LEFT JOIN guilds g ON rs.guild_id = g.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.owner, z.created_at DESC
    `);

    if (zones.length === 0) {
      console.log('❌ No active Zorp zones found');
      return;
    }

    console.log(`📊 Found ${zones.length} active Zorp zones to fix\n`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const zone of zones) {
      try {
        console.log(`🔍 Processing zone: ${zone.name} (${zone.owner}) on ${zone.server_name}`);
        console.log(`   Current state: ${zone.current_state}`);
        
        // Check if zone is locked
        const [lockResult] = await connection.execute(
          'SELECT * FROM zorp_state_locks WHERE zone_name = ? AND expires_at > NOW()',
          [zone.name]
        );
        
        if (lockResult.length > 0) {
          console.log(`   ⏳ Zone is locked until ${lockResult[0].expires_at} - skipping`);
          continue;
        }
        
        // Lock the zone for 5 minutes to prevent race conditions
        await connection.execute(
          'INSERT INTO zorp_state_locks (zone_name, locked_by, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
          [zone.name, 'state_fix_script']
        );
        
        console.log(`   🔒 Zone locked for state fixing`);
        
        // Check if player is currently online
        const isPlayerOnline = await checkPlayerOnline(zone.ip, zone.port, zone.password, zone.owner);
        
        console.log(`   👤 Player ${zone.owner} is ${isPlayerOnline ? 'ONLINE' : 'OFFLINE'}`);
        
        let correctState = zone.current_state;
        let needsUpdate = false;
        
        if (isPlayerOnline) {
          // Player is online - zone should be GREEN
          if (zone.current_state !== 'green') {
            correctState = 'green';
            needsUpdate = true;
            console.log(`   ✅ Should be GREEN (player online)`);
          } else {
            console.log(`   ✅ Already GREEN (correct)`);
          }
        } else {
          // Player is offline - zone should be RED (not yellow, since delay has passed)
          if (zone.current_state !== 'red') {
            correctState = 'red';
            needsUpdate = true;
            console.log(`   ✅ Should be RED (player offline)`);
          } else {
            console.log(`   ✅ Already RED (correct)`);
          }
        }
        
        if (needsUpdate) {
          // Update the zone state in database
          await connection.execute(
            'UPDATE zorp_zones SET current_state = ? WHERE id = ?',
            [correctState, zone.id]
          );
          
          console.log(`   🔄 Updated state from ${zone.current_state} to ${correctState}`);
          fixedCount++;
        } else {
          console.log(`   ✅ State is already correct`);
        }
        
        // Unlock the zone
        await connection.execute(
          'DELETE FROM zorp_state_locks WHERE zone_name = ?',
          [zone.name]
        );
        
        console.log(`   🔓 Zone unlocked\n`);
        
      } catch (error) {
        console.error(`❌ Error processing zone ${zone.name}:`, error.message);
        errorCount++;
        
        // Try to unlock the zone even if there was an error
        try {
          await connection.execute(
            'DELETE FROM zorp_state_locks WHERE zone_name = ?',
            [zone.name]
          );
        } catch (unlockError) {
          console.error(`❌ Failed to unlock zone ${zone.name}:`, unlockError.message);
        }
      }
    }

    console.log(`\n🎉 State fixing complete!`);
    console.log(`   ✅ Fixed: ${fixedCount} zones`);
    console.log(`   ❌ Errors: ${errorCount} zones`);
    
    // Show final state summary
    const [finalStates] = await connection.execute(`
      SELECT current_state, COUNT(*) as count 
      FROM zorp_zones 
      WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
      GROUP BY current_state
    `);
    
    console.log(`\n📊 Final state summary:`);
    finalStates.forEach(state => {
      const emoji = state.current_state === 'green' ? '🟢' : 
                   state.current_state === 'yellow' ? '🟡' : 
                   state.current_state === 'red' ? '🔴' : 
                   state.current_state === 'white' ? '⚪' : '❌';
      console.log(`   ${emoji} ${state.current_state}: ${state.count} zones`);
    });

  } catch (error) {
    console.error('❌ Error fixing Zorp states:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function checkPlayerOnline(ip, port, password, playerName) {
  try {
    console.log(`   🔍 Checking online status for ${playerName} on ${ip}:${port}`);
    
    // Import the RCON function from the bot
    const { sendRconCommand } = require('./src/rcon/index.js');
    
    // Get list of online players
    const result = await sendRconCommand(ip, port, password, 'players');
    
    if (!result) {
      console.log(`   ⚠️  Could not get player list - assuming offline`);
      return false;
    }
    
    // Parse the player list
    const lines = result.split('\n');
    const players = new Set();
    
    for (const line of lines) {
      if (line.trim() && line.startsWith('"') && line.endsWith('"')) {
        const playerName = line.trim().replace(/^"|"$/g, '');
        if (playerName && !playerName.includes('died') && !playerName.includes('Generic')) {
          players.add(playerName);
        }
      }
    }
    
    const isOnline = players.has(playerName);
    console.log(`   ${isOnline ? '✅' : '❌'} Player ${playerName} is ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    return isOnline;
    
  } catch (error) {
    console.error(`   ❌ Error checking player status: ${error.message}`);
    return false; // Assume offline if we can't check
  }
}

// Run the fix
fixZorpStatesWithLocks();
