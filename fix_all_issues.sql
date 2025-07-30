-- Comprehensive fix for all database issues
USE zentro_bot;

-- Step 1: Fix channel ID truncation issue
-- The issue is that the channel_id is being stored as a string and truncated
-- Let's delete and recreate with proper BIGINT values

DELETE FROM channel_settings WHERE server_id = '1753872071391_i24dewly';

INSERT INTO channel_settings (server_id, channel_type, channel_id, created_at, updated_at) VALUES
('1753872071391_i24dewly', 'adminfeed', 1400098668123783268, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1753872071391_i24dewly', 'admin_feed', 1400098668123783268, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1753872071391_i24dewly', 'playercount', 1400098489311953007, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1753872071391_i24dewly', 'playerfeed', 1396872848748052581, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1753872071391_i24dewly', 'notefeed', 1397975202184429618, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1753872071391_i24dewly', 'eventfeed', 1397975202184429618, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1753872071391_i24dewly', 'killfeed', 1397975202184429618, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Step 2: Create missing position_configs table
CREATE TABLE IF NOT EXISTS position_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(32) NOT NULL,
  position_type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  delay_seconds INT DEFAULT 5,
  cooldown_minutes INT DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_server_position (server_id, position_type)
);

-- Step 3: Create missing position_coordinates table if it doesn't exist
CREATE TABLE IF NOT EXISTS position_coordinates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(32) NOT NULL,
  position_type VARCHAR(50) NOT NULL,
  x_pos DECIMAL(10,2) NOT NULL,
  y_pos DECIMAL(10,2) NOT NULL,
  z_pos DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_server_position_coord (server_id, position_type)
);

-- Step 4: Add some default autokit configurations
INSERT INTO autokits (server_id, kit_name, enabled, cooldown, game_name) VALUES
('1753872071391_i24dewly', 'FREEkit1', true, 0, 'FREEkit1'),
('1753872071391_i24dewly', 'FREEkit2', true, 0, 'FREEkit2'),
('1753872071391_i24dewly', 'VIPkit', true, 0, 'VIPkit'),
('1753872071391_i24dewly', 'ELITEkit1', true, 0, 'ELITEkit1'),
('1753872071391_i24dewly', 'ELITEkit2', true, 0, 'ELITEkit2'),
('1753872071391_i24dewly', 'ELITEkit3', true, 0, 'ELITEkit3'),
('1753872071391_i24dewly', 'ELITEkit4', true, 0, 'ELITEkit4'),
('1753872071391_i24dewly', 'ELITEkit5', true, 0, 'ELITEkit5')
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), cooldown = VALUES(cooldown), game_name = VALUES(game_name);

-- Step 5: Add default killfeed configuration
INSERT INTO killfeed_configs (server_id, enabled, format_string) VALUES
('1753872071391_i24dewly', true, '{Killer} killed {Victim} ({VictimKD} K/D)')
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), format_string = VALUES(format_string);

-- Step 6: Add default position configurations
INSERT INTO position_configs (server_id, position_type, enabled, delay_seconds, cooldown_minutes) VALUES
('1753872071391_i24dewly', 'outpost', true, 5, 10),
('1753872071391_i24dewly', 'bandit', true, 5, 10)
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), delay_seconds = VALUES(delay_seconds), cooldown_minutes = VALUES(cooldown_minutes);

-- Step 7: Add some default position coordinates (you can update these later)
INSERT INTO position_coordinates (server_id, position_type, x_pos, y_pos, z_pos) VALUES
('1753872071391_i24dewly', 'outpost', 100.0, 200.0, 300.0),
('1753872071391_i24dewly', 'bandit', 150.0, 250.0, 350.0)
ON DUPLICATE KEY UPDATE x_pos = VALUES(x_pos), y_pos = VALUES(y_pos), z_pos = VALUES(z_pos);

-- Step 8: Verify the fixes
SELECT 'Channel Settings' as table_name, COUNT(*) as count FROM channel_settings WHERE server_id = '1753872071391_i24dewly'
UNION ALL
SELECT 'Autokits' as table_name, COUNT(*) as count FROM autokits WHERE server_id = '1753872071391_i24dewly'
UNION ALL
SELECT 'Killfeed Configs' as table_name, COUNT(*) as count FROM killfeed_configs WHERE server_id = '1753872071391_i24dewly'
UNION ALL
SELECT 'Position Configs' as table_name, COUNT(*) as count FROM position_configs WHERE server_id = '1753872071391_i24dewly'
UNION ALL
SELECT 'Position Coordinates' as table_name, COUNT(*) as count FROM position_coordinates WHERE server_id = '1753872071391_i24dewly';

-- Step 9: Show the actual channel IDs to verify they're not truncated
SELECT channel_type, channel_id, LENGTH(channel_id) as id_length 
FROM channel_settings 
WHERE server_id = '1753872071391_i24dewly' 
ORDER BY channel_type; 