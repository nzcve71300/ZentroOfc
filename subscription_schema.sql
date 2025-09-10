-- Zentro Bot Subscription Schema
-- This file contains the database schema for subscription-related tables

-- Create subscription table if it doesn't exist
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
    UNIQUE KEY unique_user_subscription (guild_id, user_id),
    INDEX idx_guild_id (guild_id),
    INDEX idx_user_id (user_id),
    INDEX idx_subscription_type (subscription_type),
    INDEX idx_is_active (is_active)
);

-- Create subscription features table
CREATE TABLE IF NOT EXISTS subscription_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_type ENUM('premium', 'vip', 'elite') NOT NULL,
    feature_name VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_subscription_feature (subscription_type, feature_name)
);

-- Insert default subscription features
INSERT IGNORE INTO subscription_features (subscription_type, feature_name, is_enabled) VALUES
('premium', 'unlimited_teleports', TRUE),
('premium', 'priority_support', TRUE),
('vip', 'unlimited_teleports', TRUE),
('vip', 'priority_support', TRUE),
('vip', 'custom_kit_access', TRUE),
('elite', 'unlimited_teleports', TRUE),
('elite', 'priority_support', TRUE),
('elite', 'custom_kit_access', TRUE),
('elite', 'admin_commands', TRUE),
('elite', 'server_management', TRUE);

-- Create subscription logs table
CREATE TABLE IF NOT EXISTS subscription_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    action ENUM('created', 'updated', 'cancelled', 'expired', 'renewed') NOT NULL,
    subscription_type ENUM('premium', 'vip', 'elite') NOT NULL,
    details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_guild_id (guild_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

-- Create subscription payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    subscription_type ENUM('premium', 'vip', 'elite') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    payment_id VARCHAR(255) NULL,
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guild_id (guild_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Add active column to existing tables if they don't have it
-- This fixes the "Unknown column 'active'" error

-- Check if night_skip_configs table exists and add active column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'night_skip_configs' 
     AND COLUMN_NAME = 'active') > 0,
    'SELECT "Column active already exists in night_skip_configs"',
    'ALTER TABLE night_skip_configs ADD COLUMN active BOOLEAN DEFAULT TRUE'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if event_configs table exists and add active column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'event_configs' 
     AND COLUMN_NAME = 'active') > 0,
    'SELECT "Column active already exists in event_configs"',
    'ALTER TABLE event_configs ADD COLUMN active BOOLEAN DEFAULT TRUE'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if teleport_configs table exists and add active column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'teleport_configs' 
     AND COLUMN_NAME = 'active') > 0,
    'SELECT "Column active already exists in teleport_configs"',
    'ALTER TABLE teleport_configs ADD COLUMN active BOOLEAN DEFAULT TRUE'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if home_teleport_configs table exists and add active column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'home_teleport_configs' 
     AND COLUMN_NAME = 'active') > 0,
    'SELECT "Column active already exists in home_teleport_configs"',
    'ALTER TABLE home_teleport_configs ADD COLUMN active BOOLEAN DEFAULT TRUE'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if zorp_configs table exists and add active column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'zorp_configs' 
     AND COLUMN_NAME = 'active') > 0,
    'SELECT "Column active already exists in zorp_configs"',
    'ALTER TABLE zorp_configs ADD COLUMN active BOOLEAN DEFAULT TRUE'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if recycler_configs table exists and add active column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'recycler_configs' 
     AND COLUMN_NAME = 'active') > 0,
    'SELECT "Column active already exists in recycler_configs"',
    'ALTER TABLE recycler_configs ADD COLUMN active BOOLEAN DEFAULT TRUE'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if prison_configs table exists and add active column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'prison_configs' 
     AND COLUMN_NAME = 'active') > 0,
    'SELECT "Column active already exists in prison_configs"',
    'ALTER TABLE prison_configs ADD COLUMN active BOOLEAN DEFAULT TRUE'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create night_skip_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS night_skip_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    vote_threshold INT DEFAULT 3,
    cooldown_minutes INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_night_skip (server_id)
);

-- Create event_configs table if it doesn't exist
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
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_event (server_id, event_type)
);

-- Create teleport_configs table if it doesn't exist
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
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_teleport (server_id, teleport_name)
);

-- Create home_teleport_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS home_teleport_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    use_list BOOLEAN DEFAULT FALSE,
    cooldown_minutes INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_home_teleport (server_id)
);

-- Create zorp_configs table if it doesn't exist
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
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_zorp (server_id)
);

-- Create recycler_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS recycler_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    use_list BOOLEAN DEFAULT FALSE,
    cooldown_minutes INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_recycler (server_id)
);

-- Create prison_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS prison_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    prison_size INT DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_prison (server_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_guild_active ON subscriptions(guild_id, is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON subscriptions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_logs_guild_created ON subscription_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_guild_status ON subscription_payments(guild_id, status);

-- Insert default configurations for existing servers
INSERT IGNORE INTO night_skip_configs (server_id, enabled, active, vote_threshold, cooldown_minutes)
SELECT id, TRUE, TRUE, 3, 30 FROM rust_servers;

INSERT IGNORE INTO home_teleport_configs (server_id, enabled, active, use_list, cooldown_minutes)
SELECT id, TRUE, TRUE, FALSE, 5 FROM rust_servers;

INSERT IGNORE INTO zorp_configs (server_id, enabled, active, use_list, cooldown_minutes, max_zones_per_player, zone_duration_hours)
SELECT id, TRUE, TRUE, FALSE, 30, 1, 32 FROM rust_servers;

INSERT IGNORE INTO recycler_configs (server_id, enabled, active, use_list, cooldown_minutes)
SELECT id, TRUE, TRUE, FALSE, 5 FROM rust_servers;

INSERT IGNORE INTO prison_configs (server_id, enabled, active, prison_size)
SELECT id, TRUE, TRUE, 50 FROM rust_servers;
