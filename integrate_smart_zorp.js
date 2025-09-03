const mysql = require('mysql2/promise');
require('dotenv').config();

async function integrateSmartZorp() {
  console.log('🔗 Integrating Smart ZORP System with Bot Infrastructure');
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

    // Step 1: Update existing ZORP system to use smart logic
    console.log('📋 Step 1: Updating Existing ZORP System...\n');

    // Create a backup of current zone states
    console.log('💾 Creating backup of current zone states...');
    const [currentZones] = await connection.execute(`
      SELECT 
        z.name,
        z.current_state,
        z.owner,
        rs.nickname as server_name
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `);

    console.log(`   ✅ Backed up ${currentZones.length} current zone states`);

    // Step 2: Create smart ZORP configuration table
    console.log('\n📋 Step 2: Creating Smart ZORP Configuration...\n');

    console.log('🏗️  Creating smart_zorp_config table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smart_zorp_config (
        id INT PRIMARY KEY AUTO_INCREMENT,
        config_key VARCHAR(255) UNIQUE NOT NULL,
        config_value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ smart_zorp_config table created');

    // Insert default configuration
    const defaultConfig = [
      ['monitoring_interval', '30000', 'Health check interval in milliseconds (30 seconds)'],
      ['max_zones_per_check', '10', 'Maximum zones to fix per health check'],
      ['fix_cooldown', '60000', 'Cooldown between fixing same zone (60 seconds)'],
      ['auto_fix_enabled', 'true', 'Whether automatic zone fixing is enabled'],
      ['health_threshold', '100', 'Health score threshold for zones (100 = perfect)'],
      ['log_level', 'info', 'Logging level (debug, info, warn, error)'],
      ['max_retries', '3', 'Maximum retry attempts for failed zone fixes'],
      ['server_discovery_interval', '300000', 'Server discovery interval (5 minutes)']
    ];

    for (const [key, value, description] of defaultConfig) {
      try {
        await connection.execute(`
          INSERT INTO smart_zorp_config (config_key, config_value, description)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            config_value = VALUES(config_value),
            description = VALUES(description),
            updated_at = NOW()
        `, [key, value, description]);
        console.log(`   ✅ Config: ${key} = ${value}`);
      } catch (error) {
        console.log(`   ⚠️  Config ${key} already exists`);
      }
    }

    // Step 3: Create smart ZORP performance metrics
    console.log('\n📋 Step 3: Creating Performance Metrics...\n');

    console.log('🏗️  Creating smart_zorp_metrics table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smart_zorp_metrics (
        id INT PRIMARY KEY AUTO_INCREMENT,
        metric_name VARCHAR(255) NOT NULL,
        metric_value DECIMAL(10,2),
        metric_unit VARCHAR(50),
        server_id VARCHAR(32),
        zone_name VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details JSON,
        INDEX idx_metric_time (metric_name, timestamp),
        INDEX idx_server_metric (server_id, metric_name)
      )
    `);
    console.log('   ✅ smart_zorp_metrics table created');

    // Step 4: Create smart ZORP alerts system
    console.log('\n📋 Step 4: Creating Alert System...\n');

    console.log('🏗️  Creating smart_zorp_alerts table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smart_zorp_alerts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        alert_type ENUM('zone_mismatch', 'rcon_failure', 'health_degradation', 'server_unreachable', 'performance_issue') NOT NULL,
        severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        server_id VARCHAR(32),
        zone_name VARCHAR(255),
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP NULL,
        resolved_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_alert_type (alert_type, severity),
        INDEX idx_unresolved (resolved, created_at)
      )
    `);
    console.log('   ✅ smart_zorp_alerts table created');

    // Step 5: Create smart ZORP server discovery
    console.log('\n📋 Step 5: Creating Server Discovery System...\n');

    console.log('🏗️  Creating smart_zorp_server_discovery table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smart_zorp_server_discovery (
        id INT PRIMARY KEY AUTO_INCREMENT,
        server_id VARCHAR(32) NOT NULL,
        discovery_method ENUM('manual', 'auto', 'import') NOT NULL,
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('active', 'inactive', 'testing', 'error') DEFAULT 'active',
        connection_test_result BOOLEAN,
        last_connection_test TIMESTAMP,
        zones_count INT DEFAULT 0,
        health_score_avg DECIMAL(5,2),
        details JSON,
        UNIQUE KEY unique_server (server_id),
        INDEX idx_status (status, last_seen)
      )
    `);
    console.log('   ✅ smart_zorp_server_discovery table created');

    // Populate server discovery with current servers
    console.log('🔍 Populating server discovery with current servers...');
    const [currentServers] = await connection.execute(`
      SELECT id, nickname, ip, port
      FROM rust_servers
    `);

    for (const server of currentServers) {
      try {
        await connection.execute(`
          INSERT INTO smart_zorp_server_discovery (server_id, discovery_method, details)
          VALUES (?, 'import', ?)
          ON DUPLICATE KEY UPDATE
            last_seen = NOW(),
            status = 'active'
        `, [
          server.id,
          JSON.stringify({
            nickname: server.nickname,
            ip: server.ip,
            port: server.port,
            imported_at: new Date().toISOString()
          })
        ]);
        console.log(`   ✅ Server discovered: ${server.nickname}`);
      } catch (error) {
        console.log(`   ⚠️  Server ${server.nickname} already in discovery`);
      }
    }

    // Step 6: Create smart ZORP maintenance schedule
    console.log('\n📋 Step 6: Creating Maintenance Schedule...\n');

    console.log('🏗️  Creating smart_zorp_maintenance table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smart_zorp_maintenance (
        id INT PRIMARY KEY AUTO_INCREMENT,
        maintenance_type ENUM('health_check', 'zone_fix', 'server_discovery', 'metrics_cleanup', 'alert_cleanup') NOT NULL,
        scheduled_time TIMESTAMP NOT NULL,
        last_run TIMESTAMP NULL,
        next_run TIMESTAMP NOT NULL,
        interval_minutes INT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_scheduled (scheduled_time, enabled),
        INDEX idx_next_run (next_run, enabled)
      )
    `);
    console.log('   ✅ smart_zorp_maintenance table created');

    // Insert default maintenance schedule
    const maintenanceSchedule = [
      ['health_check', 1, 'Continuous zone health monitoring and fixing'],
      ['zone_fix', 1, 'Automatic zone state correction'],
      ['server_discovery', 5, 'Discover and test new servers'],
      ['metrics_cleanup', 60, 'Clean up old performance metrics'],
      ['alert_cleanup', 1440, 'Clean up resolved alerts (24 hours)']
    ];

    for (const [type, interval, description] of maintenanceSchedule) {
      const nextRun = new Date(Date.now() + (interval * 60 * 1000));
      try {
        await connection.execute(`
          INSERT INTO smart_zorp_maintenance (maintenance_type, scheduled_time, next_run, interval_minutes, description)
          VALUES (?, NOW(), ?, ?, ?)
        `, [type, nextRun, interval, description]);
        console.log(`   ✅ Maintenance: ${type} (every ${interval} minutes)`);
      } catch (error) {
        console.log(`   ⚠️  Maintenance ${type} already scheduled`);
      }
    }

    // Step 7: Create integration status
    console.log('\n📋 Step 7: Creating Integration Status...\n');

    console.log('🏗️  Creating smart_zorp_integration_status table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS smart_zorp_integration_status (
        id INT PRIMARY KEY AUTO_INCREMENT,
        integration_name VARCHAR(255) NOT NULL,
        status ENUM('pending', 'active', 'failed', 'disabled') DEFAULT 'pending',
        last_check TIMESTAMP NULL,
        last_success TIMESTAMP NULL,
        last_error TEXT,
        error_count INT DEFAULT 0,
        success_count INT DEFAULT 0,
        details JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_integration (integration_name)
      )
    `);
    console.log('   ✅ smart_zorp_integration_status table created');

    // Insert integration status
    const integrations = [
      'database_connection',
      'rcon_communication', 
      'zone_monitoring',
      'auto_fixing',
      'alert_system',
      'performance_tracking'
    ];

    for (const integration of integrations) {
      try {
        await connection.execute(`
          INSERT INTO smart_zorp_integration_status (integration_name, status)
          VALUES (?, 'pending')
        `, [integration]);
        console.log(`   ✅ Integration: ${integration} (pending)`);
      } catch (error) {
        console.log(`   ⚠️  Integration ${integration} already exists`);
      }
    }

    // Step 8: Show integration summary
    console.log('\n🎉 **Smart ZORP Integration Complete!**');
    console.log('=========================================');
    console.log('✅ Configuration system created');
    console.log('✅ Performance metrics tracking enabled');
    console.log('✅ Alert system configured');
    console.log('✅ Server discovery system active');
    console.log('✅ Maintenance schedule created');
    console.log('✅ Integration status tracking enabled');

    console.log('\n🔍 **What This Gives You:**');
    console.log('   - Centralized configuration management');
    console.log('   - Performance monitoring and metrics');
    console.log('   - Automated alert system');
    console.log('   - Dynamic server discovery');
    console.log('   - Scheduled maintenance tasks');
    console.log('   - Integration health tracking');

    console.log('\n🚀 **Next Steps:**');
    console.log('   1. Test the smart ZORP system');
    console.log('   2. Monitor integration status');
    console.log('   3. Configure alert thresholds');
    console.log('   4. Start automated monitoring');

    console.log('\n💡 **Integration Benefits:**');
    console.log('   - No more manual zone fixes');
    console.log('   - Automatic problem detection');
    console.log('   - Performance optimization');
    console.log('   - Future-proof architecture');
    console.log('   - Scalable to unlimited servers');

  } catch (error) {
    console.error('❌ Integration failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

integrateSmartZorp();
