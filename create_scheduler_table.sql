-- Create scheduler_messages table for storing message pairs
CREATE TABLE IF NOT EXISTS scheduler_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(255) NOT NULL,
  message1 TEXT NOT NULL,
  message2 TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_server_id (server_id)
); 