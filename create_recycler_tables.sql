-- Create recycler system tables

-- Recycler configurations table
CREATE TABLE IF NOT EXISTS recycler_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  use_list BOOLEAN DEFAULT FALSE,
  cooldown_minutes INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_server (server_id)
);

-- Recycler allowed users table
CREATE TABLE IF NOT EXISTS recycler_allowed_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(255) NOT NULL,
  discord_id VARCHAR(255),
  ign VARCHAR(255),
  added_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_server (server_id, discord_id, ign)
);

-- Recycler cooldowns table (to track player cooldowns)
CREATE TABLE IF NOT EXISTS recycler_cooldowns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_player_server (server_id, player_name)
);

-- Add indexes for better performance
CREATE INDEX idx_recycler_configs_server ON recycler_configs(server_id);
CREATE INDEX idx_recycler_allowed_server ON recycler_allowed_users(server_id);
CREATE INDEX idx_recycler_cooldowns_server ON recycler_cooldowns(server_id);
CREATE INDEX idx_recycler_cooldowns_player ON recycler_cooldowns(player_name);

-- Show the created tables
SHOW TABLES LIKE 'recycler_%';
