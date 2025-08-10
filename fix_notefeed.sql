-- Fix notefeed channel configuration
USE zentro_bot;

-- Check current notefeed settings
SELECT 'Current notefeed settings:' as info;
SELECT cs.*, rs.nickname, g.discord_id 
FROM channel_settings cs 
JOIN rust_servers rs ON cs.server_id = rs.id 
JOIN guilds g ON rs.guild_id = g.id 
WHERE cs.channel_type = 'notefeed';

-- Check if any servers are missing notefeed configuration
SELECT 'Servers missing notefeed configuration:' as info;
SELECT rs.id, rs.nickname, g.discord_id 
FROM rust_servers rs 
JOIN guilds g ON rs.guild_id = g.id 
WHERE NOT EXISTS (
  SELECT 1 FROM channel_settings cs 
  WHERE cs.server_id = rs.id AND cs.channel_type = 'notefeed'
);

-- If you need to add notefeed configuration for a server, uncomment and modify the line below:
-- INSERT INTO channel_settings (server_id, channel_type, channel_id, created_at, updated_at) 
-- VALUES ('YOUR_SERVER_ID', 'notefeed', 'YOUR_CHANNEL_ID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Verify all channel types for each server
SELECT 'All channel configurations:' as info;
SELECT rs.nickname, cs.channel_type, cs.channel_id 
FROM channel_settings cs 
JOIN rust_servers rs ON cs.server_id = rs.id 
ORDER BY rs.nickname, cs.channel_type; 