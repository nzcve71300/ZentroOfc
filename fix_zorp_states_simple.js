#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixZorpStatesSimple() {
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
        
        // For now, let's be conservative and set all zones to RED state
        // This prevents them from being deleted and allows the bot to properly manage them
        let correctState = 'red';
        let needsUpdate = false;
        
        if (zone.current_state !== 'red') {
          needsUpdate = true;
          console.log(`   ✅ Setting to RED state (safe default)`);
        } else {
          console.log(`   ✅ Already RED (correct)`);
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

    console.log(`\n💡 **Next Steps:**`);
    console.log(`   1. The bot will now properly manage these zones based on player online status`);
    console.log(`   2. When players come online, zones will transition from RED → GREEN`);
    console.log(`   3. When players go offline, zones will transition from GREEN → YELLOW → RED`);
    console.log(`   4. The state locking system prevents race conditions during transitions`);

  } catch (error) {
    console.error('❌ Error fixing Zorp states:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixZorpStatesSimple();
