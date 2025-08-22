-- Playtime Rewards System Database Schema
-- Run this script to add playtime tracking and rewards functionality

-- Playtime rewards configuration table
CREATE TABLE IF NOT EXISTS playtime_rewards_config (
    server_id VARCHAR(32) PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    amount_per_30min INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Player playtime tracking table
CREATE TABLE IF NOT EXISTS player_playtime (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    total_minutes INT DEFAULT 0,
    last_online TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_reward TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_start TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_player_playtime (player_id),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX idx_playtime_rewards_enabled ON playtime_rewards_config(enabled);
CREATE INDEX idx_player_playtime_last_reward ON player_playtime(last_reward);
CREATE INDEX idx_player_playtime_session ON player_playtime(session_start);

-- Verify tables were created
SELECT 
    TABLE_NAME,
    TABLE_COMMENT
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('playtime_rewards_config', 'player_playtime')
ORDER BY TABLE_NAME;
