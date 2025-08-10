-- Home Teleport System Database Tables

-- Table for home teleport configuration per server
CREATE TABLE IF NOT EXISTS home_teleport_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    whitelist_enabled BOOLEAN DEFAULT FALSE,
    cooldown_minutes INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_config (server_id)
);

-- Table for storing player home locations
CREATE TABLE IF NOT EXISTS player_homes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id INT NOT NULL,
    server_id VARCHAR(32) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    discord_id VARCHAR(32) NULL,
    x_pos DECIMAL(10,2) NOT NULL,
    y_pos DECIMAL(10,2) NOT NULL,
    z_pos DECIMAL(10,2) NOT NULL,
    set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_player_home (guild_id, server_id, player_name)
);

-- Table for whitelist management
CREATE TABLE IF NOT EXISTS player_whitelists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id INT NOT NULL,
    server_id VARCHAR(32) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    discord_id VARCHAR(32) NULL,
    whitelist_type ENUM('home_teleport', 'zorp') NOT NULL,
    added_by VARCHAR(32) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_player_whitelist (guild_id, server_id, player_name, whitelist_type)
);

-- Create indexes for better performance
CREATE INDEX idx_home_teleport_configs_server ON home_teleport_configs(server_id);
CREATE INDEX idx_player_homes_guild_server ON player_homes(guild_id, server_id);
CREATE INDEX idx_player_homes_player ON player_homes(player_name);
CREATE INDEX idx_player_whitelists_guild_server ON player_whitelists(guild_id, server_id);
CREATE INDEX idx_player_whitelists_player ON player_whitelists(player_name);
CREATE INDEX idx_player_whitelists_type ON player_whitelists(whitelist_type); 