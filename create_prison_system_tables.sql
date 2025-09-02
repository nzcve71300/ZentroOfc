-- Prison System Database Tables for Zentro Bot

-- Table for prison system configuration per server
CREATE TABLE IF NOT EXISTS prison_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_config (server_id)
);

-- Table for prison cell positions
CREATE TABLE IF NOT EXISTS prison_positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    cell_number INT NOT NULL,
    x_pos DECIMAL(10,2) NOT NULL,
    y_pos DECIMAL(10,2) NOT NULL,
    z_pos DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_cell (server_id, cell_number)
);

-- Table for active prisoners
CREATE TABLE IF NOT EXISTS prisoners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    discord_id VARCHAR(32) NULL,
    cell_number INT NOT NULL,
    sentence_type ENUM('temporary', 'life') NOT NULL,
    sentence_minutes INT NULL, -- NULL for life sentences
    release_time TIMESTAMP NULL, -- NULL for life sentences
    sentenced_by VARCHAR(255) NOT NULL,
    sentenced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_active_prisoner (server_id, player_name, is_active)
);

-- Create indexes for better performance
CREATE INDEX idx_prison_configs_server ON prison_configs(server_id);
CREATE INDEX idx_prison_positions_server ON prison_positions(server_id);
CREATE INDEX idx_prison_positions_cell ON prison_positions(cell_number);
CREATE INDEX idx_prisoners_server ON prisoners(server_id);
CREATE INDEX idx_prisoners_player ON prisoners(player_name);
CREATE INDEX idx_prisoners_active ON prisoners(is_active);
CREATE INDEX idx_prisoners_release_time ON prisoners(release_time);
