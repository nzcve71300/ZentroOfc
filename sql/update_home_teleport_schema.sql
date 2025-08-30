-- Update Home Teleport Schema for New List System

-- Add use_list column to home_teleport_configs table
ALTER TABLE home_teleport_configs 
ADD COLUMN use_list BOOLEAN DEFAULT FALSE AFTER cooldown_minutes;

-- Create home_teleport_allowed_users table
CREATE TABLE IF NOT EXISTS home_teleport_allowed_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    discord_id VARCHAR(32) NULL,
    ign VARCHAR(255) NULL,
    added_by VARCHAR(32) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_home_teleport_allowed (server_id, discord_id, ign)
);

-- Create home_teleport_banned_users table
CREATE TABLE IF NOT EXISTS home_teleport_banned_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    discord_id VARCHAR(32) NULL,
    ign VARCHAR(255) NULL,
    banned_by VARCHAR(32) NOT NULL,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_home_teleport_banned (server_id, discord_id, ign)
);

-- Create indexes for better performance
CREATE INDEX idx_home_teleport_allowed_server ON home_teleport_allowed_users(server_id);
CREATE INDEX idx_home_teleport_allowed_discord ON home_teleport_allowed_users(discord_id);
CREATE INDEX idx_home_teleport_allowed_ign ON home_teleport_allowed_users(ign);
CREATE INDEX idx_home_teleport_banned_server ON home_teleport_banned_users(server_id);
CREATE INDEX idx_home_teleport_banned_discord ON home_teleport_banned_users(discord_id);
CREATE INDEX idx_home_teleport_banned_ign ON home_teleport_banned_users(ign);

-- Remove old whitelist_enabled column (optional - can be done later)
-- ALTER TABLE home_teleport_configs DROP COLUMN whitelist_enabled;
