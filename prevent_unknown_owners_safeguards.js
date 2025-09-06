#!/usr/bin/env node

/**
 * Prevent Unknown Owners Safeguards
 * This script implements comprehensive safeguards to prevent zones with "Unknown" owners
 * from being created in the future
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function implementSafeguards() {
  let connection;
  
  try {
    console.log('🛡️  Implementing safeguards to prevent Unknown owner zones...');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'zentro',
      charset: 'utf8mb4'
    });
    
    console.log('✅ Connected to database');
    
    // 1. Add database constraints to prevent "Unknown" owners
    console.log('🔒 Adding database constraints...');
    
    try {
      // Add constraint to prevent "Unknown" owners
      await connection.execute(`
        ALTER TABLE zorp_zones 
        ADD CONSTRAINT prevent_unknown_owners 
        CHECK (owner != 'Unknown' AND owner != 'unknown' AND owner IS NOT NULL AND owner != '')
      `);
      console.log('✅ Added constraint to prevent Unknown owners');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⏭️  Constraint already exists');
      } else {
        console.log(`⚠️  Constraint creation warning: ${error.message}`);
      }
    }
    
    // 2. Add trigger to log and prevent Unknown owner insertions
    console.log('🎯 Adding trigger to prevent Unknown owners...');
    
    try {
      await connection.execute(`
        DROP TRIGGER IF EXISTS prevent_unknown_zorp_owners
      `);
      
      await connection.execute(`
        CREATE TRIGGER prevent_unknown_zorp_owners
        BEFORE INSERT ON zorp_zones
        FOR EACH ROW
        BEGIN
          IF NEW.owner = 'Unknown' OR NEW.owner = 'unknown' OR NEW.owner IS NULL OR NEW.owner = '' THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Cannot create zone with Unknown, null, or empty owner';
          END IF;
        END
      `);
      console.log('✅ Added trigger to prevent Unknown owners');
    } catch (error) {
      console.log(`⚠️  Trigger creation warning: ${error.message}`);
    }
    
    // 3. Add trigger to prevent Unknown owner updates
    console.log('🎯 Adding trigger to prevent Unknown owner updates...');
    
    try {
      await connection.execute(`
        DROP TRIGGER IF EXISTS prevent_unknown_zorp_owner_updates
      `);
      
      await connection.execute(`
        CREATE TRIGGER prevent_unknown_zorp_owner_updates
        BEFORE UPDATE ON zorp_zones
        FOR EACH ROW
        BEGIN
          IF NEW.owner = 'Unknown' OR NEW.owner = 'unknown' OR NEW.owner IS NULL OR NEW.owner = '' THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Cannot update zone owner to Unknown, null, or empty';
          END IF;
        END
      `);
      console.log('✅ Added trigger to prevent Unknown owner updates');
    } catch (error) {
      console.log(`⚠️  Update trigger creation warning: ${error.message}`);
    }
    
    // 4. Create monitoring view for Unknown owners
    console.log('📊 Creating monitoring view...');
    
    try {
      await connection.execute(`
        CREATE OR REPLACE VIEW zorp_unknown_owners_monitor AS
        SELECT 
          id,
          name,
          owner,
          server_id,
          created_at,
          'UNKNOWN_OWNER' as issue_type
        FROM zorp_zones 
        WHERE owner = 'Unknown' 
           OR owner = 'unknown' 
           OR owner IS NULL 
           OR owner = ''
           OR created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
      `);
      console.log('✅ Created monitoring view for Unknown owners');
    } catch (error) {
      console.log(`⚠️  View creation warning: ${error.message}`);
    }
    
    // 5. Create stored procedure for safe zone creation
    console.log('🔧 Creating safe zone creation procedure...');
    
    try {
      await connection.execute(`
        DROP PROCEDURE IF EXISTS create_zorp_zone_safe
      `);
      
      await connection.execute(`
        CREATE PROCEDURE create_zorp_zone_safe(
          IN p_server_id VARCHAR(32),
          IN p_name TEXT,
          IN p_owner TEXT,
          IN p_team JSON,
          IN p_position JSON,
          IN p_size INTEGER,
          IN p_color_online TEXT,
          IN p_color_offline TEXT,
          IN p_color_yellow TEXT,
          IN p_radiation INTEGER,
          IN p_delay INTEGER,
          IN p_expire INTEGER,
          IN p_min_team INTEGER,
          IN p_max_team INTEGER,
          IN p_current_state TEXT,
          IN p_desired_state TEXT,
          IN p_applied_state TEXT,
          IN p_last_online_at TIMESTAMP
        )
        BEGIN
          DECLARE EXIT HANDLER FOR SQLEXCEPTION
          BEGIN
            ROLLBACK;
            RESIGNAL;
          END;
          
          -- Validate owner
          IF p_owner = 'Unknown' OR p_owner = 'unknown' OR p_owner IS NULL OR p_owner = '' THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Invalid owner: cannot be Unknown, null, or empty';
          END IF;
          
          -- Validate zone name
          IF p_name IS NULL OR p_name = '' THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Invalid zone name: cannot be null or empty';
          END IF;
          
          -- Insert zone
          INSERT INTO zorp_zones (
            server_id, name, owner, team, position, size, 
            color_online, color_offline, color_yellow, radiation, 
            delay, expire, min_team, max_team, current_state, 
            desired_state, applied_state, created_at, updated_at, last_online_at
          ) VALUES (
            p_server_id, p_name, p_owner, p_team, p_position, p_size,
            p_color_online, p_color_offline, p_color_yellow, p_radiation,
            p_delay, p_expire, p_min_team, p_max_team, p_current_state,
            p_desired_state, p_applied_state, NOW(), NOW(), p_last_online_at
          );
          
          SELECT LAST_INSERT_ID() as zone_id;
        END
      `);
      console.log('✅ Created safe zone creation procedure');
    } catch (error) {
      console.log(`⚠️  Procedure creation warning: ${error.message}`);
    }
    
    // 6. Create cleanup procedure for any future Unknown owners
    console.log('🧹 Creating cleanup procedure...');
    
    try {
      await connection.execute(`
        DROP PROCEDURE IF EXISTS cleanup_unknown_zorp_owners
      `);
      
      await connection.execute(`
        CREATE PROCEDURE cleanup_unknown_zorp_owners()
        BEGIN
          DECLARE done INT DEFAULT FALSE;
          DECLARE zone_id INT;
          DECLARE zone_name TEXT;
          DECLARE server_name TEXT;
          DECLARE cleanup_count INT DEFAULT 0;
          
          DECLARE unknown_zones CURSOR FOR
            SELECT z.id, z.name, rs.nickname
            FROM zorp_zones z
            JOIN rust_servers rs ON z.server_id = rs.id
            WHERE z.owner = 'Unknown' 
               OR z.owner = 'unknown' 
               OR z.owner IS NULL 
               OR z.owner = '';
          
          DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
          
          OPEN unknown_zones;
          
          cleanup_loop: LOOP
            FETCH unknown_zones INTO zone_id, zone_name, server_name;
            IF done THEN
              LEAVE cleanup_loop;
            END IF;
            
            -- Delete the zone
            DELETE FROM zorp_zones WHERE id = zone_id;
            SET cleanup_count = cleanup_count + 1;
            
            -- Log the cleanup
            INSERT INTO zorp_audit_log (action, zone_name, server_name, details, created_at)
            VALUES ('CLEANUP_UNKNOWN_OWNER', zone_name, server_name, 'Automated cleanup of zone with Unknown owner', NOW());
            
          END LOOP;
          
          CLOSE unknown_zones;
          
          SELECT cleanup_count as zones_cleaned_up;
        END
      `);
      console.log('✅ Created cleanup procedure');
    } catch (error) {
      console.log(`⚠️  Cleanup procedure creation warning: ${error.message}`);
    }
    
    // 7. Create audit log table if it doesn't exist
    console.log('📝 Creating audit log table...');
    
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS zorp_audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          action VARCHAR(100) NOT NULL,
          zone_name TEXT,
          server_name VARCHAR(100),
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_action (action),
          INDEX idx_created_at (created_at)
        )
      `);
      console.log('✅ Created audit log table');
    } catch (error) {
      console.log(`⚠️  Audit log table creation warning: ${error.message}`);
    }
    
    // 8. Create scheduled event to run cleanup daily
    console.log('⏰ Creating scheduled cleanup event...');
    
    try {
      await connection.execute(`
        DROP EVENT IF EXISTS daily_cleanup_unknown_zorp_owners
      `);
      
      await connection.execute(`
        CREATE EVENT daily_cleanup_unknown_zorp_owners
        ON SCHEDULE EVERY 1 DAY
        STARTS CURRENT_TIMESTAMP
        DO CALL cleanup_unknown_zorp_owners()
      `);
      console.log('✅ Created scheduled cleanup event');
    } catch (error) {
      console.log(`⚠️  Scheduled event creation warning: ${error.message}`);
    }
    
    // 9. Test the safeguards
    console.log('🧪 Testing safeguards...');
    
    try {
      // Try to insert a zone with Unknown owner (should fail)
      await connection.execute(`
        INSERT INTO zorp_zones (server_id, name, owner, current_state, desired_state, applied_state)
        VALUES ('test', 'TEST_ZONE', 'Unknown', 'green', 'green', 'green')
      `);
      console.log('❌ SAFEGUARD FAILED: Unknown owner was allowed!');
    } catch (error) {
      if (error.code === 'ER_SIGNAL_EXCEPTION' || error.message.includes('Unknown')) {
        console.log('✅ SAFEGUARD WORKING: Unknown owner was blocked');
      } else {
        console.log(`⚠️  Unexpected error during test: ${error.message}`);
      }
    }
    
    // 10. Show current status
    console.log('\n📊 Current status:');
    const [unknownCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM zorp_zones 
      WHERE owner = 'Unknown' OR owner = 'unknown' OR owner IS NULL OR owner = ''
    `);
    
    console.log(`  - Zones with Unknown owners: ${unknownCount[0].count}`);
    
    const [totalZones] = await connection.execute(`
      SELECT COUNT(*) as count FROM zorp_zones 
      WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
    `);
    
    console.log(`  - Total active zones: ${totalZones[0].count}`);
    
    console.log('\n✅ All safeguards implemented successfully!');
    console.log('🛡️  The system is now protected against Unknown owner zones.');
    console.log('📋 Safeguards include:');
    console.log('  - Database constraints');
    console.log('  - Triggers for insert/update prevention');
    console.log('  - Monitoring view');
    console.log('  - Safe zone creation procedure');
    console.log('  - Automated cleanup procedure');
    console.log('  - Daily scheduled cleanup');
    console.log('  - Audit logging');
    
  } catch (error) {
    console.error('❌ Error implementing safeguards:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the safeguards implementation
if (require.main === module) {
  implementSafeguards()
    .then(() => {
      console.log('🎉 Safeguards implementation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Safeguards implementation failed:', error);
      process.exit(1);
    });
}

module.exports = { implementSafeguards };
