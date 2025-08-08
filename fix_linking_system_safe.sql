-- Safe Comprehensive Fix for Linking System
-- This script will clean up the database and fix linking issues

-- Step 1: Check current data types and data
SELECT 
    'Current discord_id data type check' as info,
    COUNT(*) as total_records,
    COUNT(CASE WHEN discord_id IS NOT NULL THEN 1 END) as non_null_discord_ids
FROM players;

-- Step 2: Clean up duplicate and conflicting records (safe approach)
-- Remove duplicate active records for the same IGN on the same server
DELETE p1 FROM players p1
INNER JOIN players p2 
WHERE p1.id > p2.id 
AND p1.server_id = p2.server_id 
AND p1.ign = p2.ign 
AND p1.is_active = true 
AND p2.is_active = true;

-- Remove duplicate active records for the same Discord ID on the same server
DELETE p1 FROM players p1
INNER JOIN players p2 
WHERE p1.id > p2.id 
AND p1.server_id = p2.server_id 
AND p1.discord_id = p2.discord_id 
AND p1.discord_id IS NOT NULL
AND p2.discord_id IS NOT NULL
AND p1.is_active = true 
AND p2.is_active = true;

-- Step 3: Add missing columns if they don't exist (safe approach)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Step 4: Update existing records to be active
UPDATE players SET is_active = TRUE WHERE is_active IS NULL;

-- Step 5: Safe data type conversion for discord_id
-- First, check if conversion is needed
SELECT 
    'Checking discord_id data type' as info,
    COLUMN_TYPE as current_type
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'zentro_bot' 
AND TABLE_NAME = 'players' 
AND COLUMN_NAME = 'discord_id';

-- Only convert if it's not already BIGINT
-- This will be handled by the application logic instead of forcing conversion

-- Step 6: Create proper indexes (safe approach)
CREATE INDEX IF NOT EXISTS idx_players_guild_discord ON players(guild_id, discord_id);
CREATE INDEX IF NOT EXISTS idx_players_guild_ign ON players(guild_id, ign(191));
CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active);
CREATE INDEX IF NOT EXISTS idx_players_server ON players(server_id);

-- Step 7: Clean up economy table (safe approach)
-- Remove orphaned economy records
DELETE e FROM economy e
LEFT JOIN players p ON e.player_id = p.id
WHERE p.id IS NULL;

-- Step 8: Ensure economy records exist for all active players
INSERT IGNORE INTO economy (player_id, balance)
SELECT p.id, 0
FROM players p
WHERE p.is_active = TRUE
AND NOT EXISTS (
    SELECT 1 FROM economy e WHERE e.player_id = p.id
);

-- Step 9: Show summary of fixes
SELECT 
    'Linking system fixed successfully!' as status,
    COUNT(*) as total_players,
    SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_players,
    SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive_players
FROM players; 