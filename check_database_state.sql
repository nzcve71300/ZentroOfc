-- Check current database state
-- This will help us understand what needs to be fixed

-- Check if guilds table exists and its structure
SELECT 
    'Checking guilds table' as info,
    COUNT(*) as guilds_count
FROM information_schema.tables 
WHERE table_schema = 'zentro_bot' AND table_name = 'guilds';

-- Check players table structure
SELECT 
    'Players table structure' as info,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'zentro_bot' 
AND TABLE_NAME = 'players'
ORDER BY ORDINAL_POSITION;

-- Check current discord_id data type
SELECT 
    'Discord ID data type' as info,
    COLUMN_TYPE as discord_id_type
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'zentro_bot' 
AND TABLE_NAME = 'players' 
AND COLUMN_NAME = 'discord_id';

-- Check for any problematic discord_id values
SELECT 
    'Problematic discord_id values' as info,
    COUNT(*) as problematic_count
FROM players 
WHERE discord_id IS NOT NULL 
AND (
    discord_id > 9223372036854775807  -- Max BIGINT value
    OR discord_id < -9223372036854775808  -- Min BIGINT value
    OR LENGTH(CAST(discord_id AS CHAR)) > 20  -- Too long for BIGINT
);

-- Check for duplicate records
SELECT 
    'Duplicate records check' as info,
    COUNT(*) as duplicate_count
FROM (
    SELECT guild_id, server_id, discord_id, ign, COUNT(*) as cnt
    FROM players 
    WHERE is_active = true
    GROUP BY guild_id, server_id, discord_id, ign
    HAVING COUNT(*) > 1
) as duplicates;

-- Check economy table structure
SELECT 
    'Economy table structure' as info,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'zentro_bot' 
AND TABLE_NAME = 'economy'
ORDER BY ORDINAL_POSITION;

-- Check for orphaned economy records
SELECT 
    'Orphaned economy records' as info,
    COUNT(*) as orphaned_count
FROM economy e
LEFT JOIN players p ON e.player_id = p.id
WHERE p.id IS NULL;

-- Summary
SELECT 
    'Database state summary' as info,
    (SELECT COUNT(*) FROM players) as total_players,
    (SELECT COUNT(*) FROM players WHERE is_active = true) as active_players,
    (SELECT COUNT(*) FROM economy) as total_economy_records; 