-- Check for duplicates in ALL tables that could cause issues

-- 1. Check for duplicate servers (we already did this, but let's be thorough)
SELECT 'rust_servers duplicates:' as info, nickname, COUNT(*) as count
FROM rust_servers 
GROUP BY nickname 
HAVING COUNT(*) > 1;

-- 2. Check for duplicate players
SELECT 'player duplicates:' as info, guild_id, server_id, discord_id, ign, COUNT(*) as count
FROM players 
WHERE is_active = true
GROUP BY guild_id, server_id, discord_id, ign
HAVING COUNT(*) > 1;

-- 3. Check for duplicate channel settings
SELECT 'channel_settings duplicates:' as info, server_id, channel_type, COUNT(*) as count
FROM channel_settings 
GROUP BY server_id, channel_type 
HAVING COUNT(*) > 1;

-- 4. Check for duplicate ZORP defaults
SELECT 'zorp_defaults duplicates:' as info, server_id, COUNT(*) as count
FROM zorp_defaults 
GROUP BY server_id 
HAVING COUNT(*) > 1;

-- 5. Check for duplicate economy records
SELECT 'economy duplicates:' as info, player_id, COUNT(*) as count
FROM economy 
GROUP BY player_id 
HAVING COUNT(*) > 1;

-- 6. Check for duplicate guilds
SELECT 'guild duplicates:' as info, discord_id, name, COUNT(*) as count
FROM guilds 
GROUP BY discord_id 
HAVING COUNT(*) > 1;

-- 7. Check for duplicate ZORP zones (same owner, same server, active)
SELECT 'active zorp duplicates:' as info, server_id, owner, COUNT(*) as count
FROM zorp_zones 
WHERE created_at + INTERVAL expire SECOND > NOW()
GROUP BY server_id, owner 
HAVING COUNT(*) > 1;

-- 8. Show summary of all tables
SELECT 'Table sizes:' as info;
SELECT 'rust_servers' as table_name, COUNT(*) as total_records FROM rust_servers
UNION ALL
SELECT 'players' as table_name, COUNT(*) as total_records FROM players
UNION ALL
SELECT 'guilds' as table_name, COUNT(*) as total_records FROM guilds
UNION ALL
SELECT 'channel_settings' as table_name, COUNT(*) as total_records FROM channel_settings
UNION ALL
SELECT 'zorp_defaults' as table_name, COUNT(*) as total_records FROM zorp_defaults
UNION ALL
SELECT 'zorp_zones' as table_name, COUNT(*) as total_records FROM zorp_zones
UNION ALL
SELECT 'economy' as table_name, COUNT(*) as total_records FROM economy;