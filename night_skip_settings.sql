-- Create night_skip_settings table for storing night skip voting configuration
CREATE TABLE IF NOT EXISTS night_skip_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(255) NOT NULL,
  minimum_voters INT DEFAULT 5,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_server (server_id)
);

-- Add index for better performance
CREATE INDEX idx_night_skip_server_id ON night_skip_settings(server_id); 