-- Create kit_cooldowns table for persistent cooldown tracking
CREATE TABLE IF NOT EXISTS kit_cooldowns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(255) NOT NULL,
  kit_name VARCHAR(50) NOT NULL,
  player_name VARCHAR(100) NOT NULL,
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_server_kit_player (server_id, kit_name, player_name),
  INDEX idx_claimed_at (claimed_at)
); 