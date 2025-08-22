-- Fix Linking System Constraints
-- Run this script to add missing database constraints for airtight linking

-- Add case-insensitive IGN uniqueness constraint per server
-- This ensures no two active players can have the same IGN (case-insensitive) on the same server
ALTER TABLE players 
ADD CONSTRAINT unique_server_ign_case_insensitive 
UNIQUE (server_id, LOWER(ign), is_active);

-- Add index for better performance on IGN lookups
CREATE INDEX IF NOT EXISTS idx_players_server_ign_lower ON players(server_id, LOWER(ign));

-- Add index for better performance on active status checks
CREATE INDEX IF NOT EXISTS idx_players_active_status ON players(is_active) WHERE is_active = true;

-- Verify the constraint was added successfully
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'players' 
AND CONSTRAINT_NAME = 'unique_server_ign_case_insensitive';

-- Show all constraints on players table
SELECT 
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'players'
ORDER BY CONSTRAINT_NAME;
