const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function fixMissingSchemas() {
  let connection;
  
  try {
    console.log('🔧 Fixing missing schemas and database issues');
    console.log('===============================================\n');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'zentro_bot',
      password: 'Zandewet@123',
      database: 'zentro_bot',
      port: 3306
    });
    
    console.log('✅ Connected to database\n');
    
    // 1. Create missing tables with active columns
    console.log('1. 📊 Creating missing tables and columns...');
    
    // Create night_skip_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS night_skip_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        active BOOLEAN DEFAULT TRUE,
        vote_threshold INT DEFAULT 3,
        cooldown_minutes INT DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_night_skip (server_id)
      )
    `);
    console.log('✅ Created night_skip_configs table');
    
    // Create event_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS event_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        event_type ENUM('bradley', 'helicopter', 'cargo', 'chinook') NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        active BOOLEAN DEFAULT TRUE,
        notification_channel_id BIGINT UNSIGNED NULL,
        notification_message TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_event (server_id, event_type)
      )
    `);
    console.log('✅ Created event_configs table');
    
    // Create teleport_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS teleport_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        teleport_name VARCHAR(255) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        active BOOLEAN DEFAULT TRUE,
        cooldown_minutes INT DEFAULT 5,
        use_kit BOOLEAN DEFAULT FALSE,
        kit_name VARCHAR(255) NULL,
        use_delay BOOLEAN DEFAULT FALSE,
        delay_minutes INT DEFAULT 0,
        use_list BOOLEAN DEFAULT FALSE,
        display_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_teleport (server_id, teleport_name)
      )
    `);
    console.log('✅ Created teleport_configs table');
    
    // Create home_teleport_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS home_teleport_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        active BOOLEAN DEFAULT TRUE,
        use_list BOOLEAN DEFAULT FALSE,
        cooldown_minutes INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_home_teleport (server_id)
      )
    `);
    console.log('✅ Created home_teleport_configs table');
    
    // Create zorp_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS zorp_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        active BOOLEAN DEFAULT TRUE,
        use_list BOOLEAN DEFAULT FALSE,
        cooldown_minutes INT DEFAULT 30,
        max_zones_per_player INT DEFAULT 1,
        zone_duration_hours INT DEFAULT 32,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_zorp (server_id)
      )
    `);
    console.log('✅ Created zorp_configs table');
    
    // Create recycler_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS recycler_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        active BOOLEAN DEFAULT TRUE,
        use_list BOOLEAN DEFAULT FALSE,
        cooldown_minutes INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_recycler (server_id)
      )
    `);
    console.log('✅ Created recycler_configs table');
    
    // Create prison_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS prison_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        active BOOLEAN DEFAULT TRUE,
        prison_size INT DEFAULT 50,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_prison (server_id)
      )
    `);
    console.log('✅ Created prison_configs table');
    
    // 2. Add active columns to existing tables
    console.log('\n2. 🔧 Adding active columns to existing tables...');
    
    const tablesToUpdate = [
      'night_skip_configs',
      'event_configs', 
      'teleport_configs',
      'home_teleport_configs',
      'zorp_configs',
      'recycler_configs',
      'prison_configs'
    ];
    
    for (const tableName of tablesToUpdate) {
      try {
        await connection.execute(`
          ALTER TABLE ${tableName} ADD COLUMN active BOOLEAN DEFAULT TRUE
        `);
        console.log(`✅ Added active column to ${tableName}`);
      } catch (error) {
        if (error.message.includes('Duplicate column name')) {
          console.log(`⏭️  Active column already exists in ${tableName}`);
        } else {
          console.log(`⚠️  Could not add active column to ${tableName}: ${error.message}`);
        }
      }
    }
    
    // 3. Insert default configurations for existing servers
    console.log('\n3. 📋 Adding default configurations for existing servers...');
    
    const [servers] = await connection.execute('SELECT id FROM rust_servers');
    console.log(`Found ${servers.length} servers to configure`);
    
    for (const server of servers) {
      // Insert default night skip config
      await connection.execute(`
        INSERT IGNORE INTO night_skip_configs (server_id, enabled, active, vote_threshold, cooldown_minutes)
        VALUES (?, TRUE, TRUE, 3, 30)
      `, [server.id]);
      
      // Insert default home teleport config
      await connection.execute(`
        INSERT IGNORE INTO home_teleport_configs (server_id, enabled, active, use_list, cooldown_minutes)
        VALUES (?, TRUE, TRUE, FALSE, 5)
      `, [server.id]);
      
      // Insert default zorp config
      await connection.execute(`
        INSERT IGNORE INTO zorp_configs (server_id, enabled, active, use_list, cooldown_minutes, max_zones_per_player, zone_duration_hours)
        VALUES (?, TRUE, TRUE, FALSE, 30, 1, 32)
      `, [server.id]);
      
      // Insert default recycler config
      await connection.execute(`
        INSERT IGNORE INTO recycler_configs (server_id, enabled, active, use_list, cooldown_minutes)
        VALUES (?, TRUE, TRUE, FALSE, 5)
      `, [server.id]);
      
      // Insert default prison config
      await connection.execute(`
        INSERT IGNORE INTO prison_configs (server_id, enabled, active, prison_size)
        VALUES (?, TRUE, TRUE, 50)
      `, [server.id]);
    }
    
    console.log('✅ Added default configurations for all servers');
    
    // 4. Create subscription tables
    console.log('\n4. 💳 Creating subscription tables...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        subscription_type ENUM('premium', 'vip', 'elite') NOT NULL,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_subscription (guild_id, user_id)
      )
    `);
    console.log('✅ Created subscriptions table');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subscription_features (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subscription_type ENUM('premium', 'vip', 'elite') NOT NULL,
        feature_name VARCHAR(255) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_subscription_feature (subscription_type, feature_name)
      )
    `);
    console.log('✅ Created subscription_features table');
    
    // Insert default subscription features
    const features = [
      ['premium', 'unlimited_teleports'],
      ['premium', 'priority_support'],
      ['vip', 'unlimited_teleports'],
      ['vip', 'priority_support'],
      ['vip', 'custom_kit_access'],
      ['elite', 'unlimited_teleports'],
      ['elite', 'priority_support'],
      ['elite', 'custom_kit_access'],
      ['elite', 'admin_commands'],
      ['elite', 'server_management']
    ];
    
    for (const [type, feature] of features) {
      await connection.execute(`
        INSERT IGNORE INTO subscription_features (subscription_type, feature_name, is_enabled)
        VALUES (?, ?, TRUE)
      `, [type, feature]);
    }
    console.log('✅ Added default subscription features');
    
    console.log('\n🎉 SCHEMA FIX COMPLETE!');
    console.log('   - All missing tables created');
    console.log('   - Active columns added to existing tables');
    console.log('   - Default configurations added for all servers');
    console.log('   - Subscription system tables created');
    console.log('\n💡 The bot should now start without schema errors');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixMissingSchemas();
