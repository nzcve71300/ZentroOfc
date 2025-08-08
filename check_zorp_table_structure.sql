-- Check ZORP table structure to understand the zone_id issue

-- Show the structure of zorp_zones table
DESCRIBE zorp_zones;

-- Show sample data to see what's missing
SELECT * FROM zorp_zones ORDER BY created_at DESC LIMIT 5;

-- Check if there's a zone_id column
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'zentro_bot' 
AND TABLE_NAME = 'zorp_zones'
ORDER BY ORDINAL_POSITION;

-- Show the most recent zone creation
SELECT 
    'Most recent zone:' as info,
    owner,
    server_id,
    created_at,
    expire,
    position,
    team
FROM zorp_zones 
ORDER BY created_at DESC 
LIMIT 1;