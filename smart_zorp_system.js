const mysql = require('mysql2/promise');
require('dotenv').config();

class SmartZorpSystem {
  constructor() {
    this.isRunning = false;
    this.monitoringInterval = null;
    this.connection = null;
    this.lastHealthCheck = new Date();
    this.zoneFixHistory = new Map();
  }

  async initialize() {
    try {
      console.log('🧠 Initializing Smart ZORP System...');
      
      // Test database connection
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });

      console.log('✅ Database connection established');
      
      // Verify required tables exist
      await this.verifyTables();
      
      // Get initial system status
      await this.getSystemStatus();
      
      console.log('🎉 Smart ZORP System initialized successfully!');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Smart ZORP System:', error);
      return false;
    }
  }

  async verifyTables() {
    console.log('🔍 Verifying required tables...');
    
    const requiredTables = [
      'zorp_zones',
      'zorp_player_status', 
      'zorp_zone_health',
      'zorp_zone_events',
      'rust_servers'
    ];

    for (const table of requiredTables) {
      try {
        const [result] = await this.connection.execute(`SHOW TABLES LIKE '${table}'`);
        if (result.length === 0) {
          throw new Error(`Required table '${table}' not found!`);
        }
        console.log(`   ✅ ${table} table verified`);
      } catch (error) {
        throw new Error(`Table verification failed for ${table}: ${error.message}`);
      }
    }
    
    console.log('✅ All required tables verified');
  }

  async getSystemStatus() {
    try {
      console.log('📊 Getting initial system status...');
      
      // Count total servers
      const [servers] = await this.connection.execute('SELECT COUNT(*) as count FROM rust_servers');
      const totalServers = servers[0].count;
      
      // Count total zones
      const [zones] = await this.connection.execute(`
        SELECT COUNT(*) as count 
        FROM zorp_zones 
        WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
      `);
      const totalZones = zones[0].count;
      
      // Count zones by health score
      const [healthStats] = await this.connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN health_score = 100 THEN 1 ELSE 0 END) as perfect,
          SUM(CASE WHEN health_score < 100 THEN 1 ELSE 0 END) as problematic,
          AVG(health_score) as avg_score
        FROM zorp_zone_health
      `);
      
      const stats = healthStats[0];
      const healthPercentage = Math.round((stats.perfect / stats.total) * 100);
      
      console.log('📈 **System Status Summary:**');
      console.log(`   Total Servers: ${totalServers}`);
      console.log(`   Total Active Zones: ${totalZones}`);
      console.log(`   Perfect Zones: ${stats.perfect} (${healthPercentage}%)`);
      console.log(`   Problematic Zones: ${stats.problematic}`);
      console.log(`   Average Health Score: ${Math.round(stats.avg_score)}/100`);
      
      return {
        servers: totalServers,
        zones: totalZones,
        perfect: stats.perfect,
        problematic: stats.problematic,
        healthPercentage: healthPercentage
      };
      
    } catch (error) {
      console.error('❌ Failed to get system status:', error);
      return null;
    }
  }

  async startMonitoring() {
    if (this.isRunning) {
      console.log('⚠️  Monitoring is already running');
      return;
    }

    try {
      console.log('🚀 Starting Smart ZORP Monitoring...');
      
      this.isRunning = true;
      
      // Start continuous monitoring
      this.monitoringInterval = setInterval(async () => {
        await this.performHealthCheck();
      }, 30000); // Check every 30 seconds
      
      console.log('✅ Smart ZORP monitoring started (30-second intervals)');
      
      // Perform immediate health check
      await this.performHealthCheck();
      
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error);
      this.isRunning = false;
    }
  }

  async stopMonitoring() {
    if (!this.isRunning) {
      console.log('⚠️  Monitoring is not running');
      return;
    }

    try {
      console.log('🛑 Stopping Smart ZORP Monitoring...');
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      
      this.isRunning = false;
      console.log('✅ Smart ZORP monitoring stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop monitoring:', error);
    }
  }

  async performHealthCheck() {
    try {
      const startTime = Date.now();
      console.log(`\n🔍 Performing health check at ${new Date().toISOString()}`);
      
      // Get all problematic zones
      const problematicZones = await this.getProblematicZones();
      
      if (problematicZones.length === 0) {
        console.log('✅ All zones are healthy - no fixes needed');
        this.lastHealthCheck = new Date();
        return;
      }
      
      console.log(`⚠️  Found ${problematicZones.length} zones needing attention`);
      
      // Fix each problematic zone
      let fixedCount = 0;
      let errorCount = 0;
      
      for (const zone of problematicZones) {
        try {
          const fixed = await this.fixZone(zone);
          if (fixed) {
            fixedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to fix zone ${zone.zone_name}:`, error.message);
          errorCount++;
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`📊 Health check completed in ${duration}ms:`);
      console.log(`   Zones fixed: ${fixedCount}`);
      console.log(`   Errors: ${errorCount}`);
      console.log(`   Total processed: ${problematicZones.length}`);
      
      this.lastHealthCheck = new Date();
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  async getProblematicZones() {
    try {
      const [zones] = await this.connection.execute(`
        SELECT 
          zh.zone_name,
          zh.expected_state,
          zh.actual_state,
          zh.health_score,
          zh.issues,
          zh.server_id,
          rs.nickname as server_name,
          rs.ip,
          rs.port,
          rs.password,
          z.owner,
          z.color_online,
          z.color_offline
        FROM zorp_zone_health zh
        JOIN rust_servers rs ON zh.server_id = rs.id
        JOIN zorp_zones z ON zh.zone_name = z.name
        WHERE zh.health_score < 100
        AND zh.last_check < DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        ORDER BY zh.health_score ASC, zh.last_check ASC
        LIMIT 10
      `);
      
      return zones;
      
    } catch (error) {
      console.error('❌ Failed to get problematic zones:', error);
      return [];
    }
  }

  async fixZone(zone) {
    try {
      console.log(`🔧 Fixing zone: ${zone.zone_name} (${zone.server_name})`);
      console.log(`   Expected: ${zone.expected_state} | Actual: ${zone.actual_state}`);
      
      // Check if zone is already being processed
      const zoneKey = `${zone.zone_name}_${zone.server_id}`;
      if (this.zoneFixHistory.has(zoneKey)) {
        const lastFix = this.zoneFixHistory.get(zoneKey);
        const timeSinceLastFix = Date.now() - lastFix;
        
        // Don't fix the same zone more than once per minute
        if (timeSinceLastFix < 60000) {
          console.log(`   ⏳ Zone recently fixed (${Math.round(timeSinceLastFix/1000)}s ago) - skipping`);
          return false;
        }
      }
      
      // Import RCON function
      const { sendRconCommand } = require('./src/rcon/index.js');
      
      // Apply the fix via RCON
      let rconSuccess = false;
      
      try {
        if (zone.expected_state === 'green') {
          // Set zone to green
          console.log(`   📡 Setting zone to green...`);
          
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" allowbuilding 1`);
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" allowbuildingdamage 1`);
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" allowpvpdamage 1`);
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" color (${zone.color_online || '0,255,0'})`);
          
          rconSuccess = true;
          
        } else if (zone.expected_state === 'red') {
          // Set zone to red
          console.log(`   📡 Setting zone to red...`);
          
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" allowbuilding 1`);
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" allowbuildingdamage 0`);
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" allowpvpdamage 1`);
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" color (${zone.color_offline || '255,0,0'})`);
          
          rconSuccess = true;
          
        } else if (zone.expected_state === 'yellow') {
          // Set zone to yellow
          console.log(`   📡 Setting zone to yellow...`);
          
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" allowbuilding 1`);
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" allowbuildingdamage 1`);
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" allowpvpdamage 1`);
          await sendRconCommand(zone.ip, zone.port, zone.password, `zones.editcustomzone "${zone.zone_name}" color (255,255,0)`);
          
          rconSuccess = true;
        }
        
      } catch (rconError) {
        console.error(`   ❌ RCON command failed: ${rconError.message}`);
        rconSuccess = false;
      }
      
      if (rconSuccess) {
        // Update zone state in database
        await this.connection.execute(`
          UPDATE zorp_zones 
          SET current_state = ? 
          WHERE name = ?
        `, [zone.expected_state, zone.zone_name]);
        
        // Update health table
        await this.connection.execute(`
          UPDATE zorp_zone_health 
          SET 
            actual_state = ?,
            health_score = 100,
            issues = '[]',
            last_check = NOW()
          WHERE zone_name = ?
        `, [zone.expected_state, zone.zone_name]);
        
        // Record the fix
        this.zoneFixHistory.set(zoneKey, Date.now());
        
        // Log the event
        await this.connection.execute(`
          INSERT INTO zorp_zone_events (zone_name, event_type, player_name, server_id, details)
          VALUES (?, ?, ?, ?, ?)
        `, [
          zone.zone_name,
          `zone_${zone.expected_state}`,
          zone.owner,
          zone.server_id,
          JSON.stringify({
            previous_state: zone.actual_state,
            new_state: zone.expected_state,
            reason: 'smart_zorp_auto_fix',
            health_score_before: zone.health_score,
            health_score_after: 100
          })
        ]);
        
        console.log(`   ✅ Zone fixed successfully: ${zone.actual_state} → ${zone.expected_state}`);
        return true;
        
      } else {
        console.log(`   ❌ Failed to fix zone via RCON`);
        return false;
      }
      
    } catch (error) {
      console.error(`   ❌ Zone fix failed: ${error.message}`);
      return false;
    }
  }

  async getDetailedStatus() {
    try {
      console.log('\n📊 **Smart ZORP System Status Report**');
      console.log('========================================');
      
      const systemStatus = await this.getSystemStatus();
      
      if (systemStatus) {
        console.log(`   Monitoring Active: ${this.isRunning ? '✅ YES' : '❌ NO'}`);
        console.log(`   Last Health Check: ${this.lastHealthCheck.toISOString()}`);
        console.log(`   Zone Fix History: ${this.zoneFixHistory.size} recent fixes`);
        
        if (systemStatus.healthPercentage >= 90) {
          console.log('\n🎉 **System Status: EXCELLENT**');
        } else if (systemStatus.healthPercentage >= 70) {
          console.log('\n✅ **System Status: GOOD**');
        } else if (systemStatus.healthPercentage >= 50) {
          console.log('\n⚠️  **System Status: FAIR**');
        } else {
          console.log('\n❌ **System Status: POOR**');
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to get detailed status:', error);
    }
  }

  async cleanup() {
    try {
      console.log('🧹 Cleaning up Smart ZORP System...');
      
      await this.stopMonitoring();
      
      if (this.connection) {
        await this.connection.end();
        this.connection = null;
      }
      
      console.log('✅ Smart ZORP System cleaned up');
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

// Export the class
module.exports = SmartZorpSystem;

// If run directly, start the system
if (require.main === module) {
  const smartZorp = new SmartZorpSystem();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Smart ZORP System...');
    await smartZorp.cleanup();
    process.exit(0);
  });
  
  // Start the system
  smartZorp.initialize().then(async (success) => {
    if (success) {
      await smartZorp.startMonitoring();
      
      // Keep the process running
      console.log('\n🔄 Smart ZORP System is running... Press Ctrl+C to stop');
    } else {
      console.log('❌ Failed to initialize - exiting');
      process.exit(1);
    }
  });
}
