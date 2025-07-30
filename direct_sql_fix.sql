-- Direct SQL fix for channel IDs
-- Run this in your MySQL database

USE zentro_bot;

-- First, delete all existing channel settings
DELETE FROM channel_settings;

-- Insert the correct channel settings
INSERT INTO channel_settings (server_id, channel_type, channel_id, created_at, updated_at) VALUES
('1753872071391_i24dewly', 'adminfeed', '1400098668123783268', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1753872071391_i24dewly', 'playercount', '1400098489311953007', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1753872071391_i24dewly', 'playerfeed', '1396872848748052581', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1753872071391_i24dewly', 'notefeed', '1397975202184429618', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Verify the changes
SELECT channel_type, channel_id, server_id FROM channel_settings ORDER BY channel_type; 