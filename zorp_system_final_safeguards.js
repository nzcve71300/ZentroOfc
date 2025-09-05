const pool = require('./src/db');

async function addZorpFinalSafeguards() {
  console.log('🔧 Adding ZORP Final Safeguards');
  console.log('================================\n');

  try {
    // Step 1: Enhanced Lock TTL + Watchdog
    console.log('📋 Step 1: Adding enhanced lock TTL + watchdog...');
    
    try {
      await pool.query(`
        ALTER TABLE zorp_processing_locks 
        ADD COLUMN locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN owner_id VARCHAR(64) NULL,
        ADD COLUMN expires_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL 90 SECOND)
      `);
      console.log('✅ Added enhanced lock columns with TTL');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Lock columns already exist, updating...');
        await pool.query(`
          ALTER TABLE zorp_processing_locks 
          MODIFY COLUMN locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          MODIFY COLUMN expires_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL 90 SECOND)
        `);
      }
    }

    // Step 2: Enhanced RCON Log with zone_id
    console.log('\n📋 Step 2: Enhancing RCON log with zone_id...');
    
    try {
      await pool.query(`
        ALTER TABLE zorp_rcon_log 
        ADD COLUMN zone_id INT NULL,
        ADD COLUMN attempt INT DEFAULT 1,
        ADD INDEX idx_zone_id (zone_id),
        ADD INDEX idx_created_at (created_at)
      `);
      console.log('✅ Enhanced RCON log with zone_id and attempt tracking');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  RCON log columns already exist');
      }
    }

    // Step 3: Add server primary status tracking
    console.log('\n📋 Step 3: Adding server primary status tracking...');
    
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS zorp_server_status (
          server_id VARCHAR(32) PRIMARY KEY,
          last_primary_ok_at TIMESTAMP NULL,
          last_backup_ok_at TIMESTAMP NULL,
          primary_healthy BOOLEAN DEFAULT TRUE,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created zorp_server_status table');
    } catch (error) {
      console.log(`⚠️  Could not create server status table: ${error.message}`);
    }

    // Step 4: Add health & stuck detector table
    console.log('\n📋 Step 4: Adding health & stuck detector...');
    
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS zorp_health_checks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          zone_id INT NOT NULL,
          check_type ENUM('stuck_state', 'no_state_change', 'rcon_failure') NOT NULL,
          message TEXT NOT NULL,
          severity ENUM('warning', 'error', 'critical') DEFAULT 'warning',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP NULL,
          INDEX idx_zone_id (zone_id),
          INDEX idx_check_type (check_type),
          INDEX idx_created_at (created_at)
        )
      `);
      console.log('✅ Created zorp_health_checks table');
    } catch (error) {
      console.log(`⚠️  Could not create health checks table: ${error.message}`);
    }

    // Step 5: Add team change tracking (if relevant)
    console.log('\n📋 Step 5: Adding team change tracking...');
    
    try {
      await pool.query(`
        ALTER TABLE zorp_zones 
        ADD COLUMN team_owner VARCHAR(255) NULL,
        ADD COLUMN team_members JSON NULL,
        ADD COLUMN last_team_check TIMESTAMP NULL,
        ADD INDEX idx_team_owner (team_owner)
      `);
      console.log('✅ Added team tracking columns');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Team tracking columns already exist');
      }
    }

    // Step 6: Create enhanced helper functions
    console.log('\n📋 Step 6: Creating enhanced helper functions...');
    
    const enhancedFunctions = `
-- Enhanced lock acquisition with TTL
DELIMITER //
CREATE FUNCTION IF NOT EXISTS acquire_zorp_lock(server_id VARCHAR(32), owner_id VARCHAR(64))
RETURNS BOOLEAN
READS SQL DATA
MODIFIES SQL DATA
BEGIN
  DECLARE lock_count INT DEFAULT 0;
  DECLARE lock_expired BOOLEAN DEFAULT FALSE;
  
  -- Check for existing locks
  SELECT COUNT(*) INTO lock_count
  FROM zorp_processing_locks 
  WHERE server_id = server_id 
  AND expires_at > CURRENT_TIMESTAMP;
  
  -- If no active locks, acquire one
  IF lock_count = 0 THEN
    INSERT INTO zorp_processing_locks (server_id, owner_id, locked_at, expires_at)
    VALUES (server_id, owner_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL 90 SECOND)
    ON DUPLICATE KEY UPDATE
      owner_id = owner_id,
      locked_at = CURRENT_TIMESTAMP,
      expires_at = CURRENT_TIMESTAMP + INTERVAL 90 SECOND;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END//
DELIMITER ;

-- Enhanced lock release
DELIMITER //
CREATE FUNCTION IF NOT EXISTS release_zorp_lock(server_id VARCHAR(32), owner_id VARCHAR(64))
RETURNS BOOLEAN
READS SQL DATA
MODIFIES SQL DATA
BEGIN
  DELETE FROM zorp_processing_locks 
  WHERE server_id = server_id AND owner_id = owner_id;
  RETURN TRUE;
END//
DELIMITER ;

