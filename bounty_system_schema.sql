-- Bounty System Database Schema
-- This file contains the database tables needed for the bounty system

-- Bounty configuration table
CREATE TABLE bounty_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    reward_amount INT DEFAULT 100,
    kills_required INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_bounty (server_id),
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Bounty tracking table
CREATE TABLE bounty_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    server_id VARCHAR(32) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    player_id INT,
    kill_streak INT DEFAULT 0,
    is_active_bounty BOOLEAN DEFAULT FALSE,
    bounty_created_at TIMESTAMP NULL,
    bounty_claimed_at TIMESTAMP NULL,
    claimed_by VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_server_player (server_id, player_name),
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
);

-- Index for performance
CREATE INDEX idx_bounty_tracking_server_active ON bounty_tracking(server_id, is_active_bounty);
CREATE INDEX idx_bounty_tracking_player_name ON bounty_tracking(player_name);
