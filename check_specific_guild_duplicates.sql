-- Check for duplicate entries for specific guild IDs that are causing channel spamming
-- Guild IDs: 1406308741628039228, 1390476170872750080

SELECT '=== CHECKING GUILD 1406308741628039228 ===' as info;

-- 1. Check guilds table for first guild
SELECT 'Guilds table entries:' as check_type, id, discord_id, name 
FROM guilds 
WHERE discord_id = '1406308741628039228';

-- 2. Check for duplicate guild entries
SELECT 'Duplicate guild check:' as check_type, discord_id, COUNT(*) as count, GROUP_CONCAT(id) as guild_ids, GROUP_CONCAT(name) as names 
FROM guilds 
WHERE discord_id = '1406308741628039228' 
GROUP BY discord_id 
HAVING COUNT(*) > 1;

-- 3. Check servers for this guild
SELECT 'Servers for guild:' as check_type, rs.id, rs.guild_id, rs.nickname, rs.ip, rs.port 
FROM rust_servers rs 
JOIN guilds g ON rs.guild_id = g.id 
WHERE g.discord_id = '1406308741628039228';

-- 4. Check channel settings (likely source of spamming)
SELECT 'Channel settings:' as check_type, cs.id, cs.server_id, rs.nickname as server_name, cs.channel_type, cs.channel_id, cs.created_at, cs.updated_at
FROM channel_settings cs 
JOIN rust_servers rs ON cs.server_id = rs.id 
JOIN guilds g ON rs.guild_id = g.id 
WHERE g.discord_id = '1406308741628039228'
ORDER BY rs.nickname, cs.channel_type;

-- 5. Check for duplicate channel settings for this guild
SELECT 'DUPLICATE channel settings:' as check_type, cs.server_id, rs.nickname, cs.channel_type, COUNT(*) as duplicate_count, GROUP_CONCAT(cs.id) as setting_ids, GROUP_CONCAT(cs.channel_id) as channel_ids
FROM channel_settings cs 
JOIN rust_servers rs ON cs.server_id = rs.id 
JOIN guilds g ON rs.guild_id = g.id 
WHERE g.discord_id = '1406308741628039228'
GROUP BY cs.server_id, cs.channel_type 
HAVING COUNT(*) > 1;

SELECT '=== CHECKING GUILD 1390476170872750080 ===' as info;

-- 6. Check guilds table for second guild
SELECT 'Guilds table entries:' as check_type, id, discord_id, name 
FROM guilds 
WHERE discord_id = '1390476170872750080';

-- 7. Check for duplicate guild entries
SELECT 'Duplicate guild check:' as check_type, discord_id, COUNT(*) as count, GROUP_CONCAT(id) as guild_ids, GROUP_CONCAT(name) as names 
FROM guilds 
WHERE discord_id = '1390476170872750080' 
GROUP BY discord_id 
HAVING COUNT(*) > 1;

-- 8. Check servers for this guild
SELECT 'Servers for guild:' as check_type, rs.id, rs.guild_id, rs.nickname, rs.ip, rs.port 
FROM rust_servers rs 
JOIN guilds g ON rs.guild_id = g.id 
WHERE g.discord_id = '1390476170872750080';

-- 9. Check channel settings (likely source of spamming)
SELECT 'Channel settings:' as check_type, cs.id, cs.server_id, rs.nickname as server_name, cs.channel_type, cs.channel_id, cs.created_at, cs.updated_at
FROM channel_settings cs 
JOIN rust_servers rs ON cs.server_id = rs.id 
JOIN guilds g ON rs.guild_id = g.id 
WHERE g.discord_id = '1390476170872750080'
ORDER BY rs.nickname, cs.channel_type;

-- 10. Check for duplicate channel settings for this guild
SELECT 'DUPLICATE channel settings:' as check_type, cs.server_id, rs.nickname, cs.channel_type, COUNT(*) as duplicate_count, GROUP_CONCAT(cs.id) as setting_ids, GROUP_CONCAT(cs.channel_id) as channel_ids
FROM channel_settings cs 
JOIN rust_servers rs ON cs.server_id = rs.id 
JOIN guilds g ON rs.guild_id = g.id 
WHERE g.discord_id = '1390476170872750080'
GROUP BY cs.server_id, cs.channel_type 
HAVING COUNT(*) > 1;

SELECT '=== OVERALL SUMMARY ===' as info;

-- 11. Overall duplicate check across all tables
SELECT 'Overall duplicate guilds:' as check_type, discord_id, COUNT(*) as count, GROUP_CONCAT(id) as guild_ids 
FROM guilds 
WHERE discord_id IN ('1406308741628039228', '1390476170872750080')
GROUP BY discord_id 
HAVING COUNT(*) > 1;

-- 12. Table sizes
SELECT 'Table sizes:' as info;
SELECT 'guilds' as table_name, COUNT(*) as total_records FROM guilds
UNION ALL
SELECT 'rust_servers' as table_name, COUNT(*) as total_records FROM rust_servers
UNION ALL
SELECT 'channel_settings' as table_name, COUNT(*) as total_records FROM channel_settings
UNION ALL
SELECT 'players' as table_name, COUNT(*) as total_records FROM players;
