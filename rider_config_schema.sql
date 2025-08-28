-- Book-a-Ride configuration table
CREATE TABLE IF NOT EXISTS rider_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(255) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  cooldown INT NOT NULL DEFAULT 300,
  horse_enabled TINYINT(1) NOT NULL DEFAULT 1,
  rhib_enabled TINYINT(1) NOT NULL DEFAULT 1,
  mini_enabled TINYINT(1) NOT NULL DEFAULT 0,
  car_enabled TINYINT(1) NOT NULL DEFAULT 0,
  fuel_amount INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_server_rider (server_id),
  FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);

-- Book-a-Ride cooldown tracking table
CREATE TABLE IF NOT EXISTS rider_cooldowns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  vehicle_type ENUM('horse', 'rhib', 'mini', 'car') NOT NULL,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_server_player_vehicle (server_id, player_name, vehicle_type),
  FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
);