-- Teleport System Database Schema

-- Main teleport configurations table
CREATE TABLE IF NOT EXISTS teleport_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    teleport_name VARCHAR(100) NOT NULL,
    position_x DECIMAL(10,2) NOT NULL,
    position_y DECIMAL(10,2) NOT NULL,
    position_z DECIMAL(10,2) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    cooldown_minutes INT DEFAULT 60,
    delay_minutes INT DEFAULT 0,
    display_name VARCHAR(100) DEFAULT 'Teleport',
    use_list BOOLEAN DEFAULT false,
    use_delay BOOLEAN DEFAULT false,
    use_kit BOOLEAN DEFAULT false,
    kit_name VARCHAR(100) DEFAULT NULL,
    kill_before_teleport BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_teleport_server (server_id, teleport_name)
);

-- Teleport allowed users list
CREATE TABLE IF NOT EXISTS teleport_allowed_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    teleport_name VARCHAR(100) NOT NULL,
    discord_id VARCHAR(32) DEFAULT NULL,
    ign VARCHAR(100) DEFAULT NULL,
    added_by VARCHAR(20) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_allowed_user (server_id, teleport_name, discord_id, ign)
);

-- Teleport banned users list
CREATE TABLE IF NOT EXISTS teleport_banned_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    teleport_name VARCHAR(100) NOT NULL,
    discord_id VARCHAR(32) DEFAULT NULL,
    ign VARCHAR(100) DEFAULT NULL,
    banned_by VARCHAR(20) NOT NULL,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_banned_user (server_id, teleport_name, discord_id, ign)
);

-- Teleport usage tracking
CREATE TABLE IF NOT EXISTS teleport_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    teleport_name VARCHAR(100) NOT NULL,
    discord_id VARCHAR(32) DEFAULT NULL,
    ign VARCHAR(100) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_teleport_configs_server ON teleport_configs(server_id);
CREATE INDEX idx_teleport_allowed_server ON teleport_allowed_users(server_id, teleport_name);
CREATE INDEX idx_teleport_banned_server ON teleport_banned_users(server_id, teleport_name);
CREATE INDEX idx_teleport_usage_server ON teleport_usage(server_id, teleport_name, discord_id);