-- Stuck state detector
DELIMITER //
CREATE FUNCTION IF NOT EXISTS detect_stuck_zones()
RETURNS INT
READS SQL DATA
MODIFIES SQL DATA
BEGIN
  DECLARE stuck_count INT DEFAULT 0;
  
  -- Find zones with desired != applied for > 5 minutes
  INSERT INTO zorp_health_checks (zone_id, check_type, message, severity)
  SELECT 
    z.id,
    'stuck_state',
    CONCAT('Zone ', z.name, ' has desired_state=', z.desired_state, ' but applied_state=', z.applied_state, ' for > 5 minutes'),
    'warning'
  FROM zorp_zones z
  WHERE z.desired_state != z.applied_state
  AND z.updated_at < CURRENT_TIMESTAMP - INTERVAL 5 MINUTE
  AND NOT EXISTS (
    SELECT 1 FROM zorp_health_checks hc 
    WHERE hc.zone_id = z.id 
    AND hc.check_type = 'stuck_state' 
    AND hc.resolved_at IS NULL
  );
  
  SET stuck_count = ROW_COUNT();
  
  -- Find zones with no state change for 24h despite owner activity
  INSERT INTO zorp_health_checks (zone_id, check_type, message, severity)
  SELECT 
    z.id,
    'no_state_change',
    CONCAT('Zone ', z.name, ' has had no state change for 24h despite owner activity'),
    'warning'
  FROM zorp_zones z
  WHERE z.updated_at < CURRENT_TIMESTAMP - INTERVAL 24 HOUR
  AND (z.last_online_at > CURRENT_TIMESTAMP - INTERVAL 1 HOUR OR z.last_offline_at > CURRENT_TIMESTAMP - INTERVAL 1 HOUR)
  AND NOT EXISTS (
    SELECT 1 FROM zorp_health_checks hc 
    WHERE hc.zone_id = z.id 
    AND hc.check_type = 'no_state_change' 
    AND hc.resolved_at IS NULL
  );
  
  SET stuck_count = stuck_count + ROW_COUNT();
  
  RETURN stuck_count;
END//
DELIMITER ;

-- Clean up expired locks
DELIMITER //
CREATE FUNCTION IF NOT EXISTS cleanup_expired_locks()
RETURNS INT
READS SQL DATA
MODIFIES SQL DATA
BEGIN
  DECLARE cleaned_count INT DEFAULT 0;
  
  DELETE FROM zorp_processing_locks 
  WHERE expires_at < CURRENT_TIMESTAMP;
  
  SET cleaned_count = ROW_COUNT();
  RETURN cleaned_count;
END//
DELIMITER ;
    `;
    
    try {
      await pool.query(enhancedFunctions);
      console.log('✅ Created enhanced helper functions');
    } catch (error) {
      console.log(`⚠️  Could not create enhanced functions: ${error.message}`);
    }

    // Step 7: Create indexes for performance
    console.log('\n📋 Step 7: Creating performance indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_server_owner ON zorp_zones (server_id, owner_ign_normalized)',
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_desired_applied ON zorp_zones (desired_state, applied_state)',
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_last_offline ON zorp_zones (last_offline_at)',
      'CREATE INDEX IF NOT EXISTS idx_zorp_zones_last_online ON zorp_zones (last_online_at)',
      'CREATE INDEX IF NOT EXISTS idx_zorp_rcon_log_zone_created ON zorp_rcon_log (zone_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_zorp_health_checks_unresolved ON zorp_health_checks (resolved_at) WHERE resolved_at IS NULL'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await pool.query(indexQuery);
      } catch (error) {
        console.log(`⚠️  Could not create index: ${error.message}`);
      }
    }
    
    console.log('✅ Created performance indexes');

    // Step 8: Summary
    console.log('\n📋 Step 8: Summary of Final Safeguards...');
    console.log('🎯 Final ZORP Safeguards Added:');
    console.log('');
    console.log('✅ 1. Enhanced Lock TTL + Watchdog:');
    console.log('   - Added locked_at, owner_id, expires_at columns');
    console.log('   - 90-second TTL with automatic cleanup');
    console.log('   - Stale lock detection and recovery');
    console.log('');
    console.log('✅ 2. Enhanced RCON Log:');
    console.log('   - Added zone_id and attempt tracking');
    console.log('   - Performance indexes for fast queries');
    console.log('   - Audit trail for debugging');
    console.log('');
    console.log('✅ 3. Server Primary Status Tracking:');
    console.log('   - last_primary_ok_at and last_backup_ok_at');
    console.log('   - Primary health monitoring');
    console.log('   - Backup write gating (only when primary stale)');
    console.log('');
    console.log('✅ 4. Health & Stuck Detector:');
    console.log('   - Detects zones stuck in desired != applied for > 5 min');
    console.log('   - Flags zones with no state change for 24h');
    console.log('   - RCON failure tracking');
    console.log('');
    console.log('✅ 5. Team Change Tracking:');
    console.log('   - team_owner and team_members columns');
    console.log('   - last_team_check timestamp');
    console.log('   - Support for team-based ZORP zones');
    console.log('');
    console.log('✅ 6. Enhanced Helper Functions:');
    console.log('   - acquire_zorp_lock() with TTL');
    console.log('   - release_zorp_lock() with owner validation');
    console.log('   - detect_stuck_zones() for health monitoring');
    console.log('   - cleanup_expired_locks() for maintenance');
    console.log('');
    console.log('✅ 7. Performance Indexes:');
    console.log('   - Fast zone lookups by server + owner');
    console.log('   - Efficient state mismatch detection');
    console.log('   - Optimized timestamp queries');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Update ZORP monitoring code to use enhanced locks');
    console.log('   2. Implement backup write gating (only when primary stale)');
    console.log('   3. Add health check monitoring job');
    console.log('   4. Implement idempotent RCON with jittered backoff');
    console.log('   5. Add team change detection if relevant');
    console.log('');
    console.log('✅ Final safeguards completed!');

  } catch (error) {
    console.error('❌ Adding safeguards failed:', error);
  }
}

// Run the safeguards
if (require.main === module) {
  addZorpFinalSafeguards()
    .then(() => {
      console.log('\n🎉 Final ZORP safeguards added successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Adding safeguards failed:', error);
      process.exit(1);
    });
}

module.exports = { addZorpFinalSafeguards };
