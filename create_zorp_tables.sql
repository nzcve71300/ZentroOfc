-- Create ZORP database tables
-- This script creates the necessary tables for ZORP list management

-- ZORP Allowed Users Table
CREATE TABLE IF NOT EXISTS zorp_allowed_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(255) NOT NULL,
    discord_id VARCHAR(255),
    ign VARCHAR(255),
    added_by VARCHAR(255) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_zorp_allowed (server_id, discord_id, ign),
    INDEX idx_zorp_allowed_server (server_id),
    INDEX idx_zorp_allowed_discord (discord_id),
    INDEX idx_zorp_allowed_ign (ign)
);

-- ZORP Banned Users Table
CREATE TABLE IF NOT EXISTS zorp_banned_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(255) NOT NULL,
    discord_id VARCHAR(255),
    ign VARCHAR(255),
    banned_by VARCHAR(255) NOT NULL,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_zorp_banned (server_id, discord_id, ign),
    INDEX idx_zorp_banned_server (server_id),
    INDEX idx_zorp_banned_discord (discord_id),
    INDEX idx_zorp_banned_ign (ign)
);

-- ZORP Configurations Table
CREATE TABLE IF NOT EXISTS zorp_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(255) NOT NULL UNIQUE,
    use_list BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_zorp_config_server (server_id)
);

-- Insert default configurations for existing servers
INSERT IGNORE INTO zorp_configs (server_id, use_list)
SELECT id, FALSE FROM rust_servers;

-- Display table creation results
SELECT 'ZORP Tables Created Successfully!' as status;
SELECT COUNT(*) as zorp_allowed_users_count FROM zorp_allowed_users;
SELECT COUNT(*) as zorp_banned_users_count FROM zorp_banned_users;
SELECT COUNT(*) as zorp_configs_count FROM zorp_configs;
