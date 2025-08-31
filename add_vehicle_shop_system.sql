-- Add Vehicle Shop System to Zentro Bot
-- This script adds the necessary database structure for vehicle shop functionality

-- Create shop_vehicles table
CREATE TABLE IF NOT EXISTS shop_vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    display_name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    price INT NOT NULL,
    timer INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES shop_categories(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shop_vehicles_category ON shop_vehicles(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_vehicles_short_name ON shop_vehicles(short_name);

-- Create shop_vehicle_cooldowns table for tracking purchase timers
CREATE TABLE IF NOT EXISTS shop_vehicle_cooldowns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_player_vehicle (player_id, vehicle_id),
    INDEX idx_purchased_at (purchased_at),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES shop_vehicles(id) ON DELETE CASCADE
);

-- Success message
SELECT 'Vehicle shop system added successfully!' as status;
