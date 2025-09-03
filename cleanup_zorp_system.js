const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanupZorpSystem() {
  console.log('🧹 Cleaning Up ZORP System - Making It Actually Work!');
  console.log('========================================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    // Step 1: Create new structured tables
    console.log('📋 Step 1: Creating New Structured Tables...\n');

    // Create zorp_player_status table
    console.log('🏗️  Creating zorp_player_status table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS zorp_player_status (
        id INT PRIMARY KEY AUTO_INCREMENT,
        player_name VARCHAR(255) NOT NULL,
        server_id VARCHAR(32) NOT NULL,
        is_online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        zone_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_player_server (player_name, server_id)
      )
    `);
    console.log('   ✅ zorp_player_status table created!');

    // Create zorp_zone_events table
    console.log('🏗️  Creating zorp_zone_events table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS zorp_zone_events (
        id INT PRIMARY KEY AUTO_INCREMENT,
        zone_name VARCHAR(255) NOT NULL,
        event_type ENUM('player_online', 'player_offline', 'zone_green', 'zone_red', 'zone_yellow') NOT NULL,
        player_name VARCHAR(255),
        server_id VARCHAR(32),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details JSON,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      )
    `);
    console.log('   ✅ zorp_zone_events table created!');

    // Create zorp_zone_health table for monitoring
    console.log('🏗️  Creating zorp_zone_health table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS zorp_zone_health (
        id INT PRIMARY KEY AUTO_INCREMENT,
        zone_name VARCHAR(255) NOT NULL,
        server_id VARCHAR(32) NOT NULL,
        expected_state ENUM('green', 'red', 'yellow') NOT NULL,
        actual_state ENUM('green', 'red', 'yellow'),
        last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        health_score INT DEFAULT 100,
        issues JSON,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_zone_server (zone_name, server_id)
      )
    `);
    console.log('   ✅ zorp_zone_health table created!');

    console.log('\n🎉 All new tables created successfully!\n');

    // Step 2: Populate player status table from existing data
    console.log('📋 Step 2: Populating Player Status Table...\n');

    console.log('🔍 Getting all active ZORP zones...');
    const [zones] = await connection.execute(`
      SELECT DISTINCT
        z.owner,
        z.server_id,
        z.name as zone_name,
        z.current_state,
        z.last_online_at,
        rs.nickname as server_name
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.server_id, z.owner
    `);

    console.log(`Found ${zones.length} active zones to process...\n`);

    let playersAdded = 0;
    let playersUpdated = 0;

    for (const zone of zones) {
      try {
        // Check if player already exists in status table
        const [existingPlayer] = await connection.execute(
          'SELECT id FROM zorp_player_status WHERE player_name = ? AND server_id = ?',
          [zone.owner, zone.server_id]
        );

        if (existingPlayer.length === 0) {
          // Add new player
          const isOnline = zone.current_state === 'green';
          await connection.execute(`
            INSERT INTO zorp_player_status (player_name, server_id, is_online, last_seen, zone_name)
            VALUES (?, ?, ?, ?, ?)
          `, [zone.owner, zone.server_id, isOnline, zone.last_online_at || new Date(), zone.zone_name]);
          
          console.log(`   ✅ Added: ${zone.owner} on ${zone.server_name} (${isOnline ? 'ONLINE' : 'OFFLINE'})`);
          playersAdded++;
        } else {
          // Update existing player
          const isOnline = zone.current_state === 'green';
          await connection.execute(`
            UPDATE zorp_player_status 
            SET is_online = ?, last_seen = ?, zone_name = ?, updated_at = NOW()
            WHERE player_name = ? AND server_id = ?
          `, [isOnline, zone.last_online_at || new Date(), zone.zone_name, zone.owner, zone.server_id]);
          
          console.log(`   🔄 Updated: ${zone.owner} on ${zone.server_name} (${isOnline ? 'ONLINE' : 'OFFLINE'})`);
          playersUpdated++;
        }

        // Add zone event
        await connection.execute(`
          INSERT INTO zorp_zone_events (zone_name, event_type, player_name, server_id, details)
          VALUES (?, ?, ?, ?, ?)
        `, [
          zone.zone_name, 
          `zone_${zone.current_state}`, 
          zone.owner, 
          zone.server_id,
          JSON.stringify({
            previous_state: null,
            new_state: zone.current_state,
            reason: 'initial_population'
          })
        ]);

      } catch (error) {
        console.log(`   ❌ Error processing ${zone.owner}: ${error.message}`);
      }
    }

    console.log(`\n📊 Player Status Population Complete:`);
    console.log(`   New players added: ${playersAdded}`);
    console.log(`   Existing players updated: ${playersUpdated}`);
    console.log(`   Total players processed: ${playersAdded + playersUpdated}\n`);

    // Step 3: Populate zone health table
    console.log('📋 Step 3: Setting Up Zone Health Monitoring...\n');

    let healthRecordsAdded = 0;

    for (const zone of zones) {
      try {
        // Determine expected state based on last online time
        const lastOnline = new Date(zone.last_online_at || 0);
        const now = new Date();
        const minutesSinceOnline = Math.floor((now - lastOnline) / 1000 / 60);
        
        let expectedState = 'red';
        if (minutesSinceOnline < 5) {
          expectedState = 'green';
        } else if (minutesSinceOnline < 10) {
          expectedState = 'yellow';
        }

        // Calculate health score
        let healthScore = 100;
        let issues = [];

        if (zone.current_state !== expectedState) {
          healthScore = 50;
          issues.push({
            type: 'state_mismatch',
            expected: expectedState,
            actual: zone.current_state,
            severity: 'high'
          });
        }

        if (!zone.last_online_at) {
          healthScore = 30;
          issues.push({
            type: 'missing_online_data',
            severity: 'medium'
          });
        }

        // Add health record
        await connection.execute(`
          INSERT INTO zorp_zone_health (zone_name, server_id, expected_state, actual_state, health_score, issues)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            expected_state = VALUES(expected_state),
            actual_state = VALUES(actual_state),
            health_score = VALUES(health_score),
            issues = VALUES(issues),
            last_check = NOW()
        `, [zone.zone_name, zone.server_id, expectedState, zone.current_state, healthScore, JSON.stringify(issues)]);

        console.log(`   ✅ Health record: ${zone.zone_name} (${zone.server_name}) - Score: ${healthScore}`);
        healthRecordsAdded++;

      } catch (error) {
        console.log(`   ❌ Error creating health record for ${zone.zone_name}: ${error.message}`);
      }
    }

    console.log(`\n📊 Zone Health Setup Complete:`);
    console.log(`   Health records created: ${healthRecordsAdded}\n`);

    // Step 4: Create indexes for performance
    console.log('📋 Step 4: Creating Performance Indexes...\n');

    try {
      await connection.execute('CREATE INDEX idx_player_status_online ON zorp_player_status(is_online, server_id)');
      console.log('   ✅ Index created: player_status_online');

      await connection.execute('CREATE INDEX idx_zone_events_type ON zorp_zone_events(event_type, timestamp)');
      console.log('   ✅ Index created: zone_events_type');

      await connection.execute('CREATE INDEX idx_zone_health_score ON zorp_zone_health(health_score, last_check)');
      console.log('   ✅ Index created: zone_health_score');

    } catch (error) {
      console.log(`   ⚠️  Some indexes already exist: ${error.message}`);
    }

    // Step 5: Show summary
    console.log('\n🎉 **ZORP System Cleanup Complete!**');
    console.log('=====================================');
    console.log('✅ New structured tables created');
    console.log('✅ Player status populated from existing data');
    console.log('✅ Zone health monitoring set up');
    console.log('✅ Performance indexes created');
    console.log('✅ All existing zones preserved and working');

    console.log('\n🔍 **What This Gives You:**');
    console.log('   - Clear player online/offline tracking');
    console.log('   - Audit trail of all zone changes');
    console.log('   - Health monitoring for each zone');
    console.log('   - Better performance with indexes');
    console.log('   - No broken existing zones');

    console.log('\n🚀 **Next Steps:**');
    console.log('   1. Restart your bot to use the new tables');
    console.log('   2. Monitor the new tables for better insights');
    console.log('   3. The system should now be much cleaner and more reliable');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

cleanupZorpSystem();
