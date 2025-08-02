-- Create shop_cooldowns table for tracking item purchase timers
CREATE TABLE IF NOT EXISTS shop_cooldowns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  item_type ENUM('item', 'kit') NOT NULL,
  item_id INT NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_player_item (player_id, item_type, item_id),
  INDEX idx_purchased_at (purchased_at)
); 