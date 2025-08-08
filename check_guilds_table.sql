-- Check guilds table structure
-- This will help us understand the foreign key issue

-- Check if guilds table exists
SELECT 
    'Checking guilds table existence' as info,
    COUNT(*) as guilds_count
FROM information_schema.tables 
WHERE table_schema = 'zentro_bot' AND table_name = 'guilds';

-- Check guilds table structure
SELECT 
    'Guilds table structure' as info,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'zentro_bot' 
AND TABLE_NAME = 'guilds'
ORDER BY ORDINAL_POSITION;

-- Check current indexes on guilds table
SELECT 
    'Guilds table indexes' as info,
    INDEX_NAME,
    COLUMN_NAME,
    NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'zentro_bot' 
AND TABLE_NAME = 'guilds'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Show sample data from guilds table
SELECT 
    'Sample guilds data' as info,
    id,
    discord_id,
    name
FROM guilds 
LIMIT 5; 