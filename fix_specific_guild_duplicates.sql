-- Fix duplicate entries for specific guild IDs causing channel spamming
-- Guild IDs: 1406308741628039228, 1390476170872750080
-- 
-- IMPORTANT: Run check_specific_guild_duplicates.sql FIRST to see what duplicates exist
-- This script will remove duplicates, keeping the most recent entries

SELECT 'Starting duplicate cleanup for guild IDs 1406308741628039228 and 1390476170872750080' as status;

-- STEP 1: Remove duplicate channel_settings (most likely cause of spamming)
-- Keep the most recent channel setting for each server_id + channel_type combination

-- For Guild 1406308741628039228
DELETE cs1 FROM channel_settings cs1
INNER JOIN channel_settings cs2 
INNER JOIN rust_servers rs1 ON cs1.server_id = rs1.id
INNER JOIN rust_servers rs2 ON cs2.server_id = rs2.id
INNER JOIN guilds g1 ON rs1.guild_id = g1.id
INNER JOIN guilds g2 ON rs2.guild_id = g2.id
WHERE cs1.id > cs2.id 
AND cs1.server_id = cs2.server_id 
AND cs1.channel_type = cs2.channel_type
AND g1.discord_id = '1406308741628039228'
AND g2.discord_id = '1406308741628039228';

-- For Guild 1390476170872750080
DELETE cs1 FROM channel_settings cs1
INNER JOIN channel_settings cs2 
INNER JOIN rust_servers rs1 ON cs1.server_id = rs1.id
INNER JOIN rust_servers rs2 ON cs2.server_id = rs2.id
INNER JOIN guilds g1 ON rs1.guild_id = g1.id
INNER JOIN guilds g2 ON rs2.guild_id = g2.id
WHERE cs1.id > cs2.id 
AND cs1.server_id = cs2.server_id 
AND cs1.channel_type = cs2.channel_type
AND g1.discord_id = '1390476170872750080'
AND g2.discord_id = '1390476170872750080';

SELECT 'Duplicate channel_settings removed' as status;

-- STEP 2: Remove duplicate guild entries (if any exist)
-- Keep the guild entry with the lower ID (older entry)

DELETE g1 FROM guilds g1
INNER JOIN guilds g2 
WHERE g1.id > g2.id 
AND g1.discord_id = g2.discord_id
AND g1.discord_id IN ('1406308741628039228', '1390476170872750080');

SELECT 'Duplicate guild entries removed' as status;

-- STEP 3: Remove duplicate player entries (if any exist)
-- Keep the most recent player entry for each unique combination

DELETE p1 FROM players p1
INNER JOIN players p2 
INNER JOIN guilds g ON p1.guild_id = g.id
WHERE p1.id > p2.id 
AND p1.guild_id = p2.guild_id
AND p1.server_id = p2.server_id 
AND p1.discord_id = p2.discord_id 
AND LOWER(p1.ign) = LOWER(p2.ign)
AND p1.is_active = true 
AND p2.is_active = true
AND g.discord_id IN ('1406308741628039228', '1390476170872750080');

SELECT 'Duplicate player entries removed' as status;

-- STEP 4: Clean up any orphaned economy records
DELETE e FROM economy e
LEFT JOIN players p ON e.player_id = p.id
WHERE p.id IS NULL;

SELECT 'Orphaned economy records cleaned up' as status;

-- STEP 5: Verification queries - run these to confirm cleanup was successful

SELECT 'VERIFICATION: Checking for remaining duplicates...' as status;

-- Check for remaining duplicate channel settings
SELECT 'Remaining duplicate channel settings:' as check_type, cs.server_id, rs.nickname, cs.channel_type, COUNT(*) as count
FROM channel_settings cs 
JOIN rust_servers rs ON cs.server_id = rs.id 
JOIN guilds g ON rs.guild_id = g.id 
WHERE g.discord_id IN ('1406308741628039228', '1390476170872750080')
GROUP BY cs.server_id, cs.channel_type 
HAVING COUNT(*) > 1;

-- Check for remaining duplicate guilds
SELECT 'Remaining duplicate guilds:' as check_type, discord_id, COUNT(*) as count
FROM guilds 
WHERE discord_id IN ('1406308741628039228', '1390476170872750080')
GROUP BY discord_id 
HAVING COUNT(*) > 1;

-- Final count of channel settings for these guilds
SELECT 'Final channel settings count:' as info, g.discord_id, COUNT(cs.id) as channel_count
FROM guilds g
JOIN rust_servers rs ON g.id = rs.guild_id
LEFT JOIN channel_settings cs ON rs.id = cs.server_id
WHERE g.discord_id IN ('1406308741628039228', '1390476170872750080')
GROUP BY g.discord_id;

SELECT 'Duplicate cleanup completed successfully!' as status;
